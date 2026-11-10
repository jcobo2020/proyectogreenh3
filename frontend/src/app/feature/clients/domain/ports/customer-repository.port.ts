import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerDetail, CustomerFilters, CustomerPage } from '../models/customer.model';

export interface CustomerRepositoryPort {
  list(filters: CustomerFilters, page: number, pageSize: number): Observable<CustomerPage>;
  get(id: string): Observable<CustomerDetail>;
  delete(id: string): Observable<void>;
}

export const CUSTOMER_REPOSITORY = new InjectionToken<CustomerRepositoryPort>('CUSTOMER_REPOSITORY');
