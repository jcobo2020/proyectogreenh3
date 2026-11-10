import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export interface ICustomer {
  _id: string;
  name: string;
  email: string;
  streetAddress: string;
  provinceId: string;
  townId: string;
  status: CustomerStatus;
  version: number;
}

export interface PublicCustomer {
  id: string;
  name: string;
  email: string;
  streetAddress: string;
  provinceId: string;
  townId: string;
  status: CustomerStatus;
  version: number;
}

const customerSchema = new Schema<ICustomer>(
  {
    _id: { type: String, default: () => randomUUID() },
    name: { type: String, required: true, maxlength: 255 },
    email: { type: String, required: true, maxlength: 255 },
    streetAddress: { type: String, required: true, maxlength: 255 },
    provinceId: { type: String, required: true, ref: 'Province' },
    townId: { type: String, required: true, ref: 'Town' },
    status: { type: String, required: true, enum: CUSTOMER_STATUSES },
    version: { type: Number, required: true, default: 1 },
  },
  { versionKey: false },
);

customerSchema.index({ name: 1 });
customerSchema.index({ provinceId: 1, name: 1 });
customerSchema.index({ status: 1, name: 1 });
customerSchema.index({ townId: 1 });
customerSchema.index({ email: 1 }, { unique: true });

export const Customer = model<ICustomer>('Customer', customerSchema);

export function toPublicCustomer(doc: ICustomer): PublicCustomer {
  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    streetAddress: doc.streetAddress,
    provinceId: doc.provinceId,
    townId: doc.townId,
    status: doc.status,
    version: doc.version,
  };
}
