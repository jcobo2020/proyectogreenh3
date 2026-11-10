import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerDetail, CustomerFilters, CustomerPage, NewCustomer } from '../models/customer.model';

export interface CustomerRepositoryPort {
  list(filters: CustomerFilters, page: number, pageSize: number): Observable<CustomerPage>;
  get(id: string): Observable<CustomerDetail>;
  delete(id: string): Observable<void>;
  /** Crea el cliente; `idempotencyKey` identifica el intento de envío. */
  create(customer: NewCustomer, idempotencyKey: string): Observable<CustomerDetail>;
}

export const CUSTOMER_REPOSITORY = new InjectionToken<CustomerRepositoryPort>('CUSTOMER_REPOSITORY');
