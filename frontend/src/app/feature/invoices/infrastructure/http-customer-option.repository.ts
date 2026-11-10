import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CustomerOption } from '../domain/models/invoice.model';
import { CustomerOptionRepositoryPort } from '../domain/ports/customer-option-repository.port';
import { traducir } from './http-error.translator';

@Injectable()
export class HttpCustomerOptionRepository implements CustomerOptionRepositoryPort {
  private readonly http = inject(HttpClient);

  search(name: string): Observable<CustomerOption[]> {
    // Solo la primera página: no se cargan todas.
    const params = new HttpParams().set('name', name);
    return this.http
      .get<{ items: { id: string; name: string }[] }>(`${environment.apiBaseUrl}/customers`, { params })
      .pipe(
        map((page) => page.items.map(({ id, name }) => ({ id, name }))),
        catchError(traducir),
      );
  }
}
