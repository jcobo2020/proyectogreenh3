import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { Routes } from '@angular/router';
import { jwtInterceptor } from '../../@core/interceptors/jwt.interceptor';
import {
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  ListProvincesUseCase,
} from './application/customer.use-cases';
import { CUSTOMER_REPOSITORY } from './domain/ports/customer-repository.port';
import { PROVINCE_REPOSITORY } from './domain/ports/province-repository.port';
import { HttpCustomerRepository } from './infrastructure/http-customer.repository';
import { HttpProvinceRepository } from './infrastructure/http-province.repository';
import { clientsSessionInterceptor } from './infrastructure/session.interceptor';
import { CustomerDetailComponent } from './ui/customer-detail/customer-detail.component';
import { CustomerListComponent } from './ui/customer-list/customer-list.component';

// Las rutas literales (nuevo) irán antes que la paramétrica (:id) cuando exista su pantalla.
export const clientsRoutes: Routes = [
  {
    path: '',
    providers: [
      provideHttpClient(withFetch(), withInterceptors([jwtInterceptor, clientsSessionInterceptor])),
      { provide: CUSTOMER_REPOSITORY, useClass: HttpCustomerRepository },
      { provide: PROVINCE_REPOSITORY, useClass: HttpProvinceRepository },
      ListCustomersUseCase,
      ListProvincesUseCase,
      GetCustomerUseCase,
      DeleteCustomerUseCase,
    ],
    children: [
      { path: '', component: CustomerListComponent },
      { path: ':id', component: CustomerDetailComponent },
    ],
  },
];
