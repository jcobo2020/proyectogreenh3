import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { environment } from '../../../environments/environment';

export const TOKEN_KEY = 'token';

export function readToken(): string | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY);
}

export function clearSession(): void {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(TOKEN_KEY);
}

export function loginUrl(returnUrl: string): string {
  return `${environment.identityProviderUrl}?returnUrl=${encodeURIComponent(returnUrl)}`;
}

/** Sin token, lleva al destino de login con returnUrl. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  if (readToken()) return true;
  window.location.assign(loginUrl(state.url));
  return false;
};
