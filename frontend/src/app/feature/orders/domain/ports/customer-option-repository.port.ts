import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerOption } from '../models/order.model';

export interface CustomerOptionRepositoryPort {
  list(): Observable<CustomerOption[]>;
}

export const CUSTOMER_OPTION_REPOSITORY = new InjectionToken<CustomerOptionRepositoryPort>(
  'CUSTOMER_OPTION_REPOSITORY',
);
