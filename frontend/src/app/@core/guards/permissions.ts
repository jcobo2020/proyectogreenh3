import { readToken } from './auth.guard';

/**
 * Permisos de la sesión: el claim `permissions` (lista de textos) del payload del token.
 * Devuelve null si la sesión no los declara (no se puede saber: decide la API con su 403).
 */
export function sessionPermissions(): string[] | null {
  const token = readToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    return Array.isArray(claims?.permissions)
      ? claims.permissions.filter((p: unknown) => typeof p === 'string')
      : null;
  } catch {
    return null;
  }
}

/** true solo si la sesión declara sus permisos y falta este. */
export function lacksPermission(permission: string): boolean {
  const permissions = sessionPermissions();
  return permissions !== null && !permissions.includes(permission);
}
