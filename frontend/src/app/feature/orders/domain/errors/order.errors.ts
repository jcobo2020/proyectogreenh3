/** Un dato que el servidor rechazó y por qué. */
export interface FieldDetail {
  field: string;
  message: string;
}

/** 404: el pedido no existe. */
export class OrderNotFoundError extends Error {
  constructor() {
    super('No se encontró lo que buscas.');
    this.name = 'OrderNotFoundError';
  }
}

/** 409: el pedido no está en un estado desde el que se puede hacer la acción. */
export class OrderConflictError extends Error {
  constructor() {
    super('El pedido cambió de estado.');
    this.name = 'OrderConflictError';
  }
}

/** 400: un dato no es válido. */
export class InvalidOrderInputError extends Error {
  /** Mensajes del servidor por campo (de `details` del 400), si los trae. */
  constructor(readonly details: FieldDetail[] = []) {
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
