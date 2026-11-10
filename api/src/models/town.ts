import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface ITown {
  _id: string;
  provinceId: string;
  name: string;
}

export interface PublicTown {
  id: string;
  provinceId: string;
  name: string;
}

const townSchema = new Schema<ITown>(
  {
    _id: { type: String, default: () => randomUUID() },
    provinceId: { type: String, required: true, ref: 'Province' },
    name: { type: String, required: true },
  },
  { versionKey: false },
);

townSchema.index({ provinceId: 1, name: 1 });

export const Town = model<ITown>('Town', townSchema);

export function toPublicTown(doc: ITown): PublicTown {
  return { id: doc._id, provinceId: doc.provinceId, name: doc.name };
}
