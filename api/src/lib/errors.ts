export interface AppError extends Error {
  status: number;
  code: string;
}

export interface ValidationDetail {
  field: string;
  message: string;
}

export class ValidationError extends Error implements AppError {
  status = 400;
  code = 'VALIDATION_ERROR';
  details: ValidationDetail[];
  constructor(message: string, details: ValidationDetail[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class DuplicateEmailError extends Error implements AppError {
  status = 409;
  code = 'CONFLICT';
  constructor() {
    super('Ya existe otro cliente con ese email');
    this.name = 'DuplicateEmailError';
  }
}

export class CustomerNotFoundError extends Error implements AppError {
  status = 404;
  code = 'NOT_FOUND';
  constructor() {
    super('El cliente no existe');
    this.name = 'CustomerNotFoundError';
  }
}

export class IdempotencyKeyReusedError extends Error implements AppError {
  status = 422;
  code = 'BUSINESS_RULE';
  constructor() {
    super('La Idempotency-Key ya se usó con otro cuerpo u otra operación');
    this.name = 'IdempotencyKeyReusedError';
  }
}

export class PreconditionFailedError extends Error implements AppError {
  status = 412;
  code = 'PRECONDITION_FAILED';
  constructor() {
    super('Otro cambió el cliente desde que lo cargaste; no se guardó. Vuelve a cargarlo');
    this.name = 'PreconditionFailedError';
  }
}

export class PreconditionRequiredError extends Error implements AppError {
  status = 428;
  code = 'PRECONDITION_REQUIRED';
  constructor() {
    super('Falta la cabecera If-Match');
    this.name = 'PreconditionRequiredError';
  }
}

export class CustomerInUseError extends Error implements AppError {
  status = 409;
  code = 'IN_USE';
  constructor() {
    super('Otro dato cita al cliente; no se borra');
    this.name = 'CustomerInUseError';
  }
}

export class UnauthorizedError extends Error implements AppError {
  status = 401;
  code = 'UNAUTHORIZED';
  constructor() {
    super('UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}
