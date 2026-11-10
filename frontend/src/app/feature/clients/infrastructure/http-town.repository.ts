import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Town } from '../domain/models/customer.model';
import { TownRepositoryPort } from '../domain/ports/town-repository.port';
import { traducir } from './http-error.translator';

@Injectable()
export class HttpTownRepository implements TownRepositoryPort {
  private readonly http = inject(HttpClient);

  listByProvince(provinceId: string): Observable<Town[]> {
    const params = new HttpParams().set('provinceId', provinceId);
    return this.http.get<Town[]>(`${environment.apiBaseUrl}/towns`, { params }).pipe(catchError(traducir));
  }
}
