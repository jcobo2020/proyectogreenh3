import mongoose, { ClientSession } from 'mongoose';
import { Counter } from '../models/counter';
import { Customer } from '../models/customer';
import { Invoice, PublicInvoice, toPublicInvoice } from '../models/invoice';
import { ValidationError } from '../lib/errors';
import { registerCustomerReference } from './CustomerService';
import { IdempotentResult, runIdempotent } from './IdempotencyService';
import { InvoiceInput, ListInvoicesQuery, validateInvoiceBody } from '../validators/invoiceValidator';

const CREATE_OPERATION = 'POST /api/invoices';

// Borrar un cliente con facturas lo impide (IN_USE).
registerCustomerReference(async (customerId) => !!(await Invoice.exists({ customerId })));

export interface ListInvoiceItem {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
}

export interface ListInvoicesResult {
  items: ListInvoiceItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type CreatedInvoice = PublicInvoice & { customerName: string };

// F-AAAA-NNNNNN: el año de la factura y 6 cifras con ceros delante.
export function formatInvoiceNumber(year: string, seq: number): string {
  return `F-${year}-${String(seq).padStart(6, '0')}`;
}

async function findCustomerOrFail(customerId: string, session?: ClientSession): Promise<{ name: string }> {
  const customer = await Customer.findById(customerId, { name: 1 }).session(session ?? null).lean();
  if (!customer) {
    throw new ValidationError('El cliente indicado no existe', [
      { field: 'customerId', message: 'no existe en /api/customers' },
    ]);
  }
  return customer;
}

// Nombre del cliente con $lookup: una sola consulta, sin llamada por fila (y sin copia guardada).
function withCustomerName(): mongoose.PipelineStage[] {
  return [
    { $lookup: { from: Customer.collection.name, localField: 'customerId', foreignField: '_id', as: 'customer' } },
    { $addFields: { customerName: { $ifNull: [{ $first: '$customer.name' }, ''] } } },
  ];
}

export async function listInvoices(q: ListInvoicesQuery): Promise<ListInvoicesResult> {
  if (q.customerId) await findCustomerOrFail(q.customerId);
  const filter: Record<string, unknown> = {};
  if (q.customerId) filter.customerId = q.customerId;
  const [total, rows] = await Promise.all([
    Invoice.countDocuments(filter),
    Invoice.aggregate([
      { $match: filter },
      { $sort: { date: -1, _id: 1 } },
      { $skip: (q.page - 1) * q.pageSize },
      { $limit: q.pageSize },
      ...withCustomerName(),
    ]),
  ]);
  return {
    items: rows.map((r) => ({
      id: r._id,
      number: r.number,
      customerId: r.customerId,
      customerName: r.customerName,
      date: r.date,
      amount: r.amount,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

async function performCreate(rawBody: unknown, session: ClientSession): Promise<CreatedInvoice> {
  const input: InvoiceInput = validateInvoiceBody(rawBody);
  const customer = await findCustomerOrFail(input.customerId, session);
  // El number sale de un contador por año, que sube en la misma escritura del alta.
  const year = input.date.slice(0, 4);
  const counter = await Counter.findOneAndUpdate(
    { _id: `invoice-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  ).lean();
  const [doc] = await Invoice.create([{ ...input, number: formatInvoiceNumber(year, counter!.seq) }], { session });
  return { ...toPublicInvoice(doc.toObject()), customerName: customer.name };
}

export function createInvoice(userId: string | undefined, key: string, rawBody: unknown): Promise<IdempotentResult> {
  return runIdempotent(userId, key, CREATE_OPERATION, rawBody, (session) => performCreate(rawBody, session));
}
