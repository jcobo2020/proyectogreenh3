import { Schema, model } from 'mongoose';

// Secuencias de la base de datos: una fila por secuencia (p. ej. «order» da el number de los pedidos).
export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const Counter = model<ICounter>('Counter', counterSchema);
