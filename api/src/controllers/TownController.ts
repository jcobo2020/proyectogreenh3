import { Request, Response, NextFunction } from 'express';
import { listTowns } from '../services/TownService';

/**
 * @swagger
 * /api/towns:
 *   get:
 *     summary: Lista las poblaciones de una provincia, ordenadas por nombre
 *     description: Catálogo cerrado; devuelve todas las de la provincia, sin paginar.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provinceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Town[]
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 required: [id, provinceId, name]
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   provinceId:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *       400:
 *         description: VALIDATION_ERROR, provinceId ausente, mal formado o inexistente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [code, message]
 *               properties:
 *                 code:
 *                   type: string
 *                   example: VALIDATION_ERROR
 *                 message:
 *                   type: string
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       message:
 *                         type: string
 *       401:
 *         description: UNAUTHORIZED, sin sesión válida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [code, message]
 *               properties:
 *                 code:
 *                   type: string
 *                   example: UNAUTHORIZED
 *                 message:
 *                   type: string
 */
export async function getTowns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listTowns(req.query.provinceId as string));
  } catch (err) {
    next(err);
  }
}
