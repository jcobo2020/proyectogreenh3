import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerOption } from '../models/invoice.model';

export interface CustomerOptionRepositoryPort {
  /** Clientes cuyo nombre contiene el texto (una sola página). */
  search(name: string): Observable<CustomerOption[]>;
}

export const CUSTOMER_OPTION_REPOSITORY = new InjectionToken<CustomerOptionRepositoryPort>(
  'CUSTOMER_OPTION_REPOSITORY',
);
