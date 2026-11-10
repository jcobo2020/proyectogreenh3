import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Recurso no encontrado' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err && err.type === 'entity.too.large') {
    res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'Cuerpo demasiado grande' });
    return;
  }
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'JSON mal formado' });
    return;
  }
  const app = err as AppError;
  if (app && typeof app.status === 'number' && app.code) {
    res.status(app.status).json({ code: app.code, message: app.message });
    return;
  }
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Error interno' });
}
