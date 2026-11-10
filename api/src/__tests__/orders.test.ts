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
import { Order } from '../models/order';
import { seedProvinces } from '../services/ProvinceSeedService';
import { seedTowns } from '../services/TownSeedService';
import { formatOrderNumber } from '../services/OrderService';

let repl: MongoMemoryReplSet;
const secret = randomBytes(32).toString('hex');
const app = createApp();
const tokenFor = (sub: string, permissions: string[]) => jwt.sign({ sub, permissions }, secret, { algorithm: 'HS256' });
const ALL = ['pedidos.consultar', 'pedidos.gestionar'];
const auth = (sub = 'user-1', permissions: string[] = ALL) => ({ Authorization: `Bearer ${tokenFor(sub, permissions)}` });
const onlyView = () => auth('user-1', ['pedidos.consultar']);
const onlyManage = () => auth('user-1', ['pedidos.gestionar']);
const noPerms = () => auth('user-1', []);

let customerA: any;
let customerB: any;

const orderBody = (over: Record<string, unknown> = {}) => ({
  customerId: customerA._id,
  date: '2026-05-10',
  amount: 150.5,
  ...over,
});
const create = (b: object = orderBody(), key: string = randomUUID(), headers = auth()) =>
  request(app).post('/api/orders').set(headers).set('Idempotency-Key', key).send(b);

// Inserta un pedido directamente con el estado que haga falta.
let n = 0;
async function insertOrder(over: Record<string, unknown> = {}) {
  const doc = await Order.create({
    number: `TEST-${++n}`,
    customerId: customerA._id,
    date: '2026-01-01',
    amount: 10,
    status: 'pending',
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
  await Order.init();
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

describe('GET /api/orders', () => {
  beforeAll(async () => {
    await Order.deleteMany({});
    await insertOrder({ date: '2026-02-01', customerId: customerA._id, status: 'pending' });
    await insertOrder({ date: '2026-03-01', customerId: customerB._id, status: 'confirmed' });
    await insertOrder({ date: '2026-03-01', customerId: customerA._id, status: 'confirmed' });
    await insertOrder({ date: '2026-01-15', customerId: customerB._id, status: 'pending' });
  });

  it('AC-01: 200 ordenada por date desc y a igualdad por id, con customerName', async () => {
    const res = await request(app).get('/api/orders').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, page: 1, pageSize: 20 });
    const items = res.body.items;
    expect(items.map((i: any) => i.date)).toEqual(['2026-03-01', '2026-03-01', '2026-02-01', '2026-01-15']);
    expect(items[0].id < items[1].id).toBe(true);
    expect(items[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), number: expect.any(String), amount: 10, status: 'confirmed' }),
    );
    const names: Record<string, string> = { [customerA._id]: 'Ana Pérez', [customerB._id]: 'Beto Díaz' };
    for (const i of items) expect(i.customerName).toBe(names[i.customerId]);
  });

  it('AC-01: filtra por customerId y status, y pagina', async () => {
    const byCustomer = await request(app).get(`/api/orders?customerId=${customerA._id}`).set(auth());
    expect(byCustomer.body.total).toBe(2);
    const byStatus = await request(app).get('/api/orders?status=confirmed').set(auth());
    expect(byStatus.body.total).toBe(2);
    const both = await request(app).get(`/api/orders?status=pending&customerId=${customerB._id}`).set(auth());
    expect(both.body.total).toBe(1);
    const page = await request(app).get('/api/orders?page=2&pageSize=3').set(auth());
    expect(page.body.items).toHaveLength(1);
    expect(page.body).toMatchObject({ total: 4, page: 2, pageSize: 3 });
  });

  it('AC-01: el nombre del cliente se lee al responder (no es una copia)', async () => {
    await Customer.updateOne({ _id: customerB._id }, { name: 'Beto Nuevo' });
    const res = await request(app).get(`/api/orders?customerId=${customerB._id}`).set(auth());
    expect(res.body.items.every((i: any) => i.customerName === 'Beto Nuevo')).toBe(true);
    await Customer.updateOne({ _id: customerB._id }, { name: 'Beto Díaz' });
  });

  it('AC-02: 401 sin sesión válida', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    const bad = await request(app).get('/api/orders').set('Authorization', 'Bearer xyz');
    expect(bad.status).toBe(401);
  });

  it('AC-03 / RN-01: 403 sin pedidos.consultar; con él ve todas las filas', async () => {
    const res = await request(app).get('/api/orders').set(onlyManage());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    const sinPermisos = await request(app).get('/api/orders').set(noPerms());
    expect(sinPermisos.status).toBe(403);
    // otro usuario, mismo permiso: ve las mismas filas (no se filtra por quien entra)
    const otro = await request(app).get('/api/orders').set(auth('otro-usuario', ['pedidos.consultar']));
    expect(otro.status).toBe(200);
    expect(otro.body.total).toBe(4);
  });

  it('AC-04: 400 con parámetros no válidos', async () => {
    for (const q of ['page=0', 'page=abc', 'pageSize=0', 'pageSize=101', 'status=otro', 'customerId=no-uuid']) {
      const res = await request(app).get(`/api/orders?${q}`).set(auth());
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.details)).toBe(true);
    }
  });

  it('AC-05: 400 si customerId no existe en customers', async () => {
    const res = await request(app).get(`/api/orders?customerId=${randomUUID()}`).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/orders', () => {
  it('AC-06: 201 con id, datos y status pending; el number es correlativo', async () => {
    const b = orderBody();
    const res = await create(b);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), ...b, status: 'pending' });
    expect(res.headers['idempotent-replayed']).toBeUndefined();
    const saved = await Order.findById(res.body.id).lean();
    expect(saved!.number).toMatch(/^PED-\d{6}$/);
    const second = await create(b);
    const saved2 = await Order.findById(second.body.id).lean();
    expect(Number(saved2!.number.slice(4))).toBe(Number(saved!.number.slice(4)) + 1);
    expect(formatOrderNumber(7)).toBe('PED-000007');
  });

  it('AC-07: 400 con datos no válidos o sin Idempotency-Key', async () => {
    const malo = await create({ customerId: 'x', date: '2026-13-40', amount: 'mucho' });
    expect(malo.status).toBe(400);
    expect(malo.body.code).toBe('VALIDATION_ERROR');
    expect(malo.body.details.map((d: any) => d.field)).toEqual(
      expect.arrayContaining(['customerId', 'date', 'amount']),
    );
    const negativo = await create(orderBody({ amount: -1 }));
    expect(negativo.status).toBe(400);
    const sinCuerpo = await request(app).post('/api/orders').set(auth()).set('Idempotency-Key', randomUUID());
    expect(sinCuerpo.status).toBe(400);
    const sinClave = await request(app).post('/api/orders').set(auth()).send(orderBody());
    expect(sinClave.status).toBe(400);
    expect(sinClave.body.code).toBe('VALIDATION_ERROR');
    const claveLarga = await create(orderBody(), 'k'.repeat(256));
    expect(claveLarga.status).toBe(400);
  });

  it('AC-08: 401 sin sesión válida', async () => {
    const res = await request(app).post('/api/orders').set('Idempotency-Key', randomUUID()).send(orderBody());
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AC-41 / RN-01: 403 sin pedidos.gestionar', async () => {
    const res = await create(orderBody(), randomUUID(), onlyView());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('AC-09: 422 con la misma clave y otro cuerpo u otra operación', async () => {
    const key = randomUUID();
    expect((await create(orderBody(), key)).status).toBe(201);
    const otroCuerpo = await create(orderBody({ amount: 999 }), key);
    expect(otroCuerpo.status).toBe(422);
    expect(otroCuerpo.body.code).toBe('BUSINESS_RULE');
    // la misma clave ya usada por la operación de clientes
    const keyCustomers = randomUUID();
    await IdempotencyKey.create({
      userId: 'user-1',
      key: keyCustomers,
      operation: 'POST /api/customers',
      requestHash: 'x',
      responseStatus: 201,
      responseBody: {},
      expiresAt: new Date(Date.now() + 60000),
    });
    const otraOperacion = await create(orderBody(), keyCustomers);
    expect(otraOperacion.status).toBe(422);
  });

  it('AC-10: 400 si customerId no existe, y no crea nada', async () => {
    const antes = await Order.countDocuments();
    const res = await create(orderBody({ customerId: randomUUID() }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(await Order.countDocuments()).toBe(antes);
  });

  it('AC-11: misma clave y mismo cuerpo → mismo 201 con Idempotent-Replayed y sin crear otro', async () => {
    const key = randomUUID();
    const b = orderBody();
    const first = await create(b, key);
    const antes = await Order.countDocuments();
    const second = await create(b, key);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(await Order.countDocuments()).toBe(antes);
  });

  it('AC-11: un 4xx también se repite igual; la clave es por usuario; la caducada vale de nuevo', async () => {
    const key = randomUUID();
    const malo = { customerId: 'x' };
    const first = await create(malo, key);
    const second = await create(malo, key);
    expect(second.status).toBe(400);
    expect(second.body).toEqual(first.body);
    expect(second.headers['idempotent-replayed']).toBe('true');

    const compartida = randomUUID();
    const deA = await create(orderBody(), compartida, auth('usuario-a'));
    const deB = await create(orderBody(), compartida, auth('usuario-b'));
    expect(deB.status).toBe(201);
    expect(deB.body.id).not.toBe(deA.body.id);
    expect(deB.headers['idempotent-replayed']).toBeUndefined();

    await IdempotencyKey.updateOne({ userId: 'usuario-a', key: compartida }, { expiresAt: new Date(Date.now() - 1000) });
    const nueva = await create(orderBody(), compartida, auth('usuario-a'));
    expect(nueva.status).toBe(201);
    expect(nueva.body.id).not.toBe(deA.body.id);
    expect(nueva.headers['idempotent-replayed']).toBeUndefined();
  });

  it('AC-12: dos envíos a la vez con la misma clave crean uno solo', async () => {
    const key = randomUUID();
    const b = orderBody({ amount: 77 });
    const antes = await Order.countDocuments();
    const [r1, r2] = await Promise.all([create(b, key), create(b, key)]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body).toEqual(r2.body);
    const replays = [r1, r2].filter((r) => r.headers['idempotent-replayed'] === 'true');
    expect(replays).toHaveLength(1);
    expect(await Order.countDocuments()).toBe(antes + 1);
  });

  it('altas a la vez con claves distintas reciben numbers distintos', async () => {
    const res = await Promise.all(Array.from({ length: 4 }, () => create()));
    expect(res.every((r) => r.status === 201)).toBe(true);
    const numbers = (await Order.find({ _id: { $in: res.map((r) => r.body.id) } }).lean()).map((o) => o.number);
    expect(new Set(numbers).size).toBe(4);
  });
});

describe('GET /api/orders/:id', () => {
  it('AC-25: 200 con number y customerName', async () => {
    const o = await insertOrder({ amount: 42 });
    const res = await request(app).get(`/api/orders/${o._id}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: o._id,
      customerId: customerA._id,
      date: '2026-01-01',
      amount: 42,
      number: o.number,
      status: 'pending',
      customerName: 'Ana Pérez',
    });
  });

  it('AC-26: 401 sin sesión', async () => {
    const res = await request(app).get(`/api/orders/${randomUUID()}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AC-27: 404 si no existe', async () => {
    const res = await request(app).get(`/api/orders/${randomUUID()}`).set(auth());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('AC-28: 400 si el id no es un UUID', async () => {
    const res = await request(app).get('/api/orders/no-uuid').set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AC-42 / RN-01: 403 sin pedidos.consultar; con él ve el que creó otro', async () => {
    const o = await insertOrder();
    const res = await request(app).get(`/api/orders/${o._id}`).set(onlyManage());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    const otro = await request(app).get(`/api/orders/${o._id}`).set(auth('otro', ['pedidos.consultar']));
    expect(otro.status).toBe(200);
  });
});

type Case = {
  name: string;
  path: 'confirm' | 'ship' | 'deliver' | 'cancel';
  from: string;
  to: string;
  body?: object;
  ok: string;
  ac: { ok: string; val: string; unauth: string; forbidden: string; notFound: string; conflict: string };
  conflictFrom: string;
};

const cases: Case[] = [
  {
    name: 'confirm',
    path: 'confirm',
    from: 'pending',
    to: 'confirmed',
    ok: 'AC-29',
    ac: { ok: 'AC-29', val: 'AC-34', unauth: 'AC-30', forbidden: 'AC-31', notFound: 'AC-32', conflict: 'AC-33' },
    conflictFrom: 'shipped',
  },
  {
    name: 'ship',
    path: 'ship',
    from: 'confirmed',
    to: 'shipped',
    body: { carrier: 'DHL', shippingDate: '2026-06-01' },
    ok: 'AC-13',
    ac: { ok: 'AC-13', val: 'AC-14', unauth: 'AC-15', forbidden: 'AC-16', notFound: 'AC-17', conflict: 'AC-18' },
    conflictFrom: 'pending',
  },
  {
    name: 'cancel',
    path: 'cancel',
    from: 'pending',
    to: 'cancelled',
    body: { cancellationReason: 'El cliente se arrepintió' },
    ok: 'AC-19',
    ac: { ok: 'AC-19', val: 'AC-20', unauth: 'AC-21', forbidden: 'AC-22', notFound: 'AC-23', conflict: 'AC-24' },
    conflictFrom: 'delivered',
  },
  {
    name: 'deliver',
    path: 'deliver',
    from: 'shipped',
    to: 'delivered',
    ok: 'AC-35',
    ac: { ok: 'AC-35', val: 'AC-40', unauth: 'AC-36', forbidden: 'AC-37', notFound: 'AC-38', conflict: 'AC-39' },
    conflictFrom: 'pending',
  },
];

describe.each(cases)('POST /api/orders/:id/$name', (c) => {
  const post = (id: string, headers: Record<string, string> = auth(), body: object | undefined = c.body) => {
    const r = request(app).post(`/api/orders/${id}/${c.path}`).set(headers);
    return body ? r.send(body) : r.send();
  };

  it(`${c.ac.ok}: 200 y queda ${c.to}`, async () => {
    const o = await insertOrder({ status: c.from, amount: 33 });
    const res = await post(o._id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: o._id, customerId: customerA._id, date: '2026-01-01', amount: 33, status: c.to });
    if (c.body) expect(res.body).toMatchObject(c.body);
    const saved = await Order.findById(o._id).lean();
    expect(saved!.status).toBe(c.to);
  });

  it(`${c.ac.val}: 400 con id que no es UUID${c.body ? ' y con datos no válidos' : ''}`, async () => {
    const res = await post('no-uuid');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    if (c.body) {
      const o = await insertOrder({ status: c.from });
      const sinCuerpo = await post(o._id, auth(), {});
      expect(sinCuerpo.status).toBe(400);
      expect(sinCuerpo.body.details.length).toBeGreaterThan(0);
      const largo = await post(
        o._id,
        auth(),
        c.path === 'ship' ? { carrier: 'x'.repeat(256), shippingDate: '2026-06-01' } : { cancellationReason: 'x'.repeat(2001) },
      );
      expect(largo.status).toBe(400);
      if (c.path === 'ship') {
        const fecha = await post(o._id, auth(), { carrier: 'DHL', shippingDate: '01/06/2026' });
        expect(fecha.status).toBe(400);
      }
      expect((await Order.findById(o._id).lean())!.status).toBe(c.from);
    }
  });

  it(`${c.ac.unauth}: 401 sin sesión válida`, async () => {
    const res = await request(app).post(`/api/orders/${randomUUID()}/${c.path}`).send(c.body ?? {});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it(`${c.ac.forbidden} / RN-01: 403 sin pedidos.gestionar; con él cambia el de otro`, async () => {
    const o = await insertOrder({ status: c.from });
    const res = await post(o._id, onlyView());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect((await Order.findById(o._id).lean())!.status).toBe(c.from);
    const otro = await post(o._id, auth('otro-usuario', ['pedidos.gestionar']));
    expect(otro.status).toBe(200);
  });

  it(`${c.ac.notFound}: 404 si no existe`, async () => {
    const res = await post(randomUUID());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it(`${c.ac.conflict}: 409 desde un estado que no vale, y si otra petición lo cambió antes`, async () => {
    const o = await insertOrder({ status: c.conflictFrom });
    const res = await post(o._id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
    expect((await Order.findById(o._id).lean())!.status).toBe(c.conflictFrom);

    // dos peticiones a la vez: solo una gana
    const p = await insertOrder({ status: c.from });
    const [a, b] = await Promise.all([post(p._id), post(p._id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });
});

describe('transiciones completas y cancelación', () => {
  it('flujo pending → confirmed → shipped → delivered', async () => {
    const created = await create();
    const id = created.body.id;
    expect((await request(app).post(`/api/orders/${id}/confirm`).set(auth())).body.status).toBe('confirmed');
    const shipped = await request(app)
      .post(`/api/orders/${id}/ship`)
      .set(auth())
      .send({ carrier: 'Servientrega', shippingDate: '2026-06-02' });
    expect(shipped.body).toMatchObject({ status: 'shipped', carrier: 'Servientrega', shippingDate: '2026-06-02' });
    expect((await request(app).post(`/api/orders/${id}/deliver`).set(auth())).body.status).toBe('delivered');
    const again = await request(app).post(`/api/orders/${id}/cancel`).set(auth()).send({ cancellationReason: 'tarde' });
    expect(again.status).toBe(409);
  });

  it('cancel vale desde confirmed y no desde cancelled', async () => {
    const o = await insertOrder({ status: 'confirmed' });
    const res = await request(app).post(`/api/orders/${o._id}/cancel`).set(auth()).send({ cancellationReason: 'x' });
    expect(res.status).toBe(200);
    expect(res.body.cancellationReason).toBe('x');
    const again = await request(app).post(`/api/orders/${o._id}/cancel`).set(auth()).send({ cancellationReason: 'x' });
    expect(again.status).toBe(409);
  });
});

describe('clientes con pedidos', () => {
  it('borrar un cliente que tiene pedidos lo impide (IN_USE)', async () => {
    const quito: any = await Province.findOne({ code: '17' }).lean();
    const town: any = await Town.findOne({ provinceId: quito._id }).lean();
    const c = (
      await Customer.create({
        name: 'Con pedidos',
        email: 'conpedidos@example.com',
        streetAddress: 'Calle 2',
        provinceId: quito._id,
        townId: town._id,
        status: 'active',
      })
    ).toObject();
    await insertOrder({ customerId: c._id });
    const res = await request(app).delete(`/api/customers/${c._id}`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IN_USE');
  });
});

describe('Swagger', () => {
  it('documenta los endpoints de pedidos', async () => {
    const { swaggerSpec } = await import('../config/swagger');
    const paths = Object.keys((swaggerSpec as any).paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/orders',
        '/api/orders/{id}',
        '/api/orders/{id}/confirm',
        '/api/orders/{id}/ship',
        '/api/orders/{id}/deliver',
        '/api/orders/{id}/cancel',
      ]),
    );
  });
});
