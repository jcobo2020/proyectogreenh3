import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CancelOrder,
  CreatedOrder,
  NewOrder,
  OrderActionResult,
  OrderDetail,
  OrderFilters,
  OrderPage,
  ShipOrder,
} from '../models/order.model';

export interface OrderRepositoryPort {
  list(filters: OrderFilters, page: number, pageSize: number): Observable<OrderPage>;
  create(order: NewOrder, idempotencyKey: string): Observable<CreatedOrder>;
  get(id: string): Observable<OrderDetail>;
  confirm(id: string): Observable<OrderActionResult>;
  ship(id: string, body: ShipOrder): Observable<OrderActionResult>;
  cancel(id: string, body: CancelOrder): Observable<OrderActionResult>;
  deliver(id: string): Observable<OrderActionResult>;
}

export const ORDER_REPOSITORY = new InjectionToken<OrderRepositoryPort>('ORDER_REPOSITORY');
