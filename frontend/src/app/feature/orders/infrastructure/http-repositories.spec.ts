import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderInfrastructureError,
  OrderSessionExpiredError,
} from '../domain/errors/order.errors';
import { HttpCustomerOptionRepository } from './http-customer-option.repository';
import { HttpOrderRepository } from './http-order.repository';
import { ordersSessionInterceptor } from './session.interceptor';

const sinFiltros = { customerId: '', status: '' };

function preparar() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpOrderRepository, HttpCustomerOptionRepository],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    pedidos: TestBed.inject(HttpOrderRepository),
    clientes: TestBed.inject(HttpCustomerOptionRepository),
  };
}

describe('HttpOrderRepository · GET /api/orders', () => {
  it('200: devuelve la página y envía page y pageSize', () => {
    const { http, pedidos } = preparar();
    const pagina = { items: [], total: 0, page: 1, pageSize: 20 };
    let resultado: unknown;
    pedidos.list(sinFiltros, 1, 20).subscribe((r) => (resultado = r));
    const req = http.expectOne((r) => r.url === '/api/orders');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.has('customerId')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    req.flush(pagina);
    expect(resultado).toEqual(pagina);
  });

  it('envía customerId y status como query', () => {
    const { http, pedidos } = preparar();
    pedidos.list({ customerId: 'c1', status: 'shipped' }, 2, 20).subscribe();
    const req = http.expectOne((r) => r.url === '/api/orders');
    expect(req.request.params.get('customerId')).toBe('c1');
    expect(req.request.params.get('status')).toBe('shipped');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], total: 0, page: 2, pageSize: 20 });
  });

  it.each([
    [400, InvalidOrderInputError],
    [401, OrderSessionExpiredError],
    [403, ForbiddenOrderError],
    [500, OrderInfrastructureError],
  ])('%i se traduce a su error de dominio', (status, clase) => {
    const { http, pedidos } = preparar();
    let error: unknown;
    pedidos.list(sinFiltros, 1, 20).subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/orders').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });

  it('un fallo de red es un error de infraestructura', () => {
    const { http, pedidos } = preparar();
    let error: unknown;
    pedidos.list(sinFiltros, 1, 20).subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/orders').error(new ProgressEvent('error'));
    expect(error).toBeInstanceOf(OrderInfrastructureError);
  });
});

describe('HttpCustomerOptionRepository · GET /api/customers', () => {
  it('200: devuelve solo id y name y pide la página de 100', () => {
    const { http, clientes } = preparar();
    let resultado: unknown;
    clientes.list().subscribe((r) => (resultado = r));
    const req = http.expectOne((r) => r.url === '/api/customers');
    expect(req.request.params.get('pageSize')).toBe('100');
    req.flush({ items: [{ id: 'c1', name: 'Ana', email: 'a@b.c' }], total: 1, page: 1, pageSize: 100 });
    expect(resultado).toEqual([{ id: 'c1', name: 'Ana' }]);
  });

  it.each([
    [400, InvalidOrderInputError],
    [401, OrderSessionExpiredError],
    [500, OrderInfrastructureError],
  ])('%i se traduce a su error de dominio', (status, clase) => {
    const { http, clientes } = preparar();
    let error: unknown;
    clientes.list().subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/customers').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });
});

describe('ordersSessionInterceptor', () => {
  function con401(status: number) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([ordersSessionInterceptor])), provideHttpClientTesting()],
    });
    sessionStorage.setItem('token', 't');
    let error: any;
    TestBed.inject(HttpClient).get('/api/orders').subscribe({ error: (e) => (error = e) });
    TestBed.inject(HttpTestingController).expectOne('/api/orders').flush({}, { status, statusText: 'x' });
    return error;
  }

  afterEach(() => sessionStorage.clear());

  it('ante un 401 limpia la sesión y relanza el error', () => {
    expect(con401(401).status).toBe(401);
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('ante un 403 conserva la sesión y relanza el error', () => {
    expect(con401(403).status).toBe(403);
    expect(sessionStorage.getItem('token')).toBe('t');
  });
});
