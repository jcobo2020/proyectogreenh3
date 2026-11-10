import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../lib/errors';

// Va después de authenticate: sin el permiso en la sesión, 403.
export function requirePermission(permission: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const permissions: string[] = res.locals.permissions ?? [];
    if (!permissions.includes(permission)) return next(new ForbiddenError(permission));
    next();
  };
}
