import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { Routes } from '@angular/router';
import { jwtInterceptor } from '../../@core/interceptors/jwt.interceptor';
import { CreateInvoiceUseCase, SearchCustomerOptionsUseCase } from './application/invoice.use-cases';
import { CUSTOMER_OPTION_REPOSITORY } from './domain/ports/customer-option-repository.port';
import { INVOICE_REPOSITORY } from './domain/ports/invoice-repository.port';
import { HttpCustomerOptionRepository } from './infrastructure/http-customer-option.repository';
import { HttpInvoiceRepository } from './infrastructure/http-invoice.repository';
import { invoicesSessionInterceptor } from './infrastructure/session.interceptor';
import { InvoiceCreateComponent } from './ui/invoice-create/invoice-create.component';

// La lista de facturas (ruta vacía) es de otro work item; aquí solo «nueva».
export const invoicesRoutes: Routes = [
  {
    path: '',
    providers: [
      provideHttpClient(withFetch(), withInterceptors([jwtInterceptor, invoicesSessionInterceptor])),
      { provide: INVOICE_REPOSITORY, useClass: HttpInvoiceRepository },
      { provide: CUSTOMER_OPTION_REPOSITORY, useClass: HttpCustomerOptionRepository },
      CreateInvoiceUseCase,
      SearchCustomerOptionsUseCase,
    ],
    children: [{ path: 'nueva', component: InvoiceCreateComponent }],
  },
];
