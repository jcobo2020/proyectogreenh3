import mongoose, { ClientSession } from 'mongoose';
import { createHash } from 'crypto';
import { Customer, ICustomer, PublicCustomer, toPublicCustomer } from '../models/customer';
import { IdempotencyKey } from '../models/idempotencyKey';
import { Province } from '../models/province';
import { Town } from '../models/town';
import {
  AppError,
  CustomerInUseError,
  CustomerNotFoundError,
  DuplicateEmailError,
  IdempotencyKeyReusedError,
  PreconditionFailedError,
  UnauthorizedError,
  ValidationError,
} from '../lib/errors';
import { CustomerInput, ListCustomersQuery, validateCustomerBody } from '../validators/customerValidator';

const CREATE_OPERATION = 'POST /api/customers';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TX_ATTEMPTS = 5;

export interface ListCustomerItem {
  id: string;
  name: string;
  email: string;
  provinceId: string;
  provinceName: string;
  townId: string;
  townName: string;
  status: string;
}

export interface ListCustomersResult {
  items: ListCustomerItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type CustomerDetail = PublicCustomer & { provinceName: string; townName: string };

export interface CreateCustomerResult {
  status: number;
  body: unknown;
  replayed: boolean;
}

// Quien cite a un cliente por customerId se registra aquí y su comprobación impide el borrado (IN_USE).
// Hoy ningún contrato del proyecto lo cita: la lista está vacía.
export type CustomerReferenceCheck = (customerId: string) => Promise<boolean>;
const customerReferences: CustomerReferenceCheck[] = [];
export function registerCustomerReference(check: CustomerReferenceCheck): void {
  customerReferences.push(check);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKey(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: number }).code === 11000;
}

// JSON con claves ordenadas: el mismo cuerpo da siempre el mismo hash.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hashRequest(operation: string, body: unknown): string {
  return createHash('sha256').update(`${operation}\n${canonical(body)}`).digest('hex');
}

// provinceId y townId existen y la población es de la provincia (si no, 400).
async function assertReferences(input: CustomerInput, session?: ClientSession): Promise<void> {
  const province = await Province.exists({ _id: input.provinceId }).session(session ?? null);
  if (!province) {
    throw new ValidationError('La provincia indicada no existe', [
      { field: 'provinceId', message: 'no existe en /api/provinces' },
    ]);
  }
  const town = await Town.findById(input.townId).session(session ?? null).lean();
  if (!town) {
    throw new ValidationError('La población indicada no existe', [
      { field: 'townId', message: 'no existe en /api/towns' },
    ]);
  }
  if (town.provinceId !== input.provinceId) {
    throw new ValidationError('La población no es de la provincia indicada', [
      { field: 'townId', message: 'no pertenece a la provincia enviada' },
    ]);
  }
}

async function assertEmailFree(email: string, excludeId?: string, session?: ClientSession): Promise<void> {
  const filter: Record<string, unknown> = { email };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Customer.exists(filter).session(session ?? null)) throw new DuplicateEmailError();
}

// Pega los nombres de provincia y población con $lookup: una sola consulta, sin llamada por fila.
function withNames(): mongoose.PipelineStage[] {
  return [
    { $lookup: { from: Province.collection.name, localField: 'provinceId', foreignField: '_id', as: 'province' } },
    { $lookup: { from: Town.collection.name, localField: 'townId', foreignField: '_id', as: 'town' } },
    {
      $addFields: {
        provinceName: { $ifNull: [{ $first: '$province.name' }, ''] },
        townName: { $ifNull: [{ $first: '$town.name' }, ''] },
      },
    },
  ];
}

export async function listCustomers(q: ListCustomersQuery): Promise<ListCustomersResult> {
  if (q.provinceId && !(await Province.exists({ _id: q.provinceId }))) {
    throw new ValidationError('La provincia indicada no existe', [
      { field: 'provinceId', message: 'no existe en /api/provinces' },
    ]);
  }
  const filter: Record<string, unknown> = {};
  if (q.name) filter.name = { $regex: escapeRegex(q.name), $options: 'i' };
  if (q.provinceId) filter.provinceId = q.provinceId;
  if (q.status) filter.status = q.status;
  const collation = { locale: 'es', strength: 2 };
  const [total, rows] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.aggregate([
      { $match: filter },
      { $sort: { name: 1, _id: 1 } },
      { $skip: (q.page - 1) * q.pageSize },
      { $limit: q.pageSize },
      ...withNames(),
    ]).collation(collation),
  ]);
  return {
    items: rows.map((r) => ({
      id: r._id,
      name: r.name,
      email: r.email,
      provinceId: r.provinceId,
      provinceName: r.provinceName,
      townId: r.townId,
      townName: r.townName,
      status: r.status,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export async function findCustomerById(id: string): Promise<CustomerDetail> {
  const [row] = await Customer.aggregate([{ $match: { _id: id } }, ...withNames()]);
  if (!row) throw new CustomerNotFoundError();
  return { ...toPublicCustomer(row as ICustomer), provinceName: row.provinceName, townName: row.townName };
}

async function performCreate(rawBody: unknown, session: ClientSession): Promise<PublicCustomer> {
  const input = validateCustomerBody(rawBody);
  await assertReferences(input, session);
  await assertEmailFree(input.email, undefined, session);
  const [doc] = await Customer.create([{ ...input, version: 1 }], { session });
  return toPublicCustomer(doc.toObject());
}

async function createOnce(userId: string, key: string, rawBody: unknown): Promise<CreateCustomerResult> {
  const requestHash = hashRequest(CREATE_OPERATION, rawBody);
  return mongoose.connection.transaction(async (session) => {
    const now = new Date();
    const existing = await IdempotencyKey.findOne({ userId, key }).session(session).lean();
    if (existing) {
      if (existing.expiresAt.getTime() > now.getTime()) {
        if (existing.requestHash !== requestHash || existing.operation !== CREATE_OPERATION) {
          throw new IdempotencyKeyReusedError();
        }
        return { status: existing.responseStatus, body: existing.responseBody, replayed: true };
      }
      await IdempotencyKey.deleteOne({ _id: existing._id }).session(session);
    }
    // La fila de la clave se inserta al empezar: su índice único hace esperar al envío concurrente.
    const [row] = await IdempotencyKey.create(
      [
        {
          userId,
          key,
          operation: CREATE_OPERATION,
          requestHash,
          responseStatus: 0,
          responseBody: {},
          createdAt: now,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        },
      ],
      { session },
    );
    let status: number;
    let body: unknown;
    try {
      body = await performCreate(rawBody, session);
      status = 201;
    } catch (err) {
      const app = err as AppError & { details?: unknown };
      if (!app || typeof app.status !== 'number' || app.status >= 500) throw err;
      // Un 4xx sin crear nada también se guarda, para repetirlo igual.
      status = app.status;
      body = { code: app.code, message: app.message, ...(Array.isArray(app.details) ? { details: app.details } : {}) };
    }
    await IdempotencyKey.updateOne({ _id: row._id }, { responseStatus: status, responseBody: body }).session(session);
    return { status, body, replayed: false };
  });
}

export async function createCustomer(
  userId: string | undefined,
  key: string,
  rawBody: unknown,
): Promise<CreateCustomerResult> {
  if (!userId) throw new UnauthorizedError();
  let last: unknown;
  for (let i = 0; i < MAX_TX_ATTEMPTS; i++) {
    try {
      return await createOnce(userId, key, rawBody);
    } catch (err) {
      // Carrera con otro envío (clave o email repetidos): al reintentar ve ya lo que el otro dejó.
      if (!isDuplicateKey(err)) throw err;
      last = err;
    }
  }
  throw last;
}

export async function updateCustomer(id: string, input: CustomerInput, expectedVersion: number): Promise<PublicCustomer> {
  const current = await Customer.findById(id).lean();
  if (!current) throw new CustomerNotFoundError();
  if (current.version !== expectedVersion) throw new PreconditionFailedError();
  await assertReferences(input);
  await assertEmailFree(input.email, id);
  try {
    // La versión va en el filtro: si otro cambió entre la lectura y la escritura, no se guarda.
    const updated = await Customer.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: input, $inc: { version: 1 } },
      { new: true },
    ).lean();
    if (!updated) throw new PreconditionFailedError();
    return toPublicCustomer(updated);
  } catch (err) {
    if (isDuplicateKey(err)) throw new DuplicateEmailError();
    throw err;
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  if (!(await Customer.exists({ _id: id }))) throw new CustomerNotFoundError();
  for (const check of customerReferences) {
    if (await check(id)) throw new CustomerInUseError();
  }
  await Customer.deleteOne({ _id: id });
}
