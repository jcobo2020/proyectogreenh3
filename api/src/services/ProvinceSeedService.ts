import mongoose from 'mongoose';
import { Province } from '../models/province';

// Provincias de Ecuador (código INEC).
export const PROVINCES_SEED: { code: string; name: string }[] = [
  { code: '01', name: 'Azuay' },
  { code: '02', name: 'Bolívar' },
  { code: '03', name: 'Cañar' },
  { code: '04', name: 'Carchi' },
  { code: '05', name: 'Cotopaxi' },
  { code: '06', name: 'Chimborazo' },
  { code: '07', name: 'El Oro' },
  { code: '08', name: 'Esmeraldas' },
  { code: '09', name: 'Guayas' },
  { code: '10', name: 'Imbabura' },
  { code: '11', name: 'Loja' },
  { code: '12', name: 'Los Ríos' },
  { code: '13', name: 'Manabí' },
  { code: '14', name: 'Morona Santiago' },
  { code: '15', name: 'Napo' },
  { code: '16', name: 'Pastaza' },
  { code: '17', name: 'Pichincha' },
  { code: '18', name: 'Tungurahua' },
  { code: '19', name: 'Zamora Chinchipe' },
  { code: '20', name: 'Galápagos' },
  { code: '21', name: 'Sucumbíos' },
  { code: '22', name: 'Orellana' },
  { code: '23', name: 'Santo Domingo de los Tsáchilas' },
  { code: '24', name: 'Santa Elena' },
];

// Migración de datos iniciales: idempotente, una sola transacción, inserta por «code».
export async function seedProvinces(): Promise<void> {
  await Province.createCollection().catch(() => undefined);
  await Province.init();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const p of PROVINCES_SEED) {
        await Province.updateOne(
          { code: p.code },
          { $setOnInsert: { code: p.code, name: p.name } },
          { upsert: true, session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
}
