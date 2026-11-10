import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { createSpyObj } from '../../../testing/spy-obj';
import { NoticeService } from '../../@core/services/notice.service';
import {
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  ListProvincesUseCase,
} from './application/customer.use-cases';
import { clientsRoutes } from './clients.routes';
import { CustomerInUseError } from './domain/errors/customer.errors';
import { CustomerDetail, CustomerListItem } from './domain/models/customer.model';
import { CUSTOMER_REPOSITORY, CustomerRepositoryPort } from './domain/ports/customer-repository.port';
import { PROVINCE_REPOSITORY, ProvinceRepositoryPort } from './domain/ports/province-repository.port';

const ana: CustomerListItem = {
  id: 'id-ana',
  name: 'Ana Pérez',
  email: 'ana@mail.test',
  provinceId: 'p1',
  provinceName: 'Madrid',
  townId: 't1',
  townName: 'Getafe',
  status: 'active',
};
const luis: CustomerListItem = { ...ana, id: 'id-luis', name: 'Luis Gómez', email: 'luis@mail.test' };

/**
 * Prueba de punta a punta del recorrido
 * «Lista de clientes → Detalle de cliente → Confirmar eliminación de cliente → Lista de clientes».
 * Usa las rutas reales de la feature, el router real y los componentes y casos de uso reales;
 * solo el puerto del repositorio (el contrato HTTP de /api) es un doble con estado, como el backend.
 */
function preparar(opciones: { fallaBorrado?: Error } = {}) {
  let clientes = [ana, luis];
  const repo = createSpyObj<CustomerRepositoryPort>(['list', 'get', 'getVersioned', 'update', 'delete', 'create']);
  repo.list.mockImplementation(() => of({ items: clientes, total: clientes.length, page: 1, pageSize: 20 }));
  repo.get.mockImplementation((id: string) => {
    const c = clientes.find((x) => x.id === id)!;
    return of({ ...c, streetAddress: 'Calle Mayor 1', version: 1 } as CustomerDetail);
  });
  repo.delete.mockImplementation((id: string) => {
    if (opciones.fallaBorrado) return throwError(() => opciones.fallaBorrado);
    clientes = clientes.filter((c) => c.id !== id);
    return of(undefined);
  });
  const provincias = createSpyObj<ProvinceRepositoryPort>(['list']);
  provincias.list.mockReturnValue(of([{ id: 'p1', code: '28', name: 'Madrid' }]));

  // Mismas rutas hijas que la feature (mismo orden); solo se sustituyen los proveedores HTTP.
  const rutas: Routes = [
    {
      path: 'clientes',
      providers: [
        { provide: CUSTOMER_REPOSITORY, useValue: repo },
        { provide: PROVINCE_REPOSITORY, useValue: provincias },
        ListCustomersUseCase,
        ListProvincesUseCase,
        GetCustomerUseCase,
        DeleteCustomerUseCase,
      ],
      children: clientsRoutes[0].children!,
    },
  ];
  TestBed.configureTestingModule({ providers: [provideRouter(rutas)] });
  return { repo, provincias };
}

const botonConTexto = (el: HTMLElement, selector: string, texto: string) =>
  Array.from(el.querySelectorAll<HTMLElement>(selector)).find((b) => b.textContent?.includes(texto))!;

describe('Recorrido · Lista de clientes → Detalle → Confirmar eliminación → Lista de clientes', () => {
  it('AC-25: lleva a la persona de cada paso al siguiente hasta la lista, ya sin el cliente eliminado', async () => {
    const { repo } = preparar();
    const harness = await RouterTestingHarness.create();
    const location = TestBed.inject(Location);
    const notice = TestBed.inject(NoticeService);

    // 1 · Lista de clientes
    await harness.navigateByUrl('/clientes');
    let el = harness.routeNativeElement as HTMLElement;
    expect(location.path()).toBe('/clientes');
    expect(el.querySelector('h1')?.textContent).toContain('Clientes');
    expect(el.textContent).toContain('Ana Pérez');
    expect(el.textContent).toContain('Luis Gómez');

    // 2 · «Ver detalle» de la fila de Ana → Detalle de cliente (/clientes/:id)
    const filaAna = Array.from(el.querySelectorAll('tbody tr')).find((f) => f.textContent?.includes('Ana Pérez'))!;
    (filaAna.querySelector('a[aria-label="Ver detalle"]') as HTMLElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    expect(location.path()).toBe('/clientes/id-ana');
    expect(repo.get).toHaveBeenCalledWith('id-ana');
    expect(el.querySelector('h1')?.textContent).toContain('Detalle de cliente');
    expect(el.querySelector('dl div dd')?.textContent).toBe('id-ana');
    expect(el.textContent).toContain('Ana Pérez');

    // 3 · «Eliminar cliente» abre el diálogo «Confirmar eliminación de cliente», sin borrar nada aún
    botonConTexto(el, 'button', 'Eliminar cliente').click();
    harness.detectChanges();
    const dialogo = el.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogo.textContent).toContain('Confirmar eliminación de cliente');
    expect(dialogo.textContent).toContain('Esta acción no se puede deshacer. ¿Deseas eliminar el cliente?');
    expect(repo.delete).not.toHaveBeenCalled();

    // 4 · Confirmar: DELETE solo de ese id, cierra el diálogo, avisa y vuelve a /clientes
    botonConTexto(dialogo, 'button', 'Eliminar cliente').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    expect(repo.delete).toHaveBeenCalledTimes(1);
    expect(repo.delete).toHaveBeenCalledWith('id-ana');
    expect(notice.message()).toBe('Cliente eliminado.');
    expect(location.path()).toBe('/clientes');
    expect(el.querySelector('[role="dialog"]')).toBeNull();

    // 5 · Lista de clientes otra vez, vuelta a pedir al servidor (sin caché): ya no está Ana
    expect(repo.list).toHaveBeenCalledTimes(2);
    expect(el.querySelector('h1')?.textContent).toContain('Clientes');
    expect(el.textContent).not.toContain('Ana Pérez');
    expect(el.textContent).toContain('Luis Gómez');
  });

  it('«Cancelar» cierra el diálogo y deja a la persona en el detalle, sin borrar', async () => {
    const { repo } = preparar();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/clientes/id-luis');
    const el = harness.routeNativeElement as HTMLElement;
    botonConTexto(el, 'button', 'Eliminar cliente').click();
    harness.detectChanges();
    botonConTexto(el.querySelector('[role="dialog"]') as HTMLElement, 'button', 'Cancelar').click();
    harness.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(TestBed.inject(Location).path()).toBe('/clientes/id-luis');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('si el borrado falla (409), el recorrido no avanza: sigue en el detalle con el aviso y el diálogo abierto', async () => {
    const { repo } = preparar({ fallaBorrado: new CustomerInUseError() });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/clientes/id-ana');
    const el = harness.routeNativeElement as HTMLElement;
    botonConTexto(el, 'button', 'Eliminar cliente').click();
    harness.detectChanges();
    botonConTexto(el.querySelector('[role="dialog"]') as HTMLElement, 'button', 'Eliminar cliente').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(repo.delete).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Router).url).toBe('/clientes/id-ana');
    expect(el.querySelector('[role="dialog"]')?.textContent).toContain('Otro dato lo cita.');
    expect(TestBed.inject(NoticeService).message()).toBeNull();
  });
});
