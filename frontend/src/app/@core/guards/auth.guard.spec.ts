import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterStateSnapshot } from '@angular/router';
import { authGuard, clearSession, loginUrl, readToken, TOKEN_KEY } from './auth.guard';

function ejecutar(plataforma: string) {
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: plataforma }] });
  return TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/clientes' } as RouterStateSnapshot));
}

describe('authGuard', () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    assign = vi.fn();
    vi.stubGlobal('location', { assign });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('deja pasar con token', () => {
    sessionStorage.setItem(TOKEN_KEY, 'abc');
    expect(ejecutar('browser')).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('sin token lleva al login con returnUrl', () => {
    expect(ejecutar('browser')).toBe(false);
    expect(assign).toHaveBeenCalledWith('/login?returnUrl=%2Fclientes');
  });

  it('en el servidor no decide', () => {
    expect(ejecutar('server')).toBe(true);
  });

  it('readToken, clearSession y loginUrl', () => {
    sessionStorage.setItem(TOKEN_KEY, 'abc');
    expect(readToken()).toBe('abc');
    clearSession();
    expect(readToken()).toBeNull();
    expect(loginUrl('/x y')).toBe('/login?returnUrl=%2Fx%20y');
  });

  it('sin sessionStorage (servidor) no falla', () => {
    vi.stubGlobal('sessionStorage', undefined);
    expect(readToken()).toBeNull();
    expect(() => clearSession()).not.toThrow();
  });
});
