import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app';
import { connectDB } from '../config/connectDB';
import { Province } from '../models/province';
import { Town } from '../models/town';
import { seedProvinces } from '../services/ProvinceSeedService';
import { seedTowns, TOWNS_SEED } from '../services/TownSeedService';

let repl: MongoMemoryReplSet;
const secret = randomBytes(32).toString('hex');
const app = createApp();
const token = () => jwt.sign({ sub: 'u1' }, secret, { algorithm: 'HS256' });
const auth = () => ({ Authorization: `Bearer ${token()}` });

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDB(repl.getUri());
  await seedProvinces();
  await seedTowns();
});

afterAll(async () => {
  await mongoose.disconnect();
  await repl.stop();
});

describe('GET /api/towns', () => {
  it('AC-01: 200 con array directo, solo las de la provincia, ordenadas por nombre', async () => {
    const quito = await Province.findOne({ code: '17' }).lean();
    const res = await request(app).get('/api/towns').query({ provinceId: quito!._id }).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((t: any) => t.name)).toEqual(['Cayambe', 'Mejía', 'Quito']);
    expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'name', 'provinceId']);
    expect(res.body.every((t: any) => t.provinceId === quito!._id)).toBe(true);
  });

  it('AC-01: ordena por nombre aunque se inserten desordenadas y a igualdad de nombre', async () => {
    const p = await Province.create({ code: 'ZZ', name: 'Prueba' });
    await Town.create([
      { _id: '00000000-0000-4000-8000-000000000002', provinceId: p._id, name: 'Beta' },
      { _id: '00000000-0000-4000-8000-000000000001', provinceId: p._id, name: 'Beta' },
      { provinceId: p._id, name: 'Alfa' },
      { provinceId: p._id, name: 'Zeta' },
    ]);
    const res = await request(app).get('/api/towns').query({ provinceId: p._id }).set(auth());
    expect(res.body.map((t: any) => t.name)).toEqual(['Alfa', 'Beta', 'Beta', 'Zeta']);
    expect(res.body[1].id).toBe('00000000-0000-4000-8000-000000000001');
    await Town.deleteMany({ provinceId: p._id });
    await Province.deleteOne({ _id: p._id });
  });

  it('AC-01: provincia existente sin poblaciones devuelve []', async () => {
    const p = await Province.create({ code: 'YY', name: 'Vacía' });
    const res = await request(app).get('/api/towns').query({ provinceId: p._id }).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    await Province.deleteOne({ _id: p._id });
  });

  it('el seed es idempotente', async () => {
    await seedTowns();
    expect(await Town.countDocuments()).toBe(TOWNS_SEED.length);
  });

  it('el seed falla si falta una provincia', async () => {
    await Province.deleteOne({ code: '13' });
    await expect(seedTowns()).rejects.toThrow(/no existe/);
    await seedProvinces();
  });

  it('AC-02: 401 UNAUTHORIZED sin token o con token inválido', async () => {
    const id = randomUUID();
    const res = await request(app).get('/api/towns').query({ provinceId: id });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    const r2 = await request(app).get('/api/towns').query({ provinceId: id }).set('Authorization', 'Bearer xxx');
    expect(r2.status).toBe(401);
  });

  it('AC-03: 400 VALIDATION_ERROR si falta provinceId', async () => {
    const res = await request(app).get('/api/towns').set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details[0].field).toBe('provinceId');
  });

  it('AC-03: 400 VALIDATION_ERROR si provinceId no es uuid', async () => {
    const res = await request(app).get('/api/towns').query({ provinceId: 'abc' }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const r2 = await request(app).get('/api/towns?provinceId=').set(auth());
    expect(r2.status).toBe(400);
    const r3 = await request(app).get('/api/towns?provinceId=a&provinceId=b').set(auth());
    expect(r3.status).toBe(400);
  });

  it('AC-04: 400 VALIDATION_ERROR si provinceId no existe en provincias', async () => {
    const res = await request(app).get('/api/towns').query({ provinceId: randomUUID() }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details[0].field).toBe('provinceId');
  });
});
