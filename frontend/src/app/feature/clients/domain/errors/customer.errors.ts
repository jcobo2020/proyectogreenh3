/** 400: un parámetro de la consulta no es válido. */
export class InvalidCustomerInputError extends Error {
  constructor() {
    super('Revisa los datos marcados.');
    this.name = 'InvalidCustomerInputError';
  }
}

/** 401: no hay sesión válida. */
export class CustomerSessionExpiredError extends Error {
  constructor() {
    super('Tu sesión terminó: vuelve a entrar.');
    this.name = 'CustomerSessionExpiredError';
  }
}

/** Cualquier otro fallo (red, 5xx…). */
export class CustomerInfrastructureError extends Error {
  constructor() {
    super('No se pudo cargar. Vuelve a intentarlo.');
    this.name = 'CustomerInfrastructureError';
  }
}
