import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Town } from '../models/customer.model';

export interface TownRepositoryPort {
  listByProvince(provinceId: string): Observable<Town[]>;
}

export const TOWN_REPOSITORY = new InjectionToken<TownRepositoryPort>('TOWN_REPOSITORY');
