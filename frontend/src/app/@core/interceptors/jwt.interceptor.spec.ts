import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { clientsSessionInterceptor } from '../../feature/clients/infrastructure/session.interceptor';
import { TOKEN_KEY } from '../guards/auth.guard';
import { jwtInterceptor } from './jwt.interceptor';

function preparar() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([jwtInterceptor, clientsSessionInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController) };
}

describe('interceptores', () => {
  beforeEach(() => sessionStorage.clear());

  it('jwtInterceptor añade el Bearer si hay token', () => {
    sessionStorage.setItem(TOKEN_KEY, 'abc');
    const { http, ctrl } = preparar();
    http.get('/api/x').subscribe();
    const req = ctrl.expectOne('/api/x');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush({});
  });

  it('jwtInterceptor no añade cabecera sin token', () => {
    const { http, ctrl } = preparar();
    http.get('/api/x').subscribe();
    const req = ctrl.expectOne('/api/x');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('el interceptor de sesión limpia el token ante un 401 y propaga el error', () => {
    sessionStorage.setItem(TOKEN_KEY, 'abc');
    const { http, ctrl } = preparar();
    let status = 0;
    http.get('/api/x').subscribe({ error: (e) => (status = e.status) });
    ctrl.expectOne('/api/x').flush({}, { status: 401, statusText: 'x' });
    expect(status).toBe(401);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('el interceptor de sesión deja pasar otros errores sin tocar la sesión', () => {
    sessionStorage.setItem(TOKEN_KEY, 'abc');
    const { http, ctrl } = preparar();
    let status = 0;
    http.get('/api/x').subscribe({ error: (e) => (status = e.status) });
    ctrl.expectOne('/api/x').flush({}, { status: 500, statusText: 'x' });
    expect(status).toBe(500);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('abc');
  });
});
