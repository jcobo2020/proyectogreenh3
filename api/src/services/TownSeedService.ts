import mongoose from 'mongoose';
import { Province } from '../models/province';
import { Town } from '../models/town';

// Poblaciones iniciales. El «id» es fijo y va escrito aquí; la provincia se resuelve por su código.
export const TOWNS_SEED: { id: string; provinceCode: string; name: string }[] = [
  { id: '812097c4-7b93-49ec-add0-b17de3ff65ea', provinceCode: '17', name: 'Quito' },
  { id: 'e0efae73-3631-4d25-bf91-e3604e03284c', provinceCode: '17', name: 'Cayambe' },
  { id: 'e136e013-8cd5-4cfc-8425-a62a9902fa92', provinceCode: '17', name: 'Mejía' },
  { id: '4439e514-956b-4745-b5fe-9aa7d7db218a', provinceCode: '09', name: 'Guayaquil' },
  { id: '3cafa316-7f55-4a64-bef4-34c32d714741', provinceCode: '09', name: 'Daule' },
  { id: '42b0b355-27f7-44e6-a681-e557fa295dee', provinceCode: '09', name: 'Samborondón' },
  { id: '9b654272-7cb1-4eab-bf14-78b608ef03b9', provinceCode: '01', name: 'Cuenca' },
  { id: '396d1bf7-8a05-4c4c-9102-e564a39086e4', provinceCode: '01', name: 'Gualaceo' },
  { id: '6d4ac9db-66d2-4edf-a7ff-6584e0bce7d9', provinceCode: '10', name: 'Ibarra' },
  { id: '6bba7bd0-2927-4402-ac43-4a820e996359', provinceCode: '10', name: 'Otavalo' },
  { id: '4a85be19-0878-43f2-807c-e12d38e4343b', provinceCode: '11', name: 'Loja' },
  { id: '94da0b63-22fc-4e85-a492-d4d6d9d80d19', provinceCode: '13', name: 'Portoviejo' },
  { id: 'fecd68b9-95d3-4dee-97ed-47bfc1596b37', provinceCode: '13', name: 'Manta' },
];

// Migración de datos iniciales: idempotente, una sola transacción; no duplica por «id».
// Debe correr después de seedProvinces (necesita las provincias).
export async function seedTowns(): Promise<void> {
  await Town.createCollection().catch(() => undefined);
  await Town.init();
  const provinces = await Province.find().lean();
  const idByCode = new Map(provinces.map((p) => [p.code, p._id]));
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const t of TOWNS_SEED) {
        const provinceId = idByCode.get(t.provinceCode);
        if (!provinceId) throw new Error(`Provincia ${t.provinceCode} no existe: la carga de poblaciones falla`);
        await Town.updateOne(
          { _id: t.id },
          { $setOnInsert: { provinceId, name: t.name } },
          { upsert: true, session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
}
