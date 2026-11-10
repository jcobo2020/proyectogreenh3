import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../lib/errors';
import { isUuid } from '../lib/uuid';

// Valida la query de GET /api/towns: provinceId obligatorio y con forma de uuid.
export function validateListTowns(req: Request, _res: Response, next: NextFunction): void {
  const { provinceId } = req.query;
  if (provinceId === undefined || provinceId === '') {
    return next(
      new ValidationError('El parámetro provinceId es obligatorio', [
        { field: 'provinceId', message: 'es obligatorio' },
      ]),
    );
  }
  if (!isUuid(provinceId)) {
    return next(
      new ValidationError('El parámetro provinceId no es válido', [
        { field: 'provinceId', message: 'debe ser un uuid' },
      ]),
    );
  }
  next();
}
