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
import { Counter } from '../models/counter';
import { Invoice } from '../models/invoice';
import { seedProvinces } from '../services/ProvinceSeedService';
import { seedTowns } from '../services/TownSeedService';
import { formatInvoiceNumber } from '../services/InvoiceService';

let repl: MongoMemoryReplSet;
const secret = randomBytes(32).toString('hex');
const app = createApp();
const auth = (sub = 'user-1') => ({
  Authorization: `Bearer ${jwt.sign({ sub, permissions: [] }, secret, { algorithm: 'HS256' })}`,
});

let customerA: any;
let customerB: any;

const invoiceBody = (over: Record<string, unknown> = {}) => ({
  customerId: customerA._id,
  date: '2026-05-10',
  amount: 150.5,
  ...over,
});
const create = (b: object = invoiceBody(), key: string = randomUUID(), headers = auth()) =>
  request(app).post('/api/invoices').set(headers).set('Idempotency-Key', key).send(b);

let n = 0;
async function insertInvoice(over: Record<string, unknown> = {}) {
  const doc = await Invoice.create({
    number: `TEST-${++n}`,
    customerId: customerA._id,
    date: '2026-01-01',
    amount: 10,
    ...over,
  });
  return doc.toObject();
}

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDB(repl.getUri());
  await seedProvinces();
  await seedTowns();
  await Customer.init();
  await IdempotencyKey.init();
  await Counter.init();
  await Invoice.init();
  const quito: any = await Province.findOne({ code: '17' }).lean();
  const town: any = await Town.findOne({ provinceId: quito._id }).lean();
  const base = { streetAddress: 'Calle 1', provinceId: quito._id, townId: town._id, status: 'active' };
  customerA = (await Customer.create({ ...base, name: 'Ana Pérez', email: 'ana@example.com' })).toObject();
  customerB = (await Customer.create({ ...base, name: 'Beto Díaz', email: 'beto@example.com' })).toObject();
});

afterAll(async () => {
  await mongoose.disconnect();
  await repl.stop();
});

describe('POST /api/invoices', () => {
  it('AC-01: 201 con id, datos enviados, number y customerName', async () => {
    const res = await create(invoiceBody({ date: '2026-03-05', amount: 99.99 }));
    expect(res.status).toBe(201);
    expect(res.headers['idempotent-replayed']).toBeUndefined();
    expect(res.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      customerId: customerA._id,
      date: '2026-03-05',
      amount: 99.99,
      number: expect.stringMatching(/^F-2026-\d{6}$/),
      customerName: 'Ana Pérez',
    });
    expect(await Invoice.exists({ _id: res.body.id })).toBeTruthy();
  });

  it('number correlativo por año de la factura, con 6 cifras y vuelve a 000001 cada año', async () => {
    expect(formatInvoiceNumber('2025', 7)).toBe('F-2025-000007');
    const a = await create(invoiceBody({ date: '2024-02-01' }));
    const b = await create(invoiceBody({ date: '2024-09-01' }));
    const c = await create(invoiceBody({ date: '2023-09-01' }));
    expect(a.body.number).toBe('F-2024-000001');
    expect(b.body.number).toBe('F-2024-000002');
    expect(c.body.number).toBe('F-2023-000001');
  });

  it('AC-02: 400 con datos no válidos (y detalles por campo)', async () => {
    const res = await create({ customerId: 'x', date: '2026-13-40', amount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.map((d: any) => d.field).sort()).toEqual(['amount', 'customerId', 'date']);
  });

  it('AC-02: 400 con fecha posterior a hoy, importe menor que 0.01 y cuerpo que no es objeto', async () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const r1 = await create(invoiceBody({ date: future }));
    expect(r1.status).toBe(400);
    expect(r1.body.details).toEqual([{ field: 'date', message: 'no puede ser posterior a hoy' }]);
    expect((await create(invoiceBody({ amount: 0.001 }))).status).toBe(400);
    expect((await create(invoiceBody({ amount: '5' }))).status).toBe(400);
    expect((await create([] as any)).status).toBe(400);
    const today = new Date().toISOString().slice(0, 10);
    expect((await create(invoiceBody({ date: today, amount: 0.01 }))).status).toBe(201);
  });

  it('AC-02: 400 si falta la cabecera Idempotency-Key', async () => {
    const res = await request(app).post('/api/invoices').set(auth()).send(invoiceBody());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const long = await create(invoiceBody(), 'k'.repeat(256));
    expect(long.status).toBe(400);
  });

  it('AC-03: 401 sin sesión válida', async () => {
    const r1 = await request(app).post('/api/invoices').set('Idempotency-Key', randomUUID()).send(invoiceBody());
    expect(r1.status).toBe(401);
    expect(r1.body.code).toBe('UNAUTHORIZED');
    const r2 = await create(invoiceBody(), randomUUID(), { Authorization: 'Bearer mal' });
    expect(r2.status).toBe(401);
  });

  it('AC-04: 422 si la clave se usó con otro cuerpo', async () => {
    const key = randomUUID();
    expect((await create(invoiceBody(), key)).status).toBe(201);
    const before = await Invoice.countDocuments();
    const res = await create(invoiceBody({ amount: 1 }), key);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BUSINESS_RULE');
    expect(await Invoice.countDocuments()).toBe(before);
  });

  it('AC-05: 400 si customerId no existe', async () => {
    const res = await create(invoiceBody({ customerId: randomUUID() }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details[0].field).toBe('customerId');
  });

  it('AC-06: la misma clave y cuerpo devuelve el mismo 201 con Idempotent-Replayed y no crea otro', async () => {
    const key = randomUUID();
    const b = invoiceBody({ amount: 12 });
    const first = await create(b, key);
    const before = await Invoice.countDocuments();
    const second = await create(b, key);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await Invoice.countDocuments()).toBe(before);
  });

  it('un 4xx se guarda y se repite igual con la misma clave; la clave de otro usuario es otra', async () => {
    const key = randomUUID();
    const bad = invoiceBody({ customerId: randomUUID() });
    const first = await create(bad, key);
    const again = await create(bad, key);
    expect(again.status).toBe(400);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body).toEqual(first.body);
    const other = await create(invoiceBody(), key, auth('user-2'));
    expect(other.status).toBe(201);
    expect(other.headers['idempotent-replayed']).toBeUndefined();
  });

  it('una clave caducada vale para un envío nuevo', async () => {
    const key = randomUUID();
    const first = await create(invoiceBody(), key);
    await IdempotencyKey.updateOne({ key }, { expiresAt: new Date(Date.now() - 1000) });
    const second = await create(invoiceBody({ amount: 3 }), key);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBeUndefined();
    expect(second.body.id).not.toBe(first.body.id);
  });

  it('AC-07: dos envíos a la vez con la misma clave crean uno solo', async () => {
    const key = randomUUID();
    const b = invoiceBody({ amount: 77 });
    const before = await Invoice.countDocuments();
    const [r1, r2] = await Promise.all([create(b, key), create(b, key)]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body).toEqual(r2.body);
    expect([r1, r2].filter((r) => r.headers['idempotent-replayed'] === 'true')).toHaveLength(1);
    expect(await Invoice.countDocuments()).toBe(before + 1);
  });

  it('altas a la vez con claves distintas reciben numbers distintos', async () => {
    const res = await Promise.all(Array.from({ length: 4 }, () => create(invoiceBody({ date: '2022-01-01' }))));
    expect(res.every((r) => r.status === 201)).toBe(true);
    expect(new Set(res.map((r) => r.body.number)).size).toBe(4);
  });
});

describe('GET /api/invoices', () => {
  beforeAll(async () => {
    await Invoice.deleteMany({});
    await insertInvoice({ date: '2026-02-01', customerId: customerA._id });
    await insertInvoice({ date: '2026-03-01', customerId: customerB._id });
    await insertInvoice({ date: '2026-03-01', customerId: customerA._id });
    await insertInvoice({ date: '2026-01-15', customerId: customerB._id });
  });

  it('AC-08: 200 ordenada por date desc (y a igualdad por id), con customerName', async () => {
    const res = await request(app).get('/api/invoices').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, page: 1, pageSize: 20 });
    expect(res.body.items.map((i: any) => i.date)).toEqual(['2026-03-01', '2026-03-01', '2026-02-01', '2026-01-15']);
    const ids = [res.body.items[0].id, res.body.items[1].id];
    expect(ids).toEqual([...ids].sort());
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      ['amount', 'customerId', 'customerName', 'date', 'id', 'number'].sort(),
    );
    const names = res.body.items.map((i: any) => `${i.customerId === customerA._id}:${i.customerName}`);
    expect(names).toContain('true:Ana Pérez');
    expect(names).toContain('false:Beto Díaz');
  });

  it('AC-08: filtra por customerId y pagina', async () => {
    const f = await request(app).get('/api/invoices').query({ customerId: customerB._id }).set(auth());
    expect(f.body.total).toBe(2);
    expect(f.body.items.every((i: any) => i.customerId === customerB._id)).toBe(true);
    const p = await request(app).get('/api/invoices').query({ page: 2, pageSize: 3 }).set(auth());
    expect(p.body).toMatchObject({ total: 4, page: 2, pageSize: 3 });
    expect(p.body.items.map((i: any) => i.date)).toEqual(['2026-01-15']);
  });

  it('el nombre se lee al responder: si cambia el cliente, se ve el nuevo', async () => {
    await Customer.updateOne({ _id: customerB._id }, { name: 'Beto Nuevo' });
    const res = await request(app).get('/api/invoices').query({ customerId: customerB._id }).set(auth());
    expect(res.body.items[0].customerName).toBe('Beto Nuevo');
  });

  it('AC-09: 401 sin sesión válida', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AC-10: 400 con un parámetro no válido', async () => {
    for (const q of [{ page: 0 }, { page: 'a' }, { pageSize: 101 }, { pageSize: 0 }, { customerId: 'no-uuid' }]) {
      const res = await request(app).get('/api/invoices').query(q).set(auth());
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('AC-11: 400 si customerId no existe', async () => {
    const res = await request(app).get('/api/invoices').query({ customerId: randomUUID() }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('RN-01: todos ven todo', () => {
  it('AC-12: cada cuenta ve también las facturas que creó la otra', async () => {
    const a = await create(invoiceBody({ amount: 11 }), randomUUID(), auth('user-A'));
    const b = await create(invoiceBody({ amount: 22 }), randomUUID(), auth('user-B'));
    for (const who of ['user-A', 'user-B']) {
      const res = await request(app).get('/api/invoices').query({ pageSize: 100 }).set(auth(who));
      const ids = res.body.items.map((i: any) => i.id);
      expect(ids).toEqual(expect.arrayContaining([a.body.id, b.body.id]));
    }
  });
});

describe('integración con clientes', () => {
  it('no se borra un cliente con facturas (IN_USE)', async () => {
    const c = (
      await Customer.create({
        name: 'Con Factura',
        email: 'cf@example.com',
        streetAddress: 'Calle 2',
        provinceId: customerA.provinceId,
        townId: customerA.townId,
        status: 'active',
      })
    ).toObject();
    expect((await create(invoiceBody({ customerId: c._id }))).status).toBe(201);
    const res = await request(app).delete(`/api/customers/${c._id}`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IN_USE');
  });
});
