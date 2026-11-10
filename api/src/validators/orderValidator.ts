import { Request, Response, NextFunction } from 'express';
import { ValidationError, ValidationDetail } from '../lib/errors';
import { isUuid } from '../lib/uuid';
import { ORDER_STATUSES, OrderStatus } from '../models/order';

export interface OrderInput {
  customerId: string;
  date: string;
  amount: number;
}

export interface ShipInput {
  carrier: string;
  shippingDate: string;
}

export interface CancelInput {
  cancellationReason: string;
}

export interface ListOrdersQuery {
  customerId?: string;
  status?: OrderStatus;
  page: number;
  pageSize: number;
}

const MAX = 255;
const MAX_REASON = 2000;

// Fecha ISO 8601 (YYYY-MM-DD) que existe en el calendario.
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function text(body: Record<string, unknown>, field: string, max: number, details: ValidationDetail[]): string {
  const v = body[field];
  if (typeof v !== 'string' || v.trim() === '') {
    details.push({ field, message: 'es obligatorio y debe ser un texto' });
    return '';
  }
  if (v.length > max) details.push({ field, message: `máximo ${max} caracteres` });
  return v.trim();
}

export function validateOrderBody(raw: unknown): OrderInput {
  const body = asObject(raw);
  const details: ValidationDetail[] = [];
  if (!isUuid(body.customerId)) details.push({ field: 'customerId', message: 'debe ser un uuid' });
  if (!isIsoDate(body.date)) details.push({ field: 'date', message: 'fecha ISO 8601 (YYYY-MM-DD)' });
  if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0) {
    details.push({ field: 'amount', message: 'debe ser un número mayor o igual que 0' });
  }
  if (details.length > 0) throw new ValidationError('Los datos enviados no son válidos', details);
  return { customerId: body.customerId as string, date: body.date as string, amount: body.amount as number };
}

export function validateShipBody(raw: unknown): ShipInput {
  const body = asObject(raw);
  const details: ValidationDetail[] = [];
  const carrier = text(body, 'carrier', MAX, details);
  if (!isIsoDate(body.shippingDate)) details.push({ field: 'shippingDate', message: 'fecha ISO 8601 (YYYY-MM-DD)' });
  if (details.length > 0) throw new ValidationError('Los datos enviados no son válidos', details);
  return { carrier, shippingDate: body.shippingDate as string };
}

export function validateCancelBody(raw: unknown): CancelInput {
  const body = asObject(raw);
  const details: ValidationDetail[] = [];
  const cancellationReason = text(body, 'cancellationReason', MAX_REASON, details);
  if (details.length > 0) throw new ValidationError('Los datos enviados no son válidos', details);
  return { cancellationReason };
}

function intParam(value: unknown, field: string, max: number, def: number, details: ValidationDetail[]): number {
  if (value === undefined) return def;
  if (typeof value !== 'string' || !/^\d{1,15}$/.test(value) || Number(value) < 1 || Number(value) > max) {
    details.push({ field, message: `entero de 1 a ${max}` });
    return def;
  }
  return Number(value);
}

export function validateListOrders(req: Request, res: Response, next: NextFunction): void {
  const q = req.query;
  const details: ValidationDetail[] = [];
  const out: ListOrdersQuery = { page: 1, pageSize: 20 };
  if (q.customerId !== undefined) {
    if (!isUuid(q.customerId)) details.push({ field: 'customerId', message: 'debe ser un uuid' });
    else out.customerId = q.customerId;
  }
  if (q.status !== undefined) {
    if (typeof q.status !== 'string' || !(ORDER_STATUSES as readonly string[]).includes(q.status)) {
      details.push({ field: 'status', message: `debe ser uno de ${ORDER_STATUSES.join(', ')}` });
    } else out.status = q.status as OrderStatus;
  }
  out.page = intParam(q.page, 'page', 999999999999999, 1, details);
  out.pageSize = intParam(q.pageSize, 'pageSize', 100, 20, details);
  if (details.length > 0) return next(new ValidationError('Un parámetro no es válido', details));
  res.locals.listQuery = out;
  next();
}

// ship y cancel: el id ya se validó antes (el 400 de id va primero); aquí el cuerpo.
export function validateShipOrder(req: Request, res: Response, next: NextFunction): void {
  try {
    res.locals.input = validateShipBody(req.body);
    next();
  } catch (e) {
    next(e);
  }
}

export function validateCancelOrder(req: Request, res: Response, next: NextFunction): void {
  try {
    res.locals.input = validateCancelBody(req.body);
    next();
  } catch (e) {
    next(e);
  }
}
