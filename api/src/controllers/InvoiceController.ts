import { Request, Response, NextFunction } from 'express';
import { createInvoice, listInvoices } from '../services/InvoiceService';

/**
 * @swagger
 * components:
 *   schemas:
 *     InvoiceInput:
 *       type: object
 *       required: [customerId, date, amount]
 *       properties:
 *         customerId: { type: string, format: uuid }
 *         date: { type: string, format: date, description: 'No posterior a hoy' }
 *         amount: { type: number, minimum: 0.01 }
 *     Invoice:
 *       type: object
 *       required: [id]
 *       properties:
 *         id: { type: string, format: uuid }
 *         customerId: { type: string, format: uuid }
 *         date: { type: string, format: date }
 *         amount: { type: number }
 *         number: { type: string, description: 'F-AAAA-NNNNNN, lo pone el servidor' }
 *         customerName: { type: string }
 *     InvoiceListItem:
 *       type: object
 *       required: [id, customerId]
 *       properties:
 *         id: { type: string, format: uuid }
 *         number: { type: string }
 *         customerId: { type: string, format: uuid }
 *         customerName: { type: string }
 *         date: { type: string, format: date }
 *         amount: { type: number }
 *     InvoiceError:
 *       type: object
 *       required: [code, message]
 *       properties:
 *         code: { type: string, description: 'UNAUTHORIZED, VALIDATION_ERROR o BUSINESS_RULE' }
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
 * /api/invoices:
 *   get:
 *     summary: Lista de facturas (basta la sesión), por date descendente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: customerId, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200:
 *         description: Página de facturas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items: { type: array, items: { $ref: '#/components/schemas/InvoiceListItem' } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *       400: { description: VALIDATION_ERROR (parámetro no válido o customerId inexistente), content: { application/json: { schema: { $ref: '#/components/schemas/InvoiceError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/InvoiceError' } } } }
 */
export async function getInvoices(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listInvoices(res.locals.listQuery));
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     summary: Crea una factura (basta la sesión; idempotente)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: header, name: Idempotency-Key, required: true, schema: { type: string, maxLength: 255 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/InvoiceInput' }
 *     responses:
 *       201:
 *         description: Factura creada (si la clave se repite, mismo cuerpo y cabecera Idempotent-Replayed true)
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Invoice' } } }
 *       400: { description: VALIDATION_ERROR (datos, falta Idempotency-Key o customerId inexistente), content: { application/json: { schema: { $ref: '#/components/schemas/InvoiceError' } } } }
 *       401: { description: UNAUTHORIZED, content: { application/json: { schema: { $ref: '#/components/schemas/InvoiceError' } } } }
 *       422: { description: BUSINESS_RULE, Idempotency-Key usada con otro cuerpo u otra operación, content: { application/json: { schema: { $ref: '#/components/schemas/InvoiceError' } } } }
 */
export async function postInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await createInvoice(res.locals.userId, res.locals.idempotencyKey, req.body);
    if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
}
