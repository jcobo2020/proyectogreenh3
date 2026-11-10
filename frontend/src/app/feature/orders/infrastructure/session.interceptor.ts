import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { clearSession } from '../../../@core/guards/auth.guard';

/** Ante un 401 limpia la sesión; el resto pasa sin transformar para que lo traduzca el repositorio. */
export const ordersSessionInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error) => {
      if (error?.status === 401) clearSession();
      return throwError(() => error);
    }),
  );
