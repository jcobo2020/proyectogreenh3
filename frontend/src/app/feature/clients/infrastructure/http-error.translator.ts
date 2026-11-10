import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  CustomerBusinessRuleError,
  CustomerInUseError,
  CustomerInfrastructureError,
  CustomerNotFoundError,
  CustomerSessionExpiredError,
  DuplicateCustomerEmailError,
  InvalidCustomerInputError,
} from '../domain/errors/customer.errors';

/** Traduce un error HTTP a un error de dominio (para usar con `catchError`). */
export function traducir(error: unknown): Observable<never> {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 400) return throwError(() => new InvalidCustomerInputError());
  if (status === 401) return throwError(() => new CustomerSessionExpiredError());
  if (status === 404) return throwError(() => new CustomerNotFoundError());
  if (status === 409) return throwError(() => new CustomerInUseError());
  return throwError(() => new CustomerInfrastructureError());
}

/** Como `traducir`, pero para el alta: 409 es email repetido y 422 una regla de negocio. */
export function traducirAlta(error: unknown): Observable<never> {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 409) return throwError(() => new DuplicateCustomerEmailError());
  if (status === 422) return throwError(() => new CustomerBusinessRuleError());
  return traducir(error);
}
