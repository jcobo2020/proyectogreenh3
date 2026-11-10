import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app';
import { connectDB } from '../config/connectDB';
import { Province } from '../models/province';
import { Town } from '../models/town';
import { Customer } from '../models/customer';
import { IdempotencyKey } from '../models/idempotencyKey';
import { seedProvinces } from '../services/ProvinceSeedService';
import { seedTowns } from '../services/TownSeedService';
import { registerCustomerReference, hashRequest } from '../services/CustomerService';

let repl: MongoMemoryReplSet;
const secret = randomBytes(32).toString('hex');
const app = createApp();
const tokenFor = (sub: string) => jwt.sign({ sub }, secret, { algorithm: 'HS256' });
const auth = (sub = 'user-1') => ({ Authorization: `Bearer ${tokenFor(sub)}` });

let quito: any;
let guayas: any;
let quitoTown: any;
let guayaquilTown: any;
let seq = 0;

const body = (over: Record<string, unknown> = {}) => ({
  name: 'Ana Pérez',
  email: `ana${++seq}@example.com`,
  streetAddress: 'Calle 1',
  provinceId: quito._id,
  townId: quitoTown._id,
  status: 'active',
  ...over,
});
const create = (b: object = body(), key: string = randomUUID(), headers = auth()) =>
  request(app).post('/api/customers').set(headers).set('Idempotency-Key', key).send(b);

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDB(repl.getUri());
  await seedProvinces();
  await seedTowns();
  await Customer.init();
  await IdempotencyKey.init();
  quito = await Province.findOne({ code: '17' }).lean();
  guayas = await Province.findOne({ code: '09' }).lean();
  quitoTown = await Town.findOne({ provinceId: quito._id, name: 'Quito' }).lean();
  guayaquilTown = await Town.findOne({ provinceId: guayas._id }).lean();
});

afterAll(async () => {
  await mongoose.disconnect();
  await repl.stop();
});

describe('POST /api/customers', () => {
  it('AC-05: 201 con id, datos, version y ETag', async () => {
    const b = body();
    const res = await create(b);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...b, version: 1 });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.headers.etag).toBe('"1"');
    expect(res.headers['idempotent-replayed']).toBeUndefined();
  });

  it('AC-06: 400 con datos no válidos', async () => {
    const res = await create({ name: '', email: 'no-es-email', provinceId: 'x', status: 'otro' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.map((d: any) => d.field)).toEqual(
      expect.arrayContaining(['name', 'email', 'streetAddress', 'provinceId', 'townId', 'status']),
    );
    const largo = await create(body({ name: 'x'.repeat(256) }));
    expect(largo.status).toBe(400);
  });

  it('AC-06: 400 si townId no es de la provincia enviada', async () => {
    const res = await create(body({ townId: guayaquilTown._id }));
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('townId');
  });

  it('AC-06: 400 si falta Idempotency-Key', async () => {
    const res = await request(app).post('/api/customers').set(auth()).send(body());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AC-07: 401 sin sesión válida', async () => {
    const res = await request(app).post('/api/customers').set('Idempotency-Key', 'k').send(body());
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('401 si el token no trae usuario (sub)', async () => {
    const t = jwt.sign({}, secret, { algorithm: 'HS256' });
    const res = await create(body(), randomUUID(), { Authorization: `Bearer ${t}` });
    expect(res.status).toBe(401);
  });

  it('AC-08: 409 CONFLICT con email repetido (sin distinguir mayúsculas)', async () => {
    const b = body();
    await create(b);
    const res = await create({ ...b, email: b.email.toUpperCase() });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('AC-09: 422 BUSINESS_RULE con la misma clave y otro cuerpo, sin crear', async () => {
    const key = randomUUID();
    const b = body();
    await create(b, key);
    const otro = body();
    const res = await create(otro, key);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BUSINESS_RULE');
    expect(await Customer.countDocuments({ email: otro.email })).toBe(0);
  });

  it('AC-10: 400 si provinceId no existe', async () => {
    const res = await create(body({ provinceId: randomUUID() }));
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('provinceId');
  });

  it('AC-11: 400 si townId no existe', async () => {
    const res = await create(body({ townId: randomUUID() }));
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('townId');
  });

  it('AC-12: misma clave y mismo cuerpo repite la respuesta con Idempotent-Replayed y no crea otro', async () => {
    const key = randomUUID();
    const b = body();
    const first = await create(b, key);
    const again = await create(b, key);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.headers.etag).toBe('"1"');
    expect(await Customer.countDocuments({ email: b.email })).toBe(1);
  });

  it('un 4xx también se guarda y se repite igual; otro usuario con la misma clave es otra clave', async () => {
    const key = randomUUID();
    const mala = body({ provinceId: randomUUID() });
    const first = await create(mala, key);
    const again = await create(mala, key);
    expect(first.status).toBe(400);
    expect(again.status).toBe(400);
    expect(again.body).toEqual(first.body);
    expect(again.headers['idempotent-replayed']).toBe('true');
    const otroUsuario = await create(body(), key, auth('user-2'));
    expect(otroUsuario.status).toBe(201);
    expect(otroUsuario.headers['idempotent-replayed']).toBeUndefined();
  });

  it('una clave caducada vale para un envío nuevo', async () => {
    const key = randomUUID();
    const b = body();
    await create(b, key);
    await IdempotencyKey.updateOne({ userId: 'user-1', key }, { expiresAt: new Date(Date.now() - 1000) });
    await Customer.deleteOne({ email: b.email });
    const res = await create(b, key);
    expect(res.status).toBe(201);
    expect(res.headers['idempotent-replayed']).toBeUndefined();
  });

  it('AC-13: dos envíos a la vez con la misma clave crean uno solo', async () => {
    const key = randomUUID();
    const b = body();
    const [a, c] = await Promise.all([create(b, key), create(b, key)]);
    expect([a.status, c.status]).toEqual([201, 201]);
    expect(a.body).toEqual(c.body);
    const replays = [a, c].filter((r) => r.headers['idempotent-replayed'] === 'true');
    expect(replays).toHaveLength(1);
    expect(await Customer.countDocuments({ email: b.email })).toBe(1);
    expect(await IdempotencyKey.countDocuments({ userId: 'user-1', key })).toBe(1);
  });

  it('hashRequest no depende del orden de las claves', () => {
    expect(hashRequest('op', { a: 1, b: [1, { c: 2, d: 3 }] })).toBe(hashRequest('op', { b: [1, { d: 3, c: 2 }], a: 1 }));
  });
});

describe('GET /api/customers/:id', () => {
  it('AC-23: 200 con nombres de provincia y población y ETag', async () => {
    const created = (await create()).body;
    const res = await request(app).get(`/api/customers/${created.id}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...created, provinceName: quito.name, townName: 'Quito' });
    expect(res.headers.etag).toBe('"1"');
  });

  it('AC-24: 401 sin sesión', async () => {
    const res = await request(app).get(`/api/customers/${randomUUID()}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AC-25: 404 si no existe', async () => {
    const res = await request(app).get(`/api/customers/${randomUUID()}`).set(auth());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('AC-26: 400 si el id no es uuid', async () => {
    const res = await request(app).get('/api/customers/abc').set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/customers/:id', () => {
  const put = (id: string, b: object, ifMatch?: string, headers = auth()) => {
    const r = request(app).put(`/api/customers/${id}`).set(headers);
    if (ifMatch !== undefined) r.set('If-Match', ifMatch);
    return r.send(b);
  };

  it('AC-14: 200 actualiza, sube la versión y devuelve ETag', async () => {
    const c = (await create()).body;
    const nuevo = body({ name: 'Ana Nueva', status: 'inactive' });
    const res = await put(c.id, nuevo, '"1"');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...nuevo, id: c.id, version: 2 });
    expect(res.headers.etag).toBe('"2"');
    const otra = await put(c.id, nuevo, res.headers.etag);
    expect(otra.status).toBe(200);
    expect(otra.body.version).toBe(3);
  });

  it('AC-14: puede conservar su propio email', async () => {
    const c = (await create()).body;
    const res = await put(c.id, { ...body(), email: c.email }, '"1"');
    expect(res.status).toBe(200);
  });

  it('AC-15: 400 con datos no válidos, id no uuid o townId de otra provincia', async () => {
    const c = (await create()).body;
    expect((await put(c.id, { name: '' }, '"1"')).status).toBe(400);
    expect((await put('no-uuid', body(), '"1"')).status).toBe(400);
    const otraProv = await put(c.id, body({ townId: guayaquilTown._id }), '"1"');
    expect(otraProv.status).toBe(400);
    expect(otraProv.body.code).toBe('VALIDATION_ERROR');
  });

  it('AC-16: 401 sin sesión', async () => {
    const res = await request(app).put(`/api/customers/${randomUUID()}`).set('If-Match', '"1"').send(body());
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AC-17: 404 si no existe', async () => {
    const res = await put(randomUUID(), body(), '"1"');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('AC-18: 409 si el email es de otro cliente', async () => {
    const a = (await create()).body;
    const b = (await create()).body;
    const res = await put(b.id, { ...body(), email: a.email }, '"1"');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('AC-19: 412 si la versión ya no es la que se cargó, y no se guarda', async () => {
    const c = (await create()).body;
    await put(c.id, body(), '"1"');
    const res = await put(c.id, body({ name: 'Tarde' }), '"1"');
    expect(res.status).toBe(412);
    expect(res.body.code).toBe('PRECONDITION_FAILED');
    expect((await Customer.findById(c.id).lean())!.name).not.toBe('Tarde');
    expect((await put(c.id, body(), 'basura')).status).toBe(412);
  });

  it('AC-19: de dos PUT simultáneos con la misma versión, solo uno se guarda', async () => {
    const c = (await create()).body;
    const [x, y] = await Promise.all([put(c.id, body(), '"1"'), put(c.id, body(), '"1"')]);
    expect([x.status, y.status].sort()).toEqual([200, 412]);
  });

  it('AC-20: 428 si falta If-Match', async () => {
    const c = (await create()).body;
    const res = await put(c.id, body());
    expect(res.status).toBe(428);
    expect(res.body.code).toBe('PRECONDITION_REQUIRED');
  });

  it('AC-21: 400 si provinceId no existe', async () => {
    const c = (await create()).body;
    const res = await put(c.id, body({ provinceId: randomUUID() }), '"1"');
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('provinceId');
  });

  it('AC-22: 400 si townId no existe', async () => {
    const c = (await create()).body;
    const res = await put(c.id, body({ townId: randomUUID() }), '"1"');
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('townId');
  });
});

describe('DELETE /api/customers/:id', () => {
  it('AC-27: 204 y se borra de verdad', async () => {
    const c = (await create()).body;
    const res = await request(app).delete(`/api/customers/${c.id}`).set(auth());
    expect(res.status).toBe(204);
    expect(await Customer.findById(c.id)).toBeNull();
  });

  it('AC-28: 401 sin sesión', async () => {
    const res = await request(app).delete(`/api/customers/${randomUUID()}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AC-29: 404 si no existe', async () => {
    const res = await request(app).delete(`/api/customers/${randomUUID()}`).set(auth());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('AC-30: 409 IN_USE si otro dato lo cita, y no se borra', async () => {
    const c = (await create()).body;
    registerCustomerReference(async (id) => id === c.id);
    const res = await request(app).delete(`/api/customers/${c.id}`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IN_USE');
    expect(await Customer.findById(c.id)).not.toBeNull();
  });

  it('AC-31: 400 si el id no es uuid', async () => {
    const res = await request(app).delete('/api/customers/abc').set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/customers', () => {
  beforeAll(async () => {
    await Customer.deleteMany({});
    // Insertados desordenados y con nombres iguales para comprobar el orden name, id.
    const mk = (id: string, name: string, over: Record<string, unknown> = {}) => ({
      _id: id,
      name,
      email: `${id}@example.com`,
      streetAddress: 'x',
      provinceId: quito._id,
      townId: quitoTown._id,
      status: 'active',
      version: 1,
      ...over,
    });
    await Customer.create([
      mk('00000000-0000-4000-8000-000000000003', 'Carla'),
      mk('00000000-0000-4000-8000-000000000002', 'Beto'),
      mk('00000000-0000-4000-8000-000000000001', 'Beto'),
      mk('00000000-0000-4000-8000-000000000004', 'alba', { status: 'inactive' }),
      mk('00000000-0000-4000-8000-000000000005', 'Dora', { provinceId: guayas._id, townId: guayaquilTown._id }),
    ]);
  });

  const list = (q: Record<string, unknown> = {}) => request(app).get('/api/customers').query(q).set(auth());

  it('AC-01: 200 con items, total, page y pageSize; orden por name y a igualdad por id', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 5, page: 1, pageSize: 20 });
    expect(res.body.items.map((i: any) => i.id.slice(-1))).toEqual(['4', '1', '2', '3', '5']);
    expect(res.body.items[0]).toEqual({
      id: '00000000-0000-4000-8000-000000000004',
      name: 'alba',
      email: '00000000-0000-4000-8000-000000000004@example.com',
      provinceId: quito._id,
      provinceName: quito.name,
      townId: quitoTown._id,
      townName: 'Quito',
      status: 'inactive',
    });
  });

  it('AC-01: filtra por name, provinceId y status, y pagina', async () => {
    expect((await list({ name: 'bet' })).body.total).toBe(2);
    expect((await list({ provinceId: guayas._id })).body.items.map((i: any) => i.name)).toEqual(['Dora']);
    expect((await list({ status: 'inactive' })).body.total).toBe(1);
    const p2 = await list({ page: 2, pageSize: 2 });
    expect(p2.body).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(p2.body.items.map((i: any) => i.id.slice(-1))).toEqual(['2', '3']);
    expect((await list({ name: '.*' })).body.total).toBe(0);
  });

  it('AC-02: 401 sin sesión', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AC-03: 400 con parámetros no válidos', async () => {
    for (const q of [{ page: 0 }, { page: 'x' }, { pageSize: 101 }, { pageSize: 0 }, { status: 'otro' }, { provinceId: 'x' }, { name: 'x'.repeat(256) }]) {
      const res = await list(q);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('AC-04: 400 si provinceId no existe', async () => {
    const res = await list({ provinceId: randomUUID() });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('errores generales', () => {
  it('JSON mal formado da 400 y no 500', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .set('Content-Type', 'application/json')
      .send('{"roto": ');
    expect(res.status).toBe(400);
  });

  it('cuerpo ausente da 400', async () => {
    const res = await request(app).post('/api/customers').set(auth()).set('Idempotency-Key', randomUUID());
    expect(res.status).toBe(400);
  });
});
