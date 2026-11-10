import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerOption, OrderFilters, OrderPage } from '../domain/models/order.model';
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
export class ListCustomerOptionsUseCase {
  private readonly repository = inject(CUSTOMER_OPTION_REPOSITORY);

  execute(): Observable<CustomerOption[]> {
    return this.repository.list();
  }
}
