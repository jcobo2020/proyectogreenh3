import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { createSpyObj } from '../../../../testing/spy-obj';
import { CustomerDetail } from '../domain/models/customer.model';
import { CustomerRepositoryPort, CUSTOMER_REPOSITORY } from '../domain/ports/customer-repository.port';
import { ProvinceRepositoryPort, PROVINCE_REPOSITORY } from '../domain/ports/province-repository.port';
import { TownRepositoryPort, TOWN_REPOSITORY } from '../domain/ports/town-repository.port';
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  ListProvincesUseCase,
  ListTownsUseCase,
} from './customer.use-cases';

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

  it('GetCustomerUseCase delega en el puerto', () => {
    const puerto = createSpyObj<CustomerRepositoryPort>(['get']);
    const detalle = { id: 'u1' } as unknown as CustomerDetail;
    puerto.get.mockReturnValue(of(detalle));
    TestBed.configureTestingModule({
      providers: [GetCustomerUseCase, { provide: CUSTOMER_REPOSITORY, useValue: puerto }],
    });
    let resultado: unknown;
    TestBed.inject(GetCustomerUseCase).execute('u1').subscribe((r) => (resultado = r));
    expect(puerto.get).toHaveBeenCalledWith('u1');
    expect(resultado).toBe(detalle);
  });

  it('ListTownsUseCase delega en el puerto con la provincia', () => {
    const puerto = createSpyObj<TownRepositoryPort>(['listByProvince']);
    puerto.listByProvince.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [ListTownsUseCase, { provide: TOWN_REPOSITORY, useValue: puerto }],
    });
    TestBed.inject(ListTownsUseCase).execute('p1').subscribe();
    expect(puerto.listByProvince).toHaveBeenCalledWith('p1');
  });

  it('CreateCustomerUseCase delega en el puerto con la clave de idempotencia', () => {
    const puerto = createSpyObj<CustomerRepositoryPort>(['create']);
    const creado = { id: 'u1' } as unknown as CustomerDetail;
    puerto.create.mockReturnValue(of(creado));
    TestBed.configureTestingModule({
      providers: [CreateCustomerUseCase, { provide: CUSTOMER_REPOSITORY, useValue: puerto }],
    });
    const cuerpo = {
      name: 'Ana',
      email: 'a@b.c',
      provinceId: 'p1',
      townId: 't1',
      status: 'active',
      streetAddress: 'Calle 1',
    };
    let resultado: unknown;
    TestBed.inject(CreateCustomerUseCase).execute(cuerpo, 'k1').subscribe((r) => (resultado = r));
    expect(puerto.create).toHaveBeenCalledWith(cuerpo, 'k1');
    expect(resultado).toBe(creado);
  });

  it('DeleteCustomerUseCase delega en el puerto', () => {
    const puerto = createSpyObj<CustomerRepositoryPort>(['delete']);
    puerto.delete.mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [DeleteCustomerUseCase, { provide: CUSTOMER_REPOSITORY, useValue: puerto }],
    });
    TestBed.inject(DeleteCustomerUseCase).execute('u1').subscribe();
    expect(puerto.delete).toHaveBeenCalledWith('u1');
  });
});
