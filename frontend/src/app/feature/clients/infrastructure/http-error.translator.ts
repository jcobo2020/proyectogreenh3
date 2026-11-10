import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  CustomerInfrastructureError,
  CustomerSessionExpiredError,
  InvalidCustomerInputError,
} from '../domain/errors/customer.errors';

/** Traduce un error HTTP a un error de dominio (para usar con `catchError`). */
export function traducir(error: unknown): Observable<never> {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 400) return throwError(() => new InvalidCustomerInputError());
  if (status === 401) return throwError(() => new CustomerSessionExpiredError());
  return throwError(() => new CustomerInfrastructureError());
}
