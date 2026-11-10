import { HttpInterceptorFn } from '@angular/common/http';
import { readToken } from '../guards/auth.guard';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readToken();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
