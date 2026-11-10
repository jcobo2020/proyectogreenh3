import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { Routes } from '@angular/router';
import { jwtInterceptor } from '../../@core/interceptors/jwt.interceptor';
import { CreateOrderUseCase, ListCustomerOptionsUseCase, ListOrdersUseCase } from './application/order.use-cases';
import { CUSTOMER_OPTION_REPOSITORY } from './domain/ports/customer-option-repository.port';
import { ORDER_REPOSITORY } from './domain/ports/order-repository.port';
import { HttpCustomerOptionRepository } from './infrastructure/http-customer-option.repository';
import { HttpOrderRepository } from './infrastructure/http-order.repository';
import { ordersSessionInterceptor } from './infrastructure/session.interceptor';
import { OrderCreateComponent } from './ui/order-create/order-create.component';
import { OrderListComponent } from './ui/order-list/order-list.component';

// Las rutas literales (nuevo) van antes que las paramétricas; /:id llega con el work item de su pantalla.
export const ordersRoutes: Routes = [
  {
    path: '',
    providers: [
      provideHttpClient(withFetch(), withInterceptors([jwtInterceptor, ordersSessionInterceptor])),
      { provide: ORDER_REPOSITORY, useClass: HttpOrderRepository },
      { provide: CUSTOMER_OPTION_REPOSITORY, useClass: HttpCustomerOptionRepository },
      ListOrdersUseCase,
      CreateOrderUseCase,
      ListCustomerOptionsUseCase,
    ],
    children: [
      { path: '', component: OrderListComponent },
      { path: 'nuevo', component: OrderCreateComponent },
    ],
  },
];
