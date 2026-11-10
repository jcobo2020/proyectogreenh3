// Normalización de email compartida por el validador y el servicio (una sola copia).
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
