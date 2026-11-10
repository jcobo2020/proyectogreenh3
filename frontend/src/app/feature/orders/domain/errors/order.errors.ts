/** 400: un parámetro de la consulta no es válido. */
export class InvalidOrderInputError extends Error {
  constructor() {
    super('Revisa los datos marcados.');
    this.name = 'InvalidOrderInputError';
  }
}

/** 401: no hay sesión válida. */
export class OrderSessionExpiredError extends Error {
  constructor() {
    super('Tu sesión terminó: vuelve a entrar.');
    this.name = 'OrderSessionExpiredError';
  }
}

/** 403: falta el permiso. */
export class ForbiddenOrderError extends Error {
  constructor() {
    super('No tienes permiso para hacer esto.');
    this.name = 'ForbiddenOrderError';
  }
}

/** 422: una regla del negocio (p. ej. la Idempotency-Key ya se usó con otro cuerpo). */
export class OrderBusinessRuleError extends Error {
  constructor() {
    super('No se pudo por una regla del negocio.');
    this.name = 'OrderBusinessRuleError';
  }
}

/** Cualquier otro fallo (red, 5xx…). */
export class OrderInfrastructureError extends Error {
  constructor() {
    super('No se pudo cargar. Vuelve a intentarlo.');
    this.name = 'OrderInfrastructureError';
  }
}
