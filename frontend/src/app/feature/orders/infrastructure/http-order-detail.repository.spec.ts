import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderConflictError,
  OrderInfrastructureError,
  OrderNotFoundError,
  OrderSessionExpiredError,
} from '../domain/errors/order.errors';
import { HttpOrderRepository } from './http-order.repository';

function preparar() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpOrderRepository],
  });
  return { http: TestBed.inject(HttpTestingController), repo: TestBed.inject(HttpOrderRepository) };
}

describe('HttpOrderRepository · detalle y acciones', () => {
  it('GET /api/orders/:id devuelve el pedido', () => {
    const { http, repo } = preparar();
    const pedido = { id: 'o1', number: 'P-1', customerId: 'c1', customerName: 'Ana', date: '2026-11-01', amount: 5, status: 'pending' };
    let resultado: unknown;
    repo.get('o1').subscribe((r) => (resultado = r));
    const req = http.expectOne('/api/orders/o1');
    expect(req.request.method).toBe('GET');
    req.flush(pedido);
    expect(resultado).toEqual(pedido);
  });

  it('POST /api/orders/:id/confirm y /deliver, sin cuerpo útil', () => {
    const { http, repo } = preparar();
    repo.confirm('o1').subscribe();
    const confirmar = http.expectOne('/api/orders/o1/confirm');
    expect(confirmar.request.method).toBe('POST');
    confirmar.flush({ id: 'o1', status: 'confirmed' });
    repo.deliver('o1').subscribe();
    const entregar = http.expectOne('/api/orders/o1/deliver');
    expect(entregar.request.method).toBe('POST');
    entregar.flush({ id: 'o1', status: 'delivered' });
  });

  it('POST /api/orders/:id/ship envía { carrier, shippingDate }', () => {
    const { http, repo } = preparar();
    repo.ship('o1', { carrier: 'DHL', shippingDate: '2026-11-02' }).subscribe();
    const req = http.expectOne('/api/orders/o1/ship');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ carrier: 'DHL', shippingDate: '2026-11-02' });
    req.flush({ id: 'o1', status: 'shipped' });
  });

  it('POST /api/orders/:id/cancel envía { cancellationReason }', () => {
    const { http, repo } = preparar();
    repo.cancel('o1', { cancellationReason: 'Duplicado' }).subscribe();
    const req = http.expectOne('/api/orders/o1/cancel');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ cancellationReason: 'Duplicado' });
    req.flush({ id: 'o1', status: 'cancelled' });
  });

  it.each([
    [400, InvalidOrderInputError],
    [401, OrderSessionExpiredError],
    [403, ForbiddenOrderError],
    [404, OrderNotFoundError],
    [409, OrderConflictError],
    [500, OrderInfrastructureError],
  ])('%i se traduce a su error de dominio en cada operación', (status, clase) => {
    const { http, repo } = preparar();
    const llamadas = [
      { obs: repo.get('o1'), url: '/api/orders/o1' },
      { obs: repo.confirm('o1'), url: '/api/orders/o1/confirm' },
      { obs: repo.ship('o1', { carrier: 'a', shippingDate: '2026-11-02' }), url: '/api/orders/o1/ship' },
      { obs: repo.cancel('o1', { cancellationReason: 'a' }), url: '/api/orders/o1/cancel' },
      { obs: repo.deliver('o1'), url: '/api/orders/o1/deliver' },
    ];
    for (const { obs, url } of llamadas) {
      let error: unknown;
      obs.subscribe({ error: (e) => (error = e) });
      http.expectOne(url).flush({}, { status, statusText: 'x' });
      expect(error).toBeInstanceOf(clase);
    }
  });

  it('un 400 conserva el mensaje del servidor por campo (details)', () => {
    const { http, repo } = preparar();
    let error: InvalidOrderInputError | undefined;
    repo.ship('o1', { carrier: '', shippingDate: '' }).subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/orders/o1/ship').flush(
      {
        code: 'VALIDATION_ERROR',
        message: 'x',
        details: [{ field: 'carrier', message: 'Demasiado largo' }, { campo: 'raro' }, null],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(error?.details).toEqual([{ field: 'carrier', message: 'Demasiado largo' }]);
  });

  it('un 400 sin details deja la lista vacía', () => {
    const { http, repo } = preparar();
    let error: InvalidOrderInputError | undefined;
    repo.get('o1').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/orders/o1').flush({ code: 'VALIDATION_ERROR' }, { status: 400, statusText: 'x' });
    expect(error?.details).toEqual([]);
  });

  it('un fallo de red es un error de infraestructura', () => {
    const { http, repo } = preparar();
    let error: unknown;
    repo.get('o1').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/orders/o1').error(new ProgressEvent('error'));
    expect(error).toBeInstanceOf(OrderInfrastructureError);
  });
});
