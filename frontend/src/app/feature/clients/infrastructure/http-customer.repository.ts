import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CustomerDetail, CustomerFilters, CustomerPage } from '../domain/models/customer.model';
import { CustomerRepositoryPort } from '../domain/ports/customer-repository.port';
import { traducir } from './http-error.translator';

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
}
