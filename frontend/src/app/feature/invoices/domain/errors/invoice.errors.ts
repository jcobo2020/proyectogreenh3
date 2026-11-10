/** Un dato que el servidor rechazó y por qué. */
export interface FieldDetail {
  field: string;
  message: string;
}

/** 400: un dato no es válido. */
export class InvalidInvoiceInputError extends Error {
  constructor(readonly details: FieldDetail[] = []) {
    super('Revisa los datos marcados.');
    this.name = 'InvalidInvoiceInputError';
  }
}

/** 401: no hay sesión válida. */
export class InvoiceSessionExpiredError extends Error {
  constructor() {
    super('Tu sesión terminó: vuelve a entrar.');
    this.name = 'InvoiceSessionExpiredError';
  }
}

/** 422: una regla del negocio (p. ej. la Idempotency-Key ya se usó con otro cuerpo). */
export class InvoiceBusinessRuleError extends Error {
  constructor() {
    super('No se pudo por una regla del negocio.');
    this.name = 'InvoiceBusinessRuleError';
  }
}

/** Cualquier otro fallo (red, 5xx…). */
export class InvoiceInfrastructureError extends Error {
  constructor() {
    super('No se pudo cargar. Vuelve a intentarlo.');
    this.name = 'InvoiceInfrastructureError';
  }
}
