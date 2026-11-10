import { Schema, model } from 'mongoose';
import { randomUUID } from 'crypto';

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrder {
  _id: string;
  number: string;
  customerId: string;
  date: string;
  amount: number;
  status: OrderStatus;
  carrier?: string;
  shippingDate?: string;
  cancellationReason?: string;
}

export interface PublicOrder {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  status: OrderStatus;
}

const orderSchema = new Schema<IOrder>(
  {
    _id: { type: String, default: () => randomUUID() },
    number: { type: String, required: true },
    customerId: { type: String, required: true, ref: 'Customer' },
    date: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, required: true, enum: ORDER_STATUSES, default: 'pending' },
    carrier: { type: String, maxlength: 255 },
    shippingDate: { type: String },
    cancellationReason: { type: String, maxlength: 2000 },
  },
  { versionKey: false },
);

orderSchema.index({ customerId: 1, date: -1 });
orderSchema.index({ status: 1, date: -1 });
orderSchema.index({ number: 1 }, { unique: true });

export const Order = model<IOrder>('Order', orderSchema);

export function toPublicOrder(doc: IOrder): PublicOrder {
  return {
    id: doc._id,
    customerId: doc.customerId,
    date: doc.date,
    amount: doc.amount,
    status: doc.status,
  };
}
