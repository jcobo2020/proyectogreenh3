import { Request, Response, NextFunction } from 'express';
import {
  createCustomer,
  deleteCustomer,
  findCustomerById,
  listCustomers,
  updateCustomer,
} from '../services/CustomerService';

/**
 * @swagger
 * components:
 *   schemas:
 *     CustomerInput:
 *       type: object
 *       required: [name, email, streetAddress, provinceId, townId, status]
 *       properties:
 *         name: { type: string, maxLength: 255 }
 *         email: { type: string, maxLength: 255, format: email }
 *         streetAddress: { type: string, maxLength: 255 }
 *         provinceId: { type: string, format: uuid }
 *         townId: { type: string, format: uuid }
 *         status: { type: string, enum: [active, inactive] }
 *     Customer:
 *       allOf:
 *         - $ref: '#/components/schemas/CustomerInput'
 *         - type: object
 *           required: [id, version]
 *           properties:
 *             id: { type: string, format: uuid }
 *             version: { type: integer }
 *     CustomerDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/Customer'
 *         - type: object
 *           properties:
 *             provinceName: { type: string }
 *             townName: { type: string }
 *     CustomerListItem:
 *       type: object
 *       required: [id, provinceId, townId]
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         email: { type: string }
 *         provinceId: { type: string, format: uuid }
 *         provinceName: { type: string }
 *         townId: { type: string, format: uuid }
 *         townName: { type: string }
 *         status: { type: string }
 *     CustomerError:
 *       type: object
 *       required: [code, message]
 *       properties:
 *         code: { type: string, description: 'UNAUTHORIZED, VALIDATION_ERROR, CONFLICT, BUSINESS_RULE, NOT_FOUND, PRECONDITION_FAILED, PRECONDITION_REQUIRED o IN_USE' }
 *         message: { type: string }
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field: { type: string }
 *               message: { type: string }
 */

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Lista clientes paginados, ordenados por name y a igualdad por id
 *     description: Los nombres de provincia y población salen con JOIN ($lookup) en la misma consulta de la página.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: name, schema: { type: string, maxLength: 255 } }
 *       - { in: query, name: provinceId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string, enum: [active, inactive] } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200:
 *         description: Página de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [items, total, page, pageSize]
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/CustomerListItem' } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       400: { description: VALIDATION_ERROR, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 */
export async function getCustomers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listCustomers(res.locals.listQuery));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Crea un cliente (idempotente por Idempotency-Key)
 *     description: >
 *       La clave se guarda por usuario con su respuesta 24 horas. Repetida con el mismo cuerpo devuelve
 *       la misma respuesta con Idempotent-Replayed true; con otro cuerpo, 422.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: header, name: Idempotency-Key, required: true, schema: { type: string, maxLength: 255 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CustomerInput' }
 *     responses:
 *       201:
 *         description: Cliente creado (cabecera ETag con su versión)
 *         headers:
 *           ETag: { schema: { type: string } }
 *           Idempotent-Replayed: { schema: { type: string, example: 'true' } }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       400: { description: 'VALIDATION_ERROR: datos, provinceId/townId inexistentes, townId de otra provincia o falta Idempotency-Key', content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       409: { description: CONFLICT, email repetido, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       422: { description: BUSINESS_RULE, Idempotency-Key usada con otro cuerpo, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 */
export async function postCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await createCustomer(res.locals.userId, res.locals.idempotencyKey, req.body);
    if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
    const version = (result.body as { version?: number }).version;
    if (result.status === 201 && version !== undefined) res.setHeader('ETag', `"${version}"`);
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Detalle de un cliente, con nombres de provincia y población
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Cliente (cabecera ETag con su versión)
 *         headers:
 *           ETag: { schema: { type: string } }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CustomerDetail' }
 *       400: { description: VALIDATION_ERROR, id no es un UUID, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       404: { description: NOT_FOUND, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 */
export async function getCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customer = await findCustomerById(req.params.id as string);
    res.setHeader('ETag', `"${customer.version}"`);
    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: Actualiza un cliente con control de versión (If-Match)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: header, name: If-Match, required: true, schema: { type: string }, description: 'El ETag recibido, tal cual (con comillas)' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CustomerInput' }
 *     responses:
 *       200:
 *         description: Cliente actualizado (cabecera ETag con su nueva versión)
 *         headers:
 *           ETag: { schema: { type: string } }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Customer' }
 *       400: { description: 'VALIDATION_ERROR: datos, id, provinceId/townId inexistentes o townId de otra provincia', content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       404: { description: NOT_FOUND, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       409: { description: CONFLICT, email repetido, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       412: { description: PRECONDITION_FAILED, otro lo cambió; no se guarda, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       428: { description: PRECONDITION_REQUIRED, falta If-Match, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 */
export async function putCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customer = await updateCustomer(req.params.id as string, res.locals.input, res.locals.expectedVersion);
    res.setHeader('ETag', `"${customer.version}"`);
    res.status(200).json(customer);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Borra un cliente (borrado físico) si ningún otro dato lo cita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204: { description: Borrado }
 *       400: { description: VALIDATION_ERROR, id no es un UUID, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       404: { description: NOT_FOUND, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 *       409: { description: IN_USE, otro dato lo cita; no se borra, content: { application/json: { schema: { $ref: '#/components/schemas/CustomerError' } } } }
 */
export async function removeCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteCustomer(req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
