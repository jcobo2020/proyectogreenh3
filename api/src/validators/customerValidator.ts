import { Request, Response, NextFunction } from 'express';
import { ValidationError, ValidationDetail, PreconditionRequiredError } from '../lib/errors';
import { isUuid } from '../lib/uuid';
import { normalizeEmail } from '../lib/email';
import { CUSTOMER_STATUSES, CustomerStatus } from '../models/customer';

export interface CustomerInput {
  name: string;
  email: string;
  streetAddress: string;
  provinceId: string;
  townId: string;
  status: CustomerStatus;
}

export interface ListCustomersQuery {
  name?: string;
  provinceId?: string;
  status?: CustomerStatus;
  page: number;
  pageSize: number;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
const MAX = 255;

function text(body: Record<string, unknown>, field: string, details: ValidationDetail[]): string {
  const v = body[field];
  if (typeof v !== 'string' || v.trim() === '') {
    details.push({ field, message: 'es obligatorio y debe ser un texto' });
    return '';
  }
  if (v.length > MAX) details.push({ field, message: `máximo ${MAX} caracteres` });
  return v.trim();
}

// Valida y normaliza el cuerpo de POST/PUT. Lanza ValidationError con un detalle por dato.
export function validateCustomerBody(raw: unknown): CustomerInput {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const details: ValidationDetail[] = [];
  const name = text(body, 'name', details);
  const email = normalizeEmail(text(body, 'email', details));
  if (email && email.length <= MAX && !EMAIL_RE.test(email)) {
    details.push({ field: 'email', message: 'formato de correo no válido' });
  }
  const streetAddress = text(body, 'streetAddress', details);
  for (const f of ['provinceId', 'townId']) {
    if (!isUuid(body[f])) details.push({ field: f, message: 'debe ser un uuid' });
  }
  const status = body.status;
  if (typeof status !== 'string' || !(CUSTOMER_STATUSES as readonly string[]).includes(status)) {
    details.push({ field: 'status', message: 'debe ser active o inactive' });
  }
  if (details.length > 0) throw new ValidationError('Los datos enviados no son válidos', details);
  return {
    name,
    email,
    streetAddress,
    provinceId: body.provinceId as string,
    townId: body.townId as string,
    status: status as CustomerStatus,
  };
}

function intParam(value: unknown, field: string, max: number, def: number, details: ValidationDetail[]): number {
  if (value === undefined) return def;
  if (typeof value !== 'string' || !/^\d{1,15}$/.test(value) || Number(value) < 1 || Number(value) > max) {
    details.push({ field, message: `entero de 1 a ${max}` });
    return def;
  }
  return Number(value);
}

export function validateListCustomers(req: Request, res: Response, next: NextFunction): void {
  const q = req.query;
  const details: ValidationDetail[] = [];
  const out: ListCustomersQuery = { page: 1, pageSize: 20 };
  if (q.name !== undefined) {
    if (typeof q.name !== 'string' || q.name.length > MAX) details.push({ field: 'name', message: `máximo ${MAX} caracteres` });
    else out.name = q.name;
  }
  if (q.provinceId !== undefined) {
    if (!isUuid(q.provinceId)) details.push({ field: 'provinceId', message: 'debe ser un uuid' });
    else out.provinceId = q.provinceId;
  }
  if (q.status !== undefined) {
    if (typeof q.status !== 'string' || !(CUSTOMER_STATUSES as readonly string[]).includes(q.status)) {
      details.push({ field: 'status', message: 'debe ser active o inactive' });
    } else out.status = q.status as CustomerStatus;
  }
  out.page = intParam(q.page, 'page', 999999999999999, 1, details);
  out.pageSize = intParam(q.pageSize, 'pageSize', 100, 20, details);
  if (details.length > 0) return next(new ValidationError('Un parámetro no es válido', details));
  res.locals.listQuery = out;
  next();
}

export function validateIdParam(req: Request, _res: Response, next: NextFunction): void {
  if (!isUuid(req.params.id)) {
    return next(new ValidationError('El id no es un UUID válido', [{ field: 'id', message: 'debe ser un uuid' }]));
  }
  next();
}

export function validateIdempotencyKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.header('Idempotency-Key');
  if (!key || key.trim() === '' || key.length > MAX) {
    return next(
      new ValidationError('Falta la cabecera Idempotency-Key (hasta 255 caracteres)', [
        { field: 'Idempotency-Key', message: 'es obligatoria, de hasta 255 caracteres' },
      ]),
    );
  }
  res.locals.idempotencyKey = key;
  next();
}

// PUT: id válido → If-Match presente → cuerpo válido.
export function validateUpdateCustomer(req: Request, res: Response, next: NextFunction): void {
  if (!isUuid(req.params.id)) return validateIdParam(req, res, next);
  const ifMatch = req.header('If-Match');
  if (ifMatch === undefined || ifMatch.trim() === '') return next(new PreconditionRequiredError());
  try {
    res.locals.input = validateCustomerBody(req.body);
  } catch (e) {
    return next(e);
  }
  // El ETag va entre comillas ("3"); si no es una versión legible, no coincide con ninguna.
  const m = /^(?:W\/)?"?(\d+)"?$/.exec(ifMatch.trim());
  res.locals.expectedVersion = m ? Number(m[1]) : -1;
  next();
}
