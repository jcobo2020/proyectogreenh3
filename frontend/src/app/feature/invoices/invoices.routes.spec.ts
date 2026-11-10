import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { createSpyObj } from '../../../testing/spy-obj';
import { routes } from '../../app.routes';
import { CreateInvoiceUseCase, SearchCustomerOptionsUseCase } from './application/invoice.use-cases';
import { invoicesRoutes } from './invoices.routes';

describe('invoices.routes', () => {
  it('la ruta raíz de la feature declara sus proveedores y «nueva»', () => {
    expect(invoicesRoutes[0].path).toBe('');
    expect(invoicesRoutes[0].providers?.length).toBeGreaterThan(0);
    expect(invoicesRoutes[0].children!.map((r) => r.path)).toEqual(['nueva']);
  });

  it('app.routes monta /facturas lazy y protegido por authGuard', async () => {
    const facturas = routes.find((r) => r.path === 'facturas')!;
    expect(facturas.canActivate?.length).toBe(1);
    expect(await facturas.loadChildren!()).toBe(invoicesRoutes);
  });

  it('/facturas/nueva pinta el formulario', async () => {
    const rutas: Routes = [
      {
        path: 'facturas',
        providers: [
          { provide: SearchCustomerOptionsUseCase, useValue: createSpyObj<SearchCustomerOptionsUseCase>(['execute']) },
          { provide: CreateInvoiceUseCase, useValue: createSpyObj<CreateInvoiceUseCase>(['execute']) },
        ],
        children: invoicesRoutes[0].children!,
      },
    ];
    TestBed.configureTestingModule({ providers: [provideRouter(rutas)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/facturas/nueva');
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Nueva factura');
  });
});
