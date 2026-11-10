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

export class UnauthorizedError extends Error implements AppError {
  status = 401;
  code = 'UNAUTHORIZED';
  constructor() {
    super('UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}
