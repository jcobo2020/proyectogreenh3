import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { createSpyObj } from '../../../../testing/spy-obj';
import { CUSTOMER_OPTION_REPOSITORY, CustomerOptionRepositoryPort } from '../domain/ports/customer-option-repository.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from '../domain/ports/order-repository.port';
import { CreateOrderUseCase, ListCustomerOptionsUseCase, ListOrdersUseCase } from './order.use-cases';

describe('casos de uso de pedidos', () => {
  it('ListOrdersUseCase delega en el puerto con filtros y página', () => {
    const repo = createSpyObj<OrderRepositoryPort>(['list', 'create']);
    const pagina = { items: [], total: 0, page: 1, pageSize: 20 };
    repo.list.mockReturnValue(of(pagina));
    TestBed.configureTestingModule({
      providers: [{ provide: ORDER_REPOSITORY, useValue: repo }, ListOrdersUseCase],
    });
    let resultado: unknown;
    TestBed.inject(ListOrdersUseCase)
      .execute({ customerId: 'c1', status: 'pending' }, 3, 20)
      .subscribe((r) => (resultado = r));
    expect(repo.list).toHaveBeenCalledWith({ customerId: 'c1', status: 'pending' }, 3, 20);
    expect(resultado).toBe(pagina);
  });

  it('CreateOrderUseCase delega en el puerto con el cuerpo y la Idempotency-Key', () => {
    const repo = createSpyObj<OrderRepositoryPort>(['list', 'create']);
    const creado = { id: 'o1', customerId: 'c1', date: '2026-11-01', amount: 5, status: 'pending' };
    repo.create.mockReturnValue(of(creado));
    TestBed.configureTestingModule({
      providers: [{ provide: ORDER_REPOSITORY, useValue: repo }, CreateOrderUseCase],
    });
    let resultado: unknown;
    const nuevo = { customerId: 'c1', date: '2026-11-01', amount: 5 };
    TestBed.inject(CreateOrderUseCase).execute(nuevo, 'k1').subscribe((r) => (resultado = r));
    expect(repo.create).toHaveBeenCalledWith(nuevo, 'k1');
    expect(resultado).toBe(creado);
  });

  it('ListCustomerOptionsUseCase delega en el puerto', () => {
    const repo = createSpyObj<CustomerOptionRepositoryPort>(['list']);
    repo.list.mockReturnValue(of([{ id: 'c1', name: 'Ana' }]));
    TestBed.configureTestingModule({
      providers: [{ provide: CUSTOMER_OPTION_REPOSITORY, useValue: repo }, ListCustomerOptionsUseCase],
    });
    let resultado: unknown;
    TestBed.inject(ListCustomerOptionsUseCase).execute().subscribe((r) => (resultado = r));
    expect(resultado).toEqual([{ id: 'c1', name: 'Ana' }]);
  });
});
