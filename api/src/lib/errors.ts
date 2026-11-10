export interface AppError extends Error {
  status: number;
  code: string;
}

export class UnauthorizedError extends Error implements AppError {
  status = 401;
  code = 'UNAUTHORIZED';
  constructor() {
    super('UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}
