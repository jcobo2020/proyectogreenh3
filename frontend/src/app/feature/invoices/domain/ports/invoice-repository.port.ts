import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CreatedInvoice, NewInvoice } from '../models/invoice.model';

export interface InvoiceRepositoryPort {
  create(invoice: NewInvoice, idempotencyKey: string): Observable<CreatedInvoice>;
}

export const INVOICE_REPOSITORY = new InjectionToken<InvoiceRepositoryPort>('INVOICE_REPOSITORY');
