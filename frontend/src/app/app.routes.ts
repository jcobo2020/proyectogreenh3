import { Routes } from '@angular/router';
import { authGuard } from './@core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'clientes' },
  {
    path: 'clientes',
    canActivate: [authGuard],
    loadChildren: () => import('./feature/clients/clients.routes').then((m) => m.clientsRoutes),
  },
];
