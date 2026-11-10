import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IProvince {
  _id: string;
  code: string;
  name: string;
}

export interface PublicProvince {
  id: string;
  code: string;
  name: string;
}

const provinceSchema = new Schema<IProvince>(
  {
    _id: { type: String, default: () => randomUUID() },
    code: { type: String, required: true },
    name: { type: String, required: true },
  },
  { versionKey: false },
);

provinceSchema.index({ name: 1 });
provinceSchema.index({ code: 1 }, { unique: true });

export const Province = model<IProvince>('Province', provinceSchema);

export function toPublicProvince(doc: IProvince): PublicProvince {
  return { id: doc._id, code: doc.code, name: doc.name };
}
