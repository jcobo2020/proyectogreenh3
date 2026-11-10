import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RenderMode } from '@angular/ssr';
import { App } from './app';
import { routes } from './app.routes';
import { clientsRoutes } from './feature/clients/clients.routes';
import { serverRoutes } from './app.routes.server';
import { NoticeService } from './@core/services/notice.service';
import { CustomerCreateComponent } from './feature/clients/ui/customer-create/customer-create.component';
import { CustomerDetailComponent } from './feature/clients/ui/customer-detail/customer-detail.component';
import { CustomerListComponent } from './feature/clients/ui/customer-list/customer-list.component';

describe('App y rutas', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('crea la aplicación', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it('la raíz redirige a /clientes, protegida por authGuard y lazy', async () => {
    const clientes = routes.find((r) => r.path === 'clientes');
    expect(clientes?.canActivate?.length).toBe(1);
    expect(clientes?.loadChildren).toBeTypeOf('function');
    expect(routes[0].redirectTo).toBe('clientes');
    expect(await TestBed.inject(Router).parseUrl('/')).toBeTruthy();
  });

  it('la ruta de la feature carga la lista de clientes', async () => {
    const hijas = await (clientsRoutes[0].children ?? []);
    expect(hijas[0].component).toBe(CustomerListComponent);
    const cargadas = await (routes.find((r) => r.path === 'clientes')!.loadChildren as () => Promise<unknown>)();
    expect(cargadas).toBe(clientsRoutes);
  });

  it('la ruta literal nuevo va antes que :id y carga el alta; :id carga el detalle', () => {
    const hijas = clientsRoutes[0].children ?? [];
    expect(hijas.map((r) => r.path)).toEqual(['', 'nuevo', ':id']);
    expect(hijas[1].component).toBe(CustomerCreateComponent);
    expect(hijas[2].component).toBe(CustomerDetailComponent);
  });

  it('muestra el aviso del NoticeService', () => {
    TestBed.inject(NoticeService).show('Cliente eliminado.');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.aviso')?.textContent).toContain('Cliente eliminado.');
  });

  it('las rutas del servidor se pintan en el cliente', () => {
    expect(serverRoutes).toEqual([{ path: '**', renderMode: RenderMode.Client }]);
  });
});
