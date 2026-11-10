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

/** Cualquier otro fallo (red, 5xx…). */
export class OrderInfrastructureError extends Error {
  constructor() {
    super('No se pudo cargar. Vuelve a intentarlo.');
    this.name = 'OrderInfrastructureError';
  }
}
