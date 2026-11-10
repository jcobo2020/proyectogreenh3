import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  CustomerBusinessRuleError,
  CustomerChangedError,
  CustomerPreconditionRequiredError,
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

/** Como `traducir`, pero al guardar cambios: 409 email repetido, 412 versión cambiada, 428 falta If-Match. */
export function traducirEdicion(error: unknown): Observable<never> {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 409) return throwError(() => new DuplicateCustomerEmailError());
  if (status === 412) return throwError(() => new CustomerChangedError());
  if (status === 428) return throwError(() => new CustomerPreconditionRequiredError());
  return traducir(error);
}
