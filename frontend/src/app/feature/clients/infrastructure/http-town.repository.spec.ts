import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  CustomerInfrastructureError,
  CustomerSessionExpiredError,
  InvalidCustomerInputError,
} from '../domain/errors/customer.errors';
import { HttpTownRepository } from './http-town.repository';

function preparar() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpTownRepository],
  });
  return { http: TestBed.inject(HttpTestingController), pueblos: TestBed.inject(HttpTownRepository) };
}

describe('HttpTownRepository · GET /api/towns', () => {
  it('200: pide con provinceId como query y devuelve el array', () => {
    const { http, pueblos } = preparar();
    const lista = [{ id: 't1', provinceId: 'p1', name: 'Getafe' }];
    let resultado: unknown;
    pueblos.listByProvince('p1').subscribe((r) => (resultado = r));
    const req = http.expectOne((r) => r.url === '/api/towns');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('provinceId')).toBe('p1');
    req.flush(lista);
    expect(resultado).toEqual(lista);
  });

  it.each([
    [400, InvalidCustomerInputError],
    [401, CustomerSessionExpiredError],
    [500, CustomerInfrastructureError],
  ])('%i se traduce a su error de dominio', (status, clase) => {
    const { http, pueblos } = preparar();
    let error: unknown;
    pueblos.listByProvince('p1').subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/towns').flush({}, { status, statusText: 'x' });
    expect(error).toBeInstanceOf(clase);
  });
});
