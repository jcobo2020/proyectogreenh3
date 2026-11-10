import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CustomerDetail,
  CustomerFilters,
  CustomerPage,
  NewCustomer,
  VersionedCustomer,
} from '../domain/models/customer.model';
import { CustomerRepositoryPort } from '../domain/ports/customer-repository.port';
import { traducir, traducirAlta, traducirEdicion } from './http-error.translator';

@Injectable()
export class HttpCustomerRepository implements CustomerRepositoryPort {
  private readonly http = inject(HttpClient);

  list(filters: CustomerFilters, page: number, pageSize: number): Observable<CustomerPage> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters.name.trim()) params = params.set('name', filters.name.trim());
    if (filters.provinceId) params = params.set('provinceId', filters.provinceId);
    if (filters.status) params = params.set('status', filters.status);
    return this.http
      .get<CustomerPage>(`${environment.apiBaseUrl}/customers`, { params })
      .pipe(catchError(traducir));
  }

  get(id: string): Observable<CustomerDetail> {
    return this.http
      .get<CustomerDetail>(`${environment.apiBaseUrl}/customers/${encodeURIComponent(id)}`)
      .pipe(catchError(traducir));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiBaseUrl}/customers/${encodeURIComponent(id)}`)
      .pipe(catchError(traducir));
  }

  create(customer: NewCustomer, idempotencyKey: string): Observable<CustomerDetail> {
    return this.http
      .post<CustomerDetail>(`${environment.apiBaseUrl}/customers`, customer, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(catchError(traducirAlta));
  }

  getVersioned(id: string): Observable<VersionedCustomer> {
    return this.http
      .get<CustomerDetail>(`${environment.apiBaseUrl}/customers/${encodeURIComponent(id)}`, { observe: 'response' })
      .pipe(map(conEtag), catchError(traducir));
  }

  update(id: string, customer: NewCustomer, etag: string): Observable<VersionedCustomer> {
    return this.http
      .put<CustomerDetail>(`${environment.apiBaseUrl}/customers/${encodeURIComponent(id)}`, customer, {
        headers: { 'If-Match': etag },
        observe: 'response',
      })
      .pipe(map(conEtag), catchError(traducirEdicion));
  }
}

/** El ETag de la respuesta; si no llega, el de su versión entre comillas. */
function conEtag(response: HttpResponse<CustomerDetail>): VersionedCustomer {
  const customer = response.body as CustomerDetail;
  return { customer, etag: response.headers.get('ETag') ?? `"${customer.version}"` };
}
