import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app';
import { connectDB } from '../config/connectDB';
import { Province } from '../models/province';
import { PROVINCES_SEED, seedProvinces } from '../services/ProvinceSeedService';

let repl: MongoMemoryReplSet;
const secret = randomBytes(32).toString('hex');
const app = createApp();
const token = () => jwt.sign({ sub: 'u1' }, secret, { algorithm: 'HS256' });

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDB(repl.getUri());
  await seedProvinces();
});

afterAll(async () => {
  await mongoose.disconnect();
  await repl.stop();
});

describe('GET /api/provinces', () => {
  it('AC-01: 200 con array directo, todas las filas, ordenadas por nombre', async () => {
    const res = await request(app).get('/api/provinces').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(PROVINCES_SEED.length);
    const names: string[] = res.body.map((p: any) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'es'));
    expect(names).toEqual(sorted);
    expect(Object.keys(res.body[0]).sort()).toEqual(['code', 'id', 'name']);
    expect(res.body[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('AC-01: ordena por nombre aunque las filas se inserten desordenadas', async () => {
    await Province.create({ code: 'ZZ', name: 'Aaa Primera' });
    const res = await request(app).get('/api/provinces').set('Authorization', `Bearer ${token()}`);
    expect(res.body[0].name).toBe('Aaa Primera');
    await Province.deleteOne({ code: 'ZZ' });
  });

  it('el seed es idempotente', async () => {
    await seedProvinces();
    expect(await Province.countDocuments()).toBe(PROVINCES_SEED.length);
  });

  it('AC-02: 401 UNAUTHORIZED sin token', async () => {
    const res = await request(app).get('/api/provinces');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.message).toBe('UNAUTHORIZED');
  });

  it('AC-02: 401 con token inválido o firmado con otra clave', async () => {
    const bad = jwt.sign({ sub: 'u1' }, randomBytes(32).toString('hex'));
    expect((await request(app).get('/api/provinces').set('Authorization', 'Bearer xxx')).status).toBe(401);
    expect((await request(app).get('/api/provinces').set('Authorization', `Bearer ${bad}`)).status).toBe(401);
  });
});

describe('app', () => {
  it('GET / responde 200, ruta inexistente 404, JSON roto 400', async () => {
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/nada')).status).toBe(404);
    const r = await request(app)
      .post('/api/provinces')
      .set('Content-Type', 'application/json')
      .send('{"roto": ');
    expect(r.status).toBe(400);
  });

  it('cuerpo que supera el límite responde 413', async () => {
    const r = await request(app)
      .post('/api/provinces')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ relleno: 'x'.repeat(200000) }));
    expect(r.status).toBe(413);
  });
});
