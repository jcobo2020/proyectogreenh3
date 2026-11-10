import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IIdempotencyKey {
  _id: string;
  userId: string;
  key: string;
  operation: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: Date;
  expiresAt: Date;
}

const idempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true },
    key: { type: String, required: true, maxlength: 255 },
    operation: { type: String, required: true },
    requestHash: { type: String, required: true },
    responseStatus: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, minimize: false },
);

idempotencyKeySchema.index({ userId: 1, key: 1 }, { unique: true });
// TTL: Mongo borra la fila al llegar expiresAt (el servicio además ignora las caducadas).
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyKey = model<IIdempotencyKey>('IdempotencyKey', idempotencyKeySchema);
