import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export interface IInvoice {
  _id: string;
  number: string;
  customerId: string;
  date: string;
  amount: number;
}

export interface PublicInvoice {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  number: string;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    _id: { type: String, default: () => randomUUID() },
    number: { type: String, required: true },
    customerId: { type: String, required: true, ref: 'Customer' },
    date: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
  },
  { versionKey: false },
);

invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ customerId: 1, date: -1 });
invoiceSchema.index({ number: 1 }, { unique: true });

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);

export function toPublicInvoice(doc: IInvoice): PublicInvoice {
  return {
    id: doc._id,
    customerId: doc.customerId,
    date: doc.date,
    amount: doc.amount,
    number: doc.number,
  };
}
