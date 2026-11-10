import mongoose, { ClientSession } from 'mongoose';
import { IdempotencyKey } from '../models/idempotencyKey';
import { AppError, IdempotencyKeyReusedError, UnauthorizedError } from '../lib/errors';
import { hashRequest } from './CustomerService';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TX_ATTEMPTS = 5;

export interface IdempotentResult {
  status: number;
  body: unknown;
  replayed: boolean;
}

function isDuplicateKey(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: number }).code === 11000;
}

async function runOnce(
  userId: string,
  key: string,
  operation: string,
  rawBody: unknown,
  perform: (session: ClientSession) => Promise<unknown>,
): Promise<IdempotentResult> {
  const requestHash = hashRequest(operation, rawBody);
  return mongoose.connection.transaction(async (session) => {
    const now = new Date();
    const existing = await IdempotencyKey.findOne({ userId, key }).session(session).lean();
    if (existing) {
      if (existing.expiresAt.getTime() > now.getTime()) {
        if (existing.requestHash !== requestHash || existing.operation !== operation) {
          throw new IdempotencyKeyReusedError();
        }
        return { status: existing.responseStatus, body: existing.responseBody, replayed: true };
      }
      await IdempotencyKey.deleteOne({ _id: existing._id }).session(session);
    }
    // La fila de la clave se inserta al empezar, en la transacción de lo que se crea:
    // su índice único hace esperar al envío concurrente.
    const [row] = await IdempotencyKey.create(
      [
        {
          userId,
          key,
          operation,
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
      body = await perform(session);
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

// Ejecuta una creación con Idempotency-Key por usuario (24 h). Reintenta si choca con otro envío concurrente.
export async function runIdempotent(
  userId: string | undefined,
  key: string,
  operation: string,
  rawBody: unknown,
  perform: (session: ClientSession) => Promise<unknown>,
): Promise<IdempotentResult> {
  if (!userId) throw new UnauthorizedError();
  let last: unknown;
  for (let i = 0; i < MAX_TX_ATTEMPTS; i++) {
    try {
      return await runOnce(userId, key, operation, rawBody, perform);
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      last = err;
    }
  }
  throw last;
}
