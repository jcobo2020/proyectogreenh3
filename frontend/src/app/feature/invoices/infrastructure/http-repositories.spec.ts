import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  InvalidInvoiceInputError,
  InvoiceBusinessRuleError,
  InvoiceInfrastructureError,
  InvoiceSessionExpiredError,
} from '../domain/errors/invoice.errors';
import { HttpCustomerOptionRepository } from './http-customer-option.repository';
import { HttpInvoiceRepository } from './http-invoice.repository';
import { invoicesSessionInterceptor } from './session.interceptor';

const nueva = { customerId: 'c1', date: '2026-11-01', amount: 25.5 };

function preparar() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpInvoiceRepository, HttpCustomerOptionRepository],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    facturas: TestBed.inject(HttpInvoiceRepository),
    clientes: TestBed.inject(HttpCustomerOptionRepository),
  };
}

describe('HttpCustomerOptionRepository · GET /api/customers', () => {
  it('200: envía name y devuelve id y name de cada cliente', () => {
    const { http, clientes } = preparar();
    let resultado: unknown;
    clientes.search('an').subscribe((r) => (resultado = r));
    const req = http.expectOne((r) => r.url === '/api/customers');
    expect(req.request.params.get('name')).toBe('an');
    expect(req.request.params.has('page')).toBe(false);
    req.flush({ items: [{ id: 'c1', name: 'Ana', email: 'a@x.com' }], total: 1, page: 1, pageSize: 20 });
    expect(resultado).toEqual([{ id: 'c1', name: 'Ana' }]);
  });

  it.each([
    [400, InvalidInvoiceInputError],
    [401, InvoiceSessionExpiredError],
    [500, InvoiceInfrastructureError],
    [0, InvoiceInfrastructureError],
  ])('%i se traduce a su error de dominio', (status, clase) => {
    const { http, clientes } = preparar();
    let error: unknown;
    clientes.search('an').subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/customers').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });
});

describe('HttpInvoiceRepository · POST /api/invoices', () => {
  it('201: envía el cuerpo y la cabecera Idempotency-Key', () => {
    const { http, facturas } = preparar();
    const creada = { id: 'f1', ...nueva, number: 'F-2026-000001', customerName: 'Ana' };
    let resultado: unknown;
    facturas.create(nueva, 'clave-1').subscribe((r) => (resultado = r));
    const req = http.expectOne('/api/invoices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(nueva);
    expect(req.request.headers.get('Idempotency-Key')).toBe('clave-1');
    req.flush(creada, { status: 201, statusText: 'Created' });
    expect(resultado).toEqual(creada);
  });

  it.each([
    [401, InvoiceSessionExpiredError],
    [422, InvoiceBusinessRuleError],
    [500, InvoiceInfrastructureError],
  ])('%i se traduce a su error de dominio', (status, clase) => {
    const { http, facturas } = preparar();
    let error: unknown;
    facturas.create(nueva, 'k').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/invoices').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });

  it('400 lleva los details por campo; ignora los que no tienen forma de campo + mensaje', () => {
    const { http, facturas } = preparar();
    let error: unknown;
    facturas.create(nueva, 'k').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/invoices').flush(
      { code: 'VALIDATION_ERROR', details: [{ field: 'date', message: 'futura' }, { x: 1 }] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(error).toBeInstanceOf(InvalidInvoiceInputError);
    expect((error as InvalidInvoiceInputError).details).toEqual([{ field: 'date', message: 'futura' }]);
  });

  it('400 sin details da una lista vacía', () => {
    const { http, facturas } = preparar();
    let error: unknown;
    facturas.create(nueva, 'k').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/invoices').flush({}, { status: 400, statusText: 'Bad Request' });
    expect((error as InvalidInvoiceInputError).details).toEqual([]);
  });
});

describe('invoicesSessionInterceptor', () => {
  function conInterceptor() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([invoicesSessionInterceptor])),
        provideHttpClientTesting(),
        HttpInvoiceRepository,
      ],
    });
    return { http: TestBed.inject(HttpTestingController), facturas: TestBed.inject(HttpInvoiceRepository) };
  }

  afterEach(() => sessionStorage.clear());

  it('ante un 401 limpia la sesión y el repositorio lo traduce', () => {
    sessionStorage.setItem('token', 'x');
    const { http, facturas } = conInterceptor();
    let error: unknown;
    facturas.create(nueva, 'k').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/invoices').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(error).toBeInstanceOf(InvoiceSessionExpiredError);
  });

  it('el resto de errores pasa sin tocar la sesión', () => {
    sessionStorage.setItem('token', 'x');
    const { http, facturas } = conInterceptor();
    let error: unknown;
    facturas.create(nueva, 'k').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/invoices').flush({}, { status: 422, statusText: 'x' });
    expect(sessionStorage.getItem('token')).toBe('x');
    expect(error).toBeInstanceOf(InvoiceBusinessRuleError);
  });
});
