import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { createSpyObj } from '../../../../testing/spy-obj';
import { CustomerRepositoryPort, CUSTOMER_REPOSITORY } from '../domain/ports/customer-repository.port';
import { ProvinceRepositoryPort, PROVINCE_REPOSITORY } from '../domain/ports/province-repository.port';
import { ListCustomersUseCase, ListProvincesUseCase } from './customer.use-cases';

describe('casos de uso de clientes', () => {
  it('ListCustomersUseCase delega en el puerto', () => {
    const puerto = createSpyObj<CustomerRepositoryPort>(['list']);
    const pagina = { items: [], total: 0, page: 1, pageSize: 20 };
    puerto.list.mockReturnValue(of(pagina));
    TestBed.configureTestingModule({
      providers: [ListCustomersUseCase, { provide: CUSTOMER_REPOSITORY, useValue: puerto }],
    });
    const filtros = { name: 'a', provinceId: '', status: '' };
    let resultado: unknown;
    TestBed.inject(ListCustomersUseCase).execute(filtros, 3, 20).subscribe((r) => (resultado = r));
    expect(puerto.list).toHaveBeenCalledWith(filtros, 3, 20);
    expect(resultado).toEqual(pagina);
  });

  it('ListProvincesUseCase delega en el puerto', () => {
    const puerto = createSpyObj<ProvinceRepositoryPort>(['list']);
    puerto.list.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [ListProvincesUseCase, { provide: PROVINCE_REPOSITORY, useValue: puerto }],
    });
    TestBed.inject(ListProvincesUseCase).execute().subscribe();
    expect(puerto.list).toHaveBeenCalledTimes(1);
  });
});
