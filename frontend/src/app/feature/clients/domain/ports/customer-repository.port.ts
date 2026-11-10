import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerFilters, CustomerPage } from '../models/customer.model';

export interface CustomerRepositoryPort {
  list(filters: CustomerFilters, page: number, pageSize: number): Observable<CustomerPage>;
}

export const CUSTOMER_REPOSITORY = new InjectionToken<CustomerRepositoryPort>('CUSTOMER_REPOSITORY');
