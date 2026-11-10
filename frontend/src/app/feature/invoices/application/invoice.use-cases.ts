import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreatedInvoice, CustomerOption, NewInvoice } from '../domain/models/invoice.model';
import { CUSTOMER_OPTION_REPOSITORY } from '../domain/ports/customer-option-repository.port';
import { INVOICE_REPOSITORY } from '../domain/ports/invoice-repository.port';

@Injectable()
export class CreateInvoiceUseCase {
  private readonly repository = inject(INVOICE_REPOSITORY);

  execute(invoice: NewInvoice, idempotencyKey: string): Observable<CreatedInvoice> {
    return this.repository.create(invoice, idempotencyKey);
  }
}

@Injectable()
export class SearchCustomerOptionsUseCase {
  private readonly repository = inject(CUSTOMER_OPTION_REPOSITORY);

  execute(name: string): Observable<CustomerOption[]> {
    return this.repository.search(name);
  }
}
