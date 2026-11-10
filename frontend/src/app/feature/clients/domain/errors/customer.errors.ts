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

/** 404: el cliente no existe. */
export class CustomerNotFoundError extends Error {
  constructor() {
    super('No se encontró lo que buscas.');
    this.name = 'CustomerNotFoundError';
  }
}

/** 409 (IN_USE): otro dato cita al cliente y no se borra. */
export class CustomerInUseError extends Error {
  constructor() {
    super('Otro dato lo cita.');
    this.name = 'CustomerInUseError';
  }
}

/** Cualquier otro fallo (red, 5xx…). */
export class CustomerInfrastructureError extends Error {
  constructor() {
    super('No se pudo cargar. Vuelve a intentarlo.');
    this.name = 'CustomerInfrastructureError';
  }
}
