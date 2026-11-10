import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { createSpyObj } from '../../../../testing/spy-obj';
import { CUSTOMER_OPTION_REPOSITORY, CustomerOptionRepositoryPort } from '../domain/ports/customer-option-repository.port';
import { INVOICE_REPOSITORY, InvoiceRepositoryPort } from '../domain/ports/invoice-repository.port';
import { CreateInvoiceUseCase, SearchCustomerOptionsUseCase } from './invoice.use-cases';

describe('casos de uso de facturas', () => {
  it('CreateInvoiceUseCase delega en el puerto con el cuerpo y la Idempotency-Key', () => {
    const repo = createSpyObj<InvoiceRepositoryPort>(['create']);
    const creada = { id: 'f1', customerId: 'c1', date: '2026-11-01', amount: 5, number: 'F-2026-000001', customerName: 'Ana' };
    repo.create.mockReturnValue(of(creada));
    TestBed.configureTestingModule({
      providers: [{ provide: INVOICE_REPOSITORY, useValue: repo }, CreateInvoiceUseCase],
    });
    const cuerpo = { customerId: 'c1', date: '2026-11-01', amount: 5 };
    let resultado: unknown;
    TestBed.inject(CreateInvoiceUseCase)
      .execute(cuerpo, 'k1')
      .subscribe((r) => (resultado = r));
    expect(repo.create).toHaveBeenCalledWith(cuerpo, 'k1');
    expect(resultado).toBe(creada);
  });

  it('SearchCustomerOptionsUseCase delega en el puerto con el texto buscado', () => {
    const repo = createSpyObj<CustomerOptionRepositoryPort>(['search']);
    repo.search.mockReturnValue(of([{ id: 'c1', name: 'Ana' }]));
    TestBed.configureTestingModule({
      providers: [{ provide: CUSTOMER_OPTION_REPOSITORY, useValue: repo }, SearchCustomerOptionsUseCase],
    });
    let resultado: unknown;
    TestBed.inject(SearchCustomerOptionsUseCase)
      .execute('an')
      .subscribe((r) => (resultado = r));
    expect(repo.search).toHaveBeenCalledWith('an');
    expect(resultado).toEqual([{ id: 'c1', name: 'Ana' }]);
  });
});
