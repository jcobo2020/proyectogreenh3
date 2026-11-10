import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CreatedOrder, NewOrder, OrderFilters, OrderPage } from '../models/order.model';

export interface OrderRepositoryPort {
  list(filters: OrderFilters, page: number, pageSize: number): Observable<OrderPage>;
  create(order: NewOrder, idempotencyKey: string): Observable<CreatedOrder>;
}

export const ORDER_REPOSITORY = new InjectionToken<OrderRepositoryPort>('ORDER_REPOSITORY');
