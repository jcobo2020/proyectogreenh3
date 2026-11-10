import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { OrderFilters, OrderPage } from '../domain/models/order.model';
import { OrderRepositoryPort } from '../domain/ports/order-repository.port';
import { traducir } from './http-error.translator';

@Injectable()
export class HttpOrderRepository implements OrderRepositoryPort {
  private readonly http = inject(HttpClient);

  list(filters: OrderFilters, page: number, pageSize: number): Observable<OrderPage> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters.customerId) params = params.set('customerId', filters.customerId);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<OrderPage>(`${environment.apiBaseUrl}/orders`, { params }).pipe(catchError(traducir));
  }
}
