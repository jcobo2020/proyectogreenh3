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

/** 409 al crear: ya existe otro cliente con el mismo email. */
export class DuplicateCustomerEmailError extends Error {
  constructor() {
    super('Ya existe otro con el mismo «Email».');
    this.name = 'DuplicateCustomerEmailError';
  }
}

/** 422 al crear: la Idempotency-Key ya se usó con otro cuerpo u otra operación. */
export class CustomerBusinessRuleError extends Error {
  constructor() {
    super('No se pudo por una regla del negocio.');
    this.name = 'CustomerBusinessRuleError';
  }
}

/** Cualquier otro fallo (red, 5xx…). */
export class CustomerInfrastructureError extends Error {
  constructor() {
    super('No se pudo cargar. Vuelve a intentarlo.');
    this.name = 'CustomerInfrastructureError';
  }
}

/** 412 al guardar: otra persona cambió el cliente desde que se cargó. */
export class CustomerChangedError extends Error {
  constructor() {
    super(
      'Otra persona cambió este cliente mientras lo editabas: se ha cargado lo de ahora; revísalo y vuelve a guardar.',
    );
    this.name = 'CustomerChangedError';
  }
}

/** 428 al guardar: falta la cabecera If-Match. */
export class CustomerPreconditionRequiredError extends Error {
  constructor() {
    super('Algo falló. Vuelve a intentarlo.');
    this.name = 'CustomerPreconditionRequiredError';
  }
}
