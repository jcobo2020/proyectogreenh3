import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../lib/errors';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;
  const header = req.headers.authorization;
  if (!secret || !header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }
  try {
    const payload = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'] });
    // Adjunta el usuario (claim sub) para las operaciones que se guardan por usuario.
    if (typeof payload === 'object' && typeof payload.sub === 'string') {
      res.locals.userId = payload.sub;
    }
    // Permisos de la sesión (claim permissions): el servidor decide con ellos, nunca con lo que mande el front.
    const permissions = typeof payload === 'object' ? payload.permissions : undefined;
    res.locals.permissions = Array.isArray(permissions) ? permissions.filter((p) => typeof p === 'string') : [];
    next();
  } catch {
    next(new UnauthorizedError());
  }
}
