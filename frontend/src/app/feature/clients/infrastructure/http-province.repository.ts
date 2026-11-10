import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Province } from '../domain/models/customer.model';
import { ProvinceRepositoryPort } from '../domain/ports/province-repository.port';
import { traducir } from './http-error.translator';

@Injectable()
export class HttpProvinceRepository implements ProvinceRepositoryPort {
  private readonly http = inject(HttpClient);

  list(): Observable<Province[]> {
    return this.http.get<Province[]>(`${environment.apiBaseUrl}/provinces`).pipe(catchError(traducir));
  }
}
