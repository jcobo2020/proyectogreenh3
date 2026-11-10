import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderInfrastructureError,
  OrderSessionExpiredError,
} from '../domain/errors/order.errors';

/** Traduce un error HTTP a un error de dominio (para usar con `catchError`). */
export function traducir(error: unknown): Observable<never> {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 400) return throwError(() => new InvalidOrderInputError());
  if (status === 401) return throwError(() => new OrderSessionExpiredError());
  if (status === 403) return throwError(() => new ForbiddenOrderError());
  return throwError(() => new OrderInfrastructureError());
}
