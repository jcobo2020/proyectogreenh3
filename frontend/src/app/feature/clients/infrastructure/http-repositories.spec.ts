import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  CustomerInUseError,
  CustomerInfrastructureError,
  CustomerNotFoundError,
  CustomerSessionExpiredError,
  InvalidCustomerInputError,
} from '../domain/errors/customer.errors';
import { HttpCustomerRepository } from './http-customer.repository';
import { HttpProvinceRepository } from './http-province.repository';

const sinFiltros = { name: '', provinceId: '', status: '' };

function preparar() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      HttpCustomerRepository,
      HttpProvinceRepository,
    ],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    clientes: TestBed.inject(HttpCustomerRepository),
    provincias: TestBed.inject(HttpProvinceRepository),
  };
}

describe('HttpCustomerRepository · GET /api/customers', () => {
  it('200: devuelve la página y envía page y pageSize', () => {
    const { http, clientes } = preparar();
    const pagina = { items: [], total: 0, page: 1, pageSize: 20 };
    let resultado: unknown;
    clientes.list(sinFiltros, 1, 20).subscribe((r) => (resultado = r));
    const req = http.expectOne((r) => r.url === '/api/customers');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.has('name')).toBe(false);
    req.flush(pagina);
    expect(resultado).toEqual(pagina);
  });

  it('envía name, provinceId y status como query', () => {
    const { http, clientes } = preparar();
    clientes.list({ name: ' Ana ', provinceId: 'p1', status: 'active' }, 2, 20).subscribe();
    const req = http.expectOne((r) => r.url === '/api/customers');
    expect(req.request.params.get('name')).toBe('Ana');
    expect(req.request.params.get('provinceId')).toBe('p1');
    expect(req.request.params.get('status')).toBe('active');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], total: 0, page: 2, pageSize: 20 });
  });

  it.each([
    [400, InvalidCustomerInputError],
    [401, CustomerSessionExpiredError],
    [500, CustomerInfrastructureError],
  ])('%i se traduce a su error de dominio', (status, clase) => {
    const { http, clientes } = preparar();
    let error: unknown;
    clientes.list(sinFiltros, 1, 20).subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/customers').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });

  it('un fallo de red es un error de infraestructura', () => {
    const { http, clientes } = preparar();
    let error: unknown;
    clientes.list(sinFiltros, 1, 20).subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/customers').error(new ProgressEvent('error'));
    expect(error).toBeInstanceOf(CustomerInfrastructureError);
  });
});

describe('HttpProvinceRepository · GET /api/provinces', () => {
  it('200: devuelve el array tal cual', () => {
    const { http, provincias } = preparar();
    const lista = [{ id: 'p1', code: '01', name: 'Madrid' }];
    let resultado: unknown;
    provincias.list().subscribe((r) => (resultado = r));
    http.expectOne('/api/provinces').flush(lista);
    expect(resultado).toEqual(lista);
  });

  it('401 se traduce a sesión terminada', () => {
    const { http, provincias } = preparar();
    let error: unknown;
    provincias.list().subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/provinces').flush({}, { status: 401, statusText: 'x' });
    expect(error).toBeInstanceOf(CustomerSessionExpiredError);
  });
});

describe('HttpCustomerRepository · GET y DELETE /api/customers/:id', () => {
  const detalle = { id: 'u1', name: 'Ana', streetAddress: 'Calle 1' };

  it('GET 200: devuelve el cliente', () => {
    const { http, clientes } = preparar();
    let resultado: unknown;
    clientes.get('u1').subscribe((r) => (resultado = r));
    const req = http.expectOne('/api/customers/u1');
    expect(req.request.method).toBe('GET');
    req.flush(detalle);
    expect(resultado).toEqual(detalle);
  });

  it.each([
    [400, InvalidCustomerInputError],
    [401, CustomerSessionExpiredError],
    [404, CustomerNotFoundError],
    [500, CustomerInfrastructureError],
  ])('GET %i se traduce a su error de dominio', (status, clase) => {
    const { http, clientes } = preparar();
    let error: unknown;
    clientes.get('u1').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/customers/u1').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });

  it('DELETE 204: completa sin valor', () => {
    const { http, clientes } = preparar();
    let completo = false;
    clientes.delete('u1').subscribe({ complete: () => (completo = true) });
    const req = http.expectOne('/api/customers/u1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(completo).toBe(true);
  });

  it.each([
    [400, InvalidCustomerInputError],
    [401, CustomerSessionExpiredError],
    [404, CustomerNotFoundError],
    [409, CustomerInUseError],
    [500, CustomerInfrastructureError],
  ])('DELETE %i se traduce a su error de dominio', (status, clase) => {
    const { http, clientes } = preparar();
    let error: unknown;
    clientes.delete('u1').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/customers/u1').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });
});
