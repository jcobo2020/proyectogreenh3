import { Request, Response, NextFunction } from 'express';
import { ValidationError, ValidationDetail } from '../lib/errors';
import { isUuid } from '../lib/uuid';
import { isIsoDate } from './orderValidator';

export interface InvoiceInput {
  customerId: string;
  date: string;
  amount: number;
}

export interface ListInvoicesQuery {
  customerId?: string;
  page: number;
  pageSize: number;
}

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

// Hoy en ISO (YYYY-MM-DD, UTC): la fecha de una factura no puede ser posterior.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function validateInvoiceBody(raw: unknown): InvoiceInput {
  const body = asObject(raw);
  const details: ValidationDetail[] = [];
  if (!isUuid(body.customerId)) details.push({ field: 'customerId', message: 'debe ser un uuid' });
  if (!isIsoDate(body.date)) details.push({ field: 'date', message: 'fecha ISO 8601 (YYYY-MM-DD)' });
  else if (body.date > today()) details.push({ field: 'date', message: 'no puede ser posterior a hoy' });
  if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0.01) {
    details.push({ field: 'amount', message: 'debe ser un número desde 0.01' });
  }
  if (details.length > 0) throw new ValidationError('Los datos enviados no son válidos', details);
  return { customerId: body.customerId as string, date: body.date as string, amount: body.amount as number };
}

function intParam(value: unknown, field: string, max: number, def: number, details: ValidationDetail[]): number {
  if (value === undefined) return def;
  if (typeof value !== 'string' || !/^\d{1,15}$/.test(value) || Number(value) < 1 || Number(value) > max) {
    details.push({ field, message: `entero de 1 a ${max}` });
    return def;
  }
  return Number(value);
}

export function validateListInvoices(req: Request, res: Response, next: NextFunction): void {
  const q = req.query;
  const details: ValidationDetail[] = [];
  const out: ListInvoicesQuery = { page: 1, pageSize: 20 };
  if (q.customerId !== undefined) {
    if (!isUuid(q.customerId)) details.push({ field: 'customerId', message: 'debe ser un uuid' });
    else out.customerId = q.customerId;
  }
  out.page = intParam(q.page, 'page', 999999999999999, 1, details);
  out.pageSize = intParam(q.pageSize, 'pageSize', 100, 20, details);
  if (details.length > 0) return next(new ValidationError('Un parámetro no es válido', details));
  res.locals.listQuery = out;
  next();
}
