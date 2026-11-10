import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  CustomerChangedError,
  CustomerInfrastructureError,
  CustomerNotFoundError,
  CustomerPreconditionRequiredError,
  CustomerSessionExpiredError,
  DuplicateCustomerEmailError,
  InvalidCustomerInputError,
} from '../domain/errors/customer.errors';
import { NewCustomer } from '../domain/models/customer.model';
import { HttpCustomerRepository } from './http-customer.repository';

const cuerpo: NewCustomer = {
  name: 'Ana',
  email: 'ana@mail.test',
  provinceId: 'p1',
  townId: 't1',
  status: 'active',
  streetAddress: 'Calle 1',
};
const detalle = { id: 'u1', ...cuerpo, provinceName: 'M', townName: 'G', version: 3 };

function preparar() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpCustomerRepository],
  });
  return { http: TestBed.inject(HttpTestingController), repo: TestBed.inject(HttpCustomerRepository) };
}

describe('HttpCustomerRepository · GET /api/customers/:id con ETag', () => {
  it('200: devuelve el cliente y el ETag de la cabecera', () => {
    const { http, repo } = preparar();
    let resultado: unknown;
    repo.getVersioned('u1').subscribe((r) => (resultado = r));
    http.expectOne('/api/customers/u1').flush(detalle, { headers: { ETag: '"3"' } });
    expect(resultado).toEqual({ customer: detalle, etag: '"3"' });
  });

  it('sin cabecera ETag usa la versión entre comillas', () => {
    const { http, repo } = preparar();
    let resultado: { etag: string } | undefined;
    repo.getVersioned('u1').subscribe((r) => (resultado = r));
    http.expectOne('/api/customers/u1').flush(detalle);
    expect(resultado?.etag).toBe('"3"');
  });

  it.each([
    [400, InvalidCustomerInputError],
    [401, CustomerSessionExpiredError],
    [404, CustomerNotFoundError],
    [500, CustomerInfrastructureError],
  ])('%i se traduce a su error de dominio', (status, clase) => {
    const { http, repo } = preparar();
    let error: unknown;
    repo.getVersioned('u1').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/customers/u1').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });
});

describe('HttpCustomerRepository · PUT /api/customers/:id', () => {
  it('200: envía el cuerpo con If-Match y devuelve el ETag nuevo', () => {
    const { http, repo } = preparar();
    let resultado: unknown;
    repo.update('u1', cuerpo, '"3"').subscribe((r) => (resultado = r));
    const req = http.expectOne('/api/customers/u1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(cuerpo);
    expect(req.request.headers.get('If-Match')).toBe('"3"');
    req.flush({ ...detalle, version: 4 }, { headers: { ETag: '"4"' } });
    expect(resultado).toEqual({ customer: { ...detalle, version: 4 }, etag: '"4"' });
  });

  it.each([
    [400, InvalidCustomerInputError],
    [401, CustomerSessionExpiredError],
    [404, CustomerNotFoundError],
    [409, DuplicateCustomerEmailError],
    [412, CustomerChangedError],
    [428, CustomerPreconditionRequiredError],
    [500, CustomerInfrastructureError],
  ])('%i se traduce a su error de dominio', (status, clase) => {
    const { http, repo } = preparar();
    let error: unknown;
    repo.update('u1', cuerpo, '"3"').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/customers/u1').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });
});
