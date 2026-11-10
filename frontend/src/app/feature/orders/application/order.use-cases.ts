import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CancelOrder,
  CreatedOrder,
  CustomerOption,
  NewOrder,
  OrderActionResult,
  OrderDetail,
  OrderFilters,
  OrderPage,
  ShipOrder,
} from '../domain/models/order.model';
import { CUSTOMER_OPTION_REPOSITORY } from '../domain/ports/customer-option-repository.port';
import { ORDER_REPOSITORY } from '../domain/ports/order-repository.port';

@Injectable()
export class ListOrdersUseCase {
  private readonly repository = inject(ORDER_REPOSITORY);

  execute(filters: OrderFilters, page: number, pageSize: number): Observable<OrderPage> {
    return this.repository.list(filters, page, pageSize);
  }
}

@Injectable()
export class CreateOrderUseCase {
  private readonly repository = inject(ORDER_REPOSITORY);

  execute(order: NewOrder, idempotencyKey: string): Observable<CreatedOrder> {
    return this.repository.create(order, idempotencyKey);
  }
}

@Injectable()
export class GetOrderUseCase {
  private readonly repository = inject(ORDER_REPOSITORY);

  execute(id: string): Observable<OrderDetail> {
    return this.repository.get(id);
  }
}

@Injectable()
export class ConfirmOrderUseCase {
  private readonly repository = inject(ORDER_REPOSITORY);

  execute(id: string): Observable<OrderActionResult> {
    return this.repository.confirm(id);
  }
}

@Injectable()
export class ShipOrderUseCase {
  private readonly repository = inject(ORDER_REPOSITORY);

  execute(id: string, body: ShipOrder): Observable<OrderActionResult> {
    return this.repository.ship(id, body);
  }
}

@Injectable()
export class CancelOrderUseCase {
  private readonly repository = inject(ORDER_REPOSITORY);

  execute(id: string, body: CancelOrder): Observable<OrderActionResult> {
    return this.repository.cancel(id, body);
  }
}

@Injectable()
export class DeliverOrderUseCase {
  private readonly repository = inject(ORDER_REPOSITORY);

  execute(id: string): Observable<OrderActionResult> {
    return this.repository.deliver(id);
  }
}

@Injectable()
export class ListCustomerOptionsUseCase {
  private readonly repository = inject(CUSTOMER_OPTION_REPOSITORY);

  execute(): Observable<CustomerOption[]> {
    return this.repository.list();
  }
}
