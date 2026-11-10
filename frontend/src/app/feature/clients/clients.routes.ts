import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { Routes } from '@angular/router';
import { jwtInterceptor } from '../../@core/interceptors/jwt.interceptor';
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  ListProvincesUseCase,
  ListTownsUseCase,
} from './application/customer.use-cases';
import { CUSTOMER_REPOSITORY } from './domain/ports/customer-repository.port';
import { PROVINCE_REPOSITORY } from './domain/ports/province-repository.port';
import { TOWN_REPOSITORY } from './domain/ports/town-repository.port';
import { HttpCustomerRepository } from './infrastructure/http-customer.repository';
import { HttpProvinceRepository } from './infrastructure/http-province.repository';
import { HttpTownRepository } from './infrastructure/http-town.repository';
import { clientsSessionInterceptor } from './infrastructure/session.interceptor';
import { CustomerCreateComponent } from './ui/customer-create/customer-create.component';
import { CustomerDetailComponent } from './ui/customer-detail/customer-detail.component';
import { CustomerListComponent } from './ui/customer-list/customer-list.component';

// Las rutas literales (nuevo) van antes que la paramétrica (:id).
export const clientsRoutes: Routes = [
  {
    path: '',
    providers: [
      provideHttpClient(withFetch(), withInterceptors([jwtInterceptor, clientsSessionInterceptor])),
      { provide: CUSTOMER_REPOSITORY, useClass: HttpCustomerRepository },
      { provide: PROVINCE_REPOSITORY, useClass: HttpProvinceRepository },
      { provide: TOWN_REPOSITORY, useClass: HttpTownRepository },
      ListCustomersUseCase,
      ListProvincesUseCase,
      ListTownsUseCase,
      GetCustomerUseCase,
      CreateCustomerUseCase,
      DeleteCustomerUseCase,
    ],
    children: [
      { path: '', component: CustomerListComponent },
      { path: 'nuevo', component: CustomerCreateComponent },
      { path: ':id', component: CustomerDetailComponent },
    ],
  },
];
