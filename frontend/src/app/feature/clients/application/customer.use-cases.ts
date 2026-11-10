import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CustomerDetail,
  CustomerFilters,
  CustomerPage,
  NewCustomer,
  Province,
  Town,
} from '../domain/models/customer.model';
import { CUSTOMER_REPOSITORY } from '../domain/ports/customer-repository.port';
import { TOWN_REPOSITORY } from '../domain/ports/town-repository.port';
import { PROVINCE_REPOSITORY } from '../domain/ports/province-repository.port';

@Injectable()
export class ListCustomersUseCase {
  private readonly repository = inject(CUSTOMER_REPOSITORY);

  execute(filters: CustomerFilters, page: number, pageSize: number): Observable<CustomerPage> {
    return this.repository.list(filters, page, pageSize);
  }
}

@Injectable()
export class ListProvincesUseCase {
  private readonly repository = inject(PROVINCE_REPOSITORY);

  execute(): Observable<Province[]> {
    return this.repository.list();
  }
}

@Injectable()
export class GetCustomerUseCase {
  private readonly repository = inject(CUSTOMER_REPOSITORY);

  execute(id: string): Observable<CustomerDetail> {
    return this.repository.get(id);
  }
}

@Injectable()
export class ListTownsUseCase {
  private readonly repository = inject(TOWN_REPOSITORY);

  execute(provinceId: string): Observable<Town[]> {
    return this.repository.listByProvince(provinceId);
  }
}

@Injectable()
export class CreateCustomerUseCase {
  private readonly repository = inject(CUSTOMER_REPOSITORY);

  execute(customer: NewCustomer, idempotencyKey: string): Observable<CustomerDetail> {
    return this.repository.create(customer, idempotencyKey);
  }
}

@Injectable()
export class DeleteCustomerUseCase {
  private readonly repository = inject(CUSTOMER_REPOSITORY);

  execute(id: string): Observable<void> {
    return this.repository.delete(id);
  }
}
