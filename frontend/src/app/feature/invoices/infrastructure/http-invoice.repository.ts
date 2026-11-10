import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreatedInvoice, NewInvoice } from '../domain/models/invoice.model';
import { InvoiceRepositoryPort } from '../domain/ports/invoice-repository.port';
import { traducir } from './http-error.translator';

@Injectable()
export class HttpInvoiceRepository implements InvoiceRepositoryPort {
  private readonly http = inject(HttpClient);

  create(invoice: NewInvoice, idempotencyKey: string): Observable<CreatedInvoice> {
    return this.http
      .post<CreatedInvoice>(`${environment.apiBaseUrl}/invoices`, invoice, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(catchError(traducir));
  }
}
