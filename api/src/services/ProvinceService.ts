import { Province, PublicProvince, toPublicProvince } from '../models/province';

export type ListProvincesResult = PublicProvince[];

// Catálogo cerrado: devuelve todas las filas, sin límite, ordenadas por nombre.
export async function listProvinces(): Promise<ListProvincesResult> {
  const docs = await Province.find()
    .collation({ locale: 'es', strength: 2 })
    .sort({ name: 1, code: 1 })
    .lean();
  return docs.map((d) => toPublicProvince(d));
}
