import mongoose, { ClientSession } from 'mongoose';
import { Counter } from '../models/counter';
import { Customer } from '../models/customer';
import { IOrder, Order, OrderStatus, PublicOrder, toPublicOrder } from '../models/order';
import { OrderNotFoundError, OrderStateConflictError, ValidationError } from '../lib/errors';
import { registerCustomerReference } from './CustomerService';
import { IdempotentResult, runIdempotent } from './IdempotencyService';
import { CancelInput, ListOrdersQuery, OrderInput, ShipInput, validateOrderBody } from '../validators/orderValidator';

const CREATE_OPERATION = 'POST /api/orders';

// Borrar un cliente con pedidos lo impide (IN_USE).
registerCustomerReference(async (customerId) => !!(await Order.exists({ customerId })));

export interface ListOrderItem {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  status: OrderStatus;
}

export interface ListOrdersResult {
  items: ListOrderItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type OrderDetail = PublicOrder & { number: string; customerName: string };

export function formatOrderNumber(seq: number): string {
  return `PED-${String(seq).padStart(6, '0')}`;
}

async function assertCustomerExists(customerId: string, session?: ClientSession): Promise<void> {
  if (!(await Customer.exists({ _id: customerId }).session(session ?? null))) {
    throw new ValidationError('El cliente indicado no existe', [
      { field: 'customerId', message: 'no existe en /api/customers' },
    ]);
  }
}

// Nombre del cliente con $lookup: una sola consulta, sin llamada por fila (y sin copia guardada).
function withCustomerName(): mongoose.PipelineStage[] {
  return [
    { $lookup: { from: Customer.collection.name, localField: 'customerId', foreignField: '_id', as: 'customer' } },
    { $addFields: { customerName: { $ifNull: [{ $first: '$customer.name' }, ''] } } },
  ];
}

export async function listOrders(q: ListOrdersQuery): Promise<ListOrdersResult> {
  if (q.customerId) await assertCustomerExists(q.customerId);
  const filter: Record<string, unknown> = {};
  if (q.customerId) filter.customerId = q.customerId;
  if (q.status) filter.status = q.status;
  const [total, rows] = await Promise.all([
    Order.countDocuments(filter),
    Order.aggregate([
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
      status: r.status,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export async function findOrderById(id: string): Promise<OrderDetail> {
  const [row] = await Order.aggregate([{ $match: { _id: id } }, ...withCustomerName()]);
  if (!row) throw new OrderNotFoundError();
  return { ...toPublicOrder(row as IOrder), number: row.number, customerName: row.customerName };
}

async function performCreate(rawBody: unknown, session: ClientSession): Promise<PublicOrder> {
  const input: OrderInput = validateOrderBody(rawBody);
  await assertCustomerExists(input.customerId, session);
  // El number sale de una secuencia de la base, en la misma escritura del alta.
  const counter = await Counter.findOneAndUpdate(
    { _id: 'order' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  ).lean();
  const [doc] = await Order.create([{ ...input, number: formatOrderNumber(counter!.seq), status: 'pending' }], {
    session,
  });
  return toPublicOrder(doc.toObject());
}

export function createOrder(userId: string | undefined, key: string, rawBody: unknown): Promise<IdempotentResult> {
  return runIdempotent(userId, key, CREATE_OPERATION, rawBody, (session) => performCreate(rawBody, session));
}

// El estado de partida va en la condición de la escritura: si otra petición lo cambió antes, no cambia ninguna fila → 409.
async function transition(
  id: string,
  from: OrderStatus[],
  set: Partial<IOrder> & { status: OrderStatus },
): Promise<IOrder> {
  const updated = await Order.findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: set }, { new: true }).lean();
  if (updated) return updated;
  if (!(await Order.exists({ _id: id }))) throw new OrderNotFoundError();
  throw new OrderStateConflictError(from);
}

export async function confirmOrder(id: string): Promise<PublicOrder> {
  return toPublicOrder(await transition(id, ['pending'], { status: 'confirmed' }));
}

export async function deliverOrder(id: string): Promise<PublicOrder> {
  return toPublicOrder(await transition(id, ['shipped'], { status: 'delivered' }));
}

export async function shipOrder(
  id: string,
  input: ShipInput,
): Promise<PublicOrder & { carrier: string; shippingDate: string }> {
  const o = await transition(id, ['confirmed'], { status: 'shipped', ...input });
  return { ...toPublicOrder(o), carrier: o.carrier!, shippingDate: o.shippingDate! };
}

export async function cancelOrder(
  id: string,
  input: CancelInput,
): Promise<PublicOrder & { cancellationReason: string }> {
  const o = await transition(id, ['pending', 'confirmed'], { status: 'cancelled', ...input });
  return { ...toPublicOrder(o), cancellationReason: o.cancellationReason! };
}
