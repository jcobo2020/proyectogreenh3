import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CancelOrder,
  CreatedOrder,
  NewOrder,
  OrderActionResult,
  OrderDetail,
  OrderFilters,
  OrderPage,
  ShipOrder,
} from '../domain/models/order.model';
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

  create(order: NewOrder, idempotencyKey: string): Observable<CreatedOrder> {
    return this.http
      .post<CreatedOrder>(`${environment.apiBaseUrl}/orders`, order, {
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      .pipe(catchError(traducir));
  }

  get(id: string): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(this.url(id)).pipe(catchError(traducir));
  }

  confirm(id: string): Observable<OrderActionResult> {
    return this.http.post<OrderActionResult>(this.url(id, 'confirm'), {}).pipe(catchError(traducir));
  }

  ship(id: string, body: ShipOrder): Observable<OrderActionResult> {
    return this.http.post<OrderActionResult>(this.url(id, 'ship'), body).pipe(catchError(traducir));
  }

  cancel(id: string, body: CancelOrder): Observable<OrderActionResult> {
    return this.http.post<OrderActionResult>(this.url(id, 'cancel'), body).pipe(catchError(traducir));
  }

  deliver(id: string): Observable<OrderActionResult> {
    return this.http.post<OrderActionResult>(this.url(id, 'deliver'), {}).pipe(catchError(traducir));
  }

  private url(id: string, accion?: string): string {
    const base = `${environment.apiBaseUrl}/orders/${encodeURIComponent(id)}`;
    return accion ? `${base}/${accion}` : base;
  }
}
