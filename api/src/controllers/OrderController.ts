import { Request, Response, NextFunction } from 'express';
import {
  cancelOrder,
  confirmOrder,
  createOrder,
  deliverOrder,
  findOrderById,
  listOrders,
  shipOrder,
} from '../services/OrderService';

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderInput:
 *       type: object
 *       required: [customerId, date, amount]
 *       properties:
 *         customerId: { type: string, format: uuid }
 *         date: { type: string, format: date }
 *         amount: { type: number }
 *     Order:
 *       type: object
 *       required: [id, status]
 *       properties:
 *         id: { type: string, format: uuid }
 *         customerId: { type: string, format: uuid }
 *         date: { type: string, format: date }
 *         amount: { type: number }
 *         status: { type: string, enum: [pending, confirmed, shipped, delivered, cancelled] }
 *     OrderShipped:
 *       allOf:
 *         - $ref: '#/components/schemas/Order'
 *         - type: object
 *           properties:
 *             carrier: { type: string }
 *             shippingDate: { type: string, format: date }
 *     OrderCancelled:
 *       allOf:
 *         - $ref: '#/components/schemas/Order'
 *         - type: object
 *           properties:
 *             cancellationReason: { type: string }
 *     OrderDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/Order'
 *         - type: object
 *           properties:
 *             number: { type: string }
 *             customerName: { type: string }
 *     OrderListItem:
 *       type: object
 *       required: [id, customerId]
 *       properties:
 *         id: { type: string, format: uuid }
 *         number: { type: string }
 *         customerId: { type: string, format: uuid }
 *         customerName: { type: string }
 *         date: { type: string, format: date }
 *         amount: { type: number }
 *         status: { type: string }
 *     OrderError:
 *       type: object
 *       required: [code, message]
 *       properties:
 *         code: { type: string, description: 'UNAUTHORIZED, FORBIDDEN, VALIDATION_ERROR, BUSINESS_RULE, NOT_FOUND o CONFLICT' }
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
 * /api/orders:
 *   get:
 *     summary: Lista de pedidos (permiso pedidos.consultar), por date descendente y a igualdad por id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: customerId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, confirmed, shipped, delivered, cancelled] } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200:
 *         description: Página de pedidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/OrderListItem' } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       400: { description: VALIDATION_ERROR (parámetro no válido o customerId inexistente), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       403: { description: FORBIDDEN (sin pedidos.consultar), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 */
export async function getOrders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listOrders(res.locals.listQuery));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Crea un pedido en estado pending (permiso pedidos.gestionar; idempotente)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: header, name: Idempotency-Key, required: true, schema: { type: string, maxLength: 255 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OrderInput' }
 *     responses:
 *       201:
 *         description: Pedido creado (si la clave se repite, mismo cuerpo y cabecera Idempotent-Replayed true)
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } }
 *       400: { description: VALIDATION_ERROR (datos, falta Idempotency-Key o customerId inexistente), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       403: { description: FORBIDDEN (sin pedidos.gestionar), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       422: { description: BUSINESS_RULE, Idempotency-Key usada con otro cuerpo u otra operación, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 */
export async function postOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await createOrder(res.locals.userId, res.locals.idempotencyKey, req.body);
    if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Detalle de un pedido, con number y nombre del cliente (permiso pedidos.consultar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Pedido, content: { application/json: { schema: { $ref: '#/components/schemas/OrderDetail' } } } }
 *       400: { description: VALIDATION_ERROR (id no es un UUID), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       403: { description: FORBIDDEN (sin pedidos.consultar), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       404: { description: NOT_FOUND, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 */
export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await findOrderById(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/orders/{id}/confirm:
 *   post:
 *     summary: Confirma un pedido (pending → confirmed; permiso pedidos.gestionar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Pedido confirmado, content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
 *       400: { description: VALIDATION_ERROR (id no es un UUID), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       403: { description: FORBIDDEN (sin pedidos.gestionar), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       404: { description: NOT_FOUND, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       409: { description: CONFLICT (solo desde pending), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 */
export async function postConfirmOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await confirmOrder(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/orders/{id}/ship:
 *   post:
 *     summary: Envía un pedido (confirmed → shipped; permiso pedidos.gestionar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [carrier, shippingDate]
 *             properties:
 *               carrier: { type: string, maxLength: 255 }
 *               shippingDate: { type: string, format: date }
 *     responses:
 *       200: { description: Pedido enviado, content: { application/json: { schema: { $ref: '#/components/schemas/OrderShipped' } } } }
 *       400: { description: VALIDATION_ERROR (datos o id no válidos), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       403: { description: FORBIDDEN (sin pedidos.gestionar), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       404: { description: NOT_FOUND, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       409: { description: CONFLICT (solo desde confirmed), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 */
export async function postShipOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await shipOrder(req.params.id as string, res.locals.input));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/orders/{id}/deliver:
 *   post:
 *     summary: Entrega un pedido (shipped → delivered; permiso pedidos.gestionar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Pedido entregado, content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } } }
 *       400: { description: VALIDATION_ERROR (id no es un UUID), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       403: { description: FORBIDDEN (sin pedidos.gestionar), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       404: { description: NOT_FOUND, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       409: { description: CONFLICT (solo desde shipped), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 */
export async function postDeliverOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await deliverOrder(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   post:
 *     summary: Cancela un pedido (pending o confirmed → cancelled; permiso pedidos.gestionar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cancellationReason]
 *             properties:
 *               cancellationReason: { type: string, maxLength: 2000 }
 *     responses:
 *       200: { description: Pedido cancelado, content: { application/json: { schema: { $ref: '#/components/schemas/OrderCancelled' } } } }
 *       400: { description: VALIDATION_ERROR (datos o id no válidos), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       403: { description: FORBIDDEN (sin pedidos.gestionar), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       404: { description: NOT_FOUND, content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 *       409: { description: CONFLICT (solo desde pending o confirmed), content: { application/json: { schema: { $ref: '#/components/schemas/OrderError' } } } }
 */
export async function postCancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await cancelOrder(req.params.id as string, res.locals.input));
  } catch (err) {
    next(err);
  }
}
