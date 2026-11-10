import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  InvalidInvoiceInputError,
  InvoiceBusinessRuleError,
  InvoiceInfrastructureError,
  InvoiceSessionExpiredError,
  type FieldDetail,
} from '../domain/errors/invoice.errors';

/** Lee `details` del cuerpo de un 400 (uno por dato que falló); ignora lo que no tenga forma de campo + mensaje. */
function detallesDe(error: unknown): FieldDetail[] {
  const details = error instanceof HttpErrorResponse ? error.error?.details : null;
  if (!Array.isArray(details)) return [];
  return details.flatMap((d: Record<string, unknown>) => {
    const field = d?.['field'];
    const message = d?.['message'];
    return typeof field === 'string' && typeof message === 'string' ? [{ field, message }] : [];
  });
}

/** Traduce un error HTTP a un error de dominio (para usar con `catchError`). */
export function traducir(error: unknown): Observable<never> {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 400) return throwError(() => new InvalidInvoiceInputError(detallesDe(error)));
  if (status === 401) return throwError(() => new InvoiceSessionExpiredError());
  if (status === 422) return throwError(() => new InvoiceBusinessRuleError());
  return throwError(() => new InvoiceInfrastructureError());
}
