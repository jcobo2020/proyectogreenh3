import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { createSpyObj } from '../../../../testing/spy-obj';
import { VersionedCustomer } from '../domain/models/customer.model';
import { CUSTOMER_REPOSITORY, CustomerRepositoryPort } from '../domain/ports/customer-repository.port';
import { GetCustomerForEditUseCase, UpdateCustomerUseCase } from './customer.use-cases';

const versionado = { etag: '"1"', customer: { id: 'u1' } } as unknown as VersionedCustomer;

describe('casos de uso de edición de clientes', () => {
  it('GetCustomerForEditUseCase delega en el puerto', () => {
    const puerto = createSpyObj<CustomerRepositoryPort>(['getVersioned']);
    puerto.getVersioned.mockReturnValue(of(versionado));
    TestBed.configureTestingModule({
      providers: [GetCustomerForEditUseCase, { provide: CUSTOMER_REPOSITORY, useValue: puerto }],
    });
    let resultado: unknown;
    TestBed.inject(GetCustomerForEditUseCase).execute('u1').subscribe((r) => (resultado = r));
    expect(puerto.getVersioned).toHaveBeenCalledWith('u1');
    expect(resultado).toBe(versionado);
  });

  it('UpdateCustomerUseCase delega en el puerto con el ETag', () => {
    const puerto = createSpyObj<CustomerRepositoryPort>(['update']);
    puerto.update.mockReturnValue(of(versionado));
    TestBed.configureTestingModule({
      providers: [UpdateCustomerUseCase, { provide: CUSTOMER_REPOSITORY, useValue: puerto }],
    });
    const cuerpo = { name: 'a', email: 'b', provinceId: 'p', townId: 't', status: 'active', streetAddress: 'c' };
    let resultado: unknown;
    TestBed.inject(UpdateCustomerUseCase).execute('u1', cuerpo, '"1"').subscribe((r) => (resultado = r));
    expect(puerto.update).toHaveBeenCalledWith('u1', cuerpo, '"1"');
    expect(resultado).toBe(versionado);
  });
});
