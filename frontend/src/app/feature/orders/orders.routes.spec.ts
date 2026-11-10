import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { createSpyObj } from '../../../testing/spy-obj';
import { routes } from '../../app.routes';
import { ListCustomerOptionsUseCase, ListOrdersUseCase } from './application/order.use-cases';
import { ordersRoutes } from './orders.routes';

describe('orders.routes', () => {
  it('la ruta raíz de la feature declara sus proveedores y la lista en la ruta vacía', () => {
    expect(ordersRoutes[0].path).toBe('');
    expect(ordersRoutes[0].providers?.length).toBeGreaterThan(0);
    expect(ordersRoutes[0].children?.[0].path).toBe('');
  });

  it('app.routes monta /pedidos lazy y protegido por authGuard', async () => {
    const pedidos = routes.find((r) => r.path === 'pedidos')!;
    expect(pedidos.canActivate?.length).toBe(1);
    expect(await pedidos.loadChildren!()).toBe(ordersRoutes);
  });

  it('/pedidos pinta la lista', async () => {
    const orders = createSpyObj<ListOrdersUseCase>(['execute']);
    const customers = createSpyObj<ListCustomerOptionsUseCase>(['execute']);
    orders.execute.mockReturnValue(of({ items: [], total: 0, page: 1, pageSize: 20 }));
    customers.execute.mockReturnValue(of([]));
    const rutas: Routes = [
      {
        path: 'pedidos',
        providers: [
          { provide: ListOrdersUseCase, useValue: orders },
          { provide: ListCustomerOptionsUseCase, useValue: customers },
        ],
        children: ordersRoutes[0].children!,
      },
    ];
    TestBed.configureTestingModule({ providers: [provideRouter(rutas)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/pedidos');
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Pedidos');
  });
});
