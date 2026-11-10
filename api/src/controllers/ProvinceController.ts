import { Request, Response, NextFunction } from 'express';
import { listProvinces } from '../services/ProvinceService';

/**
 * @swagger
 * /api/provinces:
 *   get:
 *     summary: Lista todas las provincias, ordenadas por nombre
 *     description: Catálogo cerrado; devuelve todas, sin paginar.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Province[]
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 required: [id, code, name]
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   code:
 *                     type: string
 *                   name:
 *                     type: string
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
export async function getProvinces(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await listProvinces());
  } catch (err) {
    next(err);
  }
}
