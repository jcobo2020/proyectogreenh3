import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderBusinessRuleError,
  OrderConflictError,
  OrderNotFoundError,
  type FieldDetail,
  OrderInfrastructureError,
  OrderSessionExpiredError,
} from '../domain/errors/order.errors';

/** Lee `details` del cuerpo de un 400 (uno por dato que falló); ignora lo que no tenga forma de campo + mensaje. */
function detallesDe(error: unknown): FieldDetail[] {
  const details = error instanceof HttpErrorResponse ? error.error?.details : null;
  if (!Array.isArray(details)) return [];
  return details.flatMap((d: Record<string, unknown>) => {
    const field = d?.['field'] ?? d?.['path'] ?? d?.['property'];
    const message = d?.['message'] ?? d?.['reason'];
    return typeof field === 'string' && typeof message === 'string' ? [{ field, message }] : [];
  });
}

/** Traduce un error HTTP a un error de dominio (para usar con `catchError`). */
export function traducir(error: unknown): Observable<never> {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 400) return throwError(() => new InvalidOrderInputError(detallesDe(error)));
  if (status === 404) return throwError(() => new OrderNotFoundError());
  if (status === 409) return throwError(() => new OrderConflictError());
  if (status === 401) return throwError(() => new OrderSessionExpiredError());
  if (status === 403) return throwError(() => new ForbiddenOrderError());
  if (status === 422) return throwError(() => new OrderBusinessRuleError());
  return throwError(() => new OrderInfrastructureError());
}
