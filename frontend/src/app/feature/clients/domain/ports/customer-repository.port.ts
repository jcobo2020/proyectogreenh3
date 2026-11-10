import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerDetail, CustomerFilters, CustomerPage, NewCustomer,
  VersionedCustomer,
} from '../models/customer.model';

export interface CustomerRepositoryPort {
  list(filters: CustomerFilters, page: number, pageSize: number): Observable<CustomerPage>;
  get(id: string): Observable<CustomerDetail>;
  /** Como `get`, pero con el ETag de la respuesta, para la edición. */
  getVersioned(id: string): Observable<VersionedCustomer>;
  /** Guarda los cambios; `etag` viaja en If-Match. */
  update(id: string, customer: NewCustomer, etag: string): Observable<VersionedCustomer>;
  delete(id: string): Observable<void>;
  /** Crea el cliente; `idempotencyKey` identifica el intento de envío. */
  create(customer: NewCustomer, idempotencyKey: string): Observable<CustomerDetail>;
}

export const CUSTOMER_REPOSITORY = new InjectionToken<CustomerRepositoryPort>('CUSTOMER_REPOSITORY');
