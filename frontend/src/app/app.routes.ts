import { Routes } from '@angular/router';
import { authGuard } from './@core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'clientes' },
  {
    path: 'clientes',
    canActivate: [authGuard],
    loadChildren: () => import('./feature/clients/clients.routes').then((m) => m.clientsRoutes),
  },
  {
    path: 'pedidos',
    canActivate: [authGuard],
    loadChildren: () => import('./feature/orders/orders.routes').then((m) => m.ordersRoutes),
  },
  {
    path: 'facturas',
    canActivate: [authGuard],
    loadChildren: () => import('./feature/invoices/invoices.routes').then((m) => m.invoicesRoutes),
  },
];
