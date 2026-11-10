import { Province } from '../models/province';
import { Town, PublicTown, toPublicTown } from '../models/town';
import { ValidationError } from '../lib/errors';

export type ListTownsResult = PublicTown[];

// Catálogo cerrado: devuelve todas las poblaciones de la provincia, sin límite, ordenadas por nombre.
export async function listTowns(provinceId: string): Promise<ListTownsResult> {
  const exists = await Province.exists({ _id: provinceId });
  if (!exists) {
    throw new ValidationError('La provincia indicada no existe', [
      { field: 'provinceId', message: 'no existe en /api/provinces' },
    ]);
  }
  const docs = await Town.find({ provinceId })
    .collation({ locale: 'es', strength: 2 })
    .sort({ name: 1, _id: 1 })
    .lean();
  return docs.map((d) => toPublicTown(d));
}
