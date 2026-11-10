import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Province } from '../models/customer.model';

export interface ProvinceRepositoryPort {
  list(): Observable<Province[]>;
}

export const PROVINCE_REPOSITORY = new InjectionToken<ProvinceRepositoryPort>('PROVINCE_REPOSITORY');
