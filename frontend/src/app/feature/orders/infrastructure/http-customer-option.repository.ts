import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CUSTOMER_OPTIONS_PAGE_SIZE, CustomerOption } from '../domain/models/order.model';
import { CustomerOptionRepositoryPort } from '../domain/ports/customer-option-repository.port';
import { traducir } from './http-error.translator';

@Injectable()
export class HttpCustomerOptionRepository implements CustomerOptionRepositoryPort {
  private readonly http = inject(HttpClient);

  list(): Observable<CustomerOption[]> {
    const params = new HttpParams().set('page', 1).set('pageSize', CUSTOMER_OPTIONS_PAGE_SIZE);
    return this.http
      .get<{ items: { id: string; name: string }[] }>(`${environment.apiBaseUrl}/customers`, { params })
      .pipe(
        map((page) => page.items.map(({ id, name }) => ({ id, name }))),
        catchError(traducir),
      );
  }
}
