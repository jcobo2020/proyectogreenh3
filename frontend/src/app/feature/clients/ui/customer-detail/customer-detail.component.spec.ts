import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { NoticeService } from '../../../../@core/services/notice.service';
import { createSpyObj } from '../../../../../testing/spy-obj';
import { DeleteCustomerUseCase, GetCustomerUseCase } from '../../application/customer.use-cases';
import {
  CustomerInUseError,
  CustomerInfrastructureError,
  CustomerNotFoundError,
  CustomerSessionExpiredError,
  InvalidCustomerInputError,
} from '../../domain/errors/customer.errors';
import { CustomerDetail } from '../../domain/models/customer.model';
import { CustomerDetailComponent } from './customer-detail.component';

const cliente: CustomerDetail = {
  id: 'abc-123',
  name: 'Ana Pérez',
  email: 'ana@mail.test',
  streetAddress: 'Calle Mayor 1',
  provinceId: 'p1',
  provinceName: 'Madrid',
  townId: 't1',
  townName: 'Getafe',
  status: 'active',
  version: 1,
};

function crear(opciones: { get?: Observable<CustomerDetail>; del?: Observable<void> } = {}) {
  const get = createSpyObj<GetCustomerUseCase>(['execute']);
  const del = createSpyObj<DeleteCustomerUseCase>(['execute']);
  get.execute.mockReturnValue(opciones.get ?? of(cliente));
  del.execute.mockReturnValue(opciones.del ?? of(undefined));
  TestBed.configureTestingModule({
    imports: [CustomerDetailComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'abc-123' } } } },
      { provide: GetCustomerUseCase, useValue: get },
      { provide: DeleteCustomerUseCase, useValue: del },
    ],
  });
  const fixture = TestBed.createComponent(CustomerDetailComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button, a')).find((b) => b.textContent?.includes(texto)) as HTMLElement;
  const abrirDialogo = () => {
    boton('Eliminar cliente').click();
    fixture.detectChanges();
  };
  const confirmar = () => {
    const botones = el.querySelectorAll('.dialogo__pie button');
    (botones[1] as HTMLElement).click();
    fixture.detectChanges();
  };
  return { fixture, el, get, del, boton, abrirDialogo, confirmar };
}

describe('CustomerDetailComponent · carga', () => {
  it('AC-07: pide el cliente por el :id de la ruta y muestra todos sus datos', () => {
    const { el, get } = crear();
    expect(get.execute).toHaveBeenCalledTimes(1);
    expect(get.execute).toHaveBeenCalledWith('abc-123');
    const texto = el.textContent ?? '';
    for (const dato of ['abc-123', 'Ana Pérez', 'ana@mail.test', 'Calle Mayor 1', 'Madrid', 'Getafe', 'Activo']) {
      expect(texto).toContain(dato);
    }
  });

  it('[fld_j99ibpor:partida] «ID» empieza con el :id de la ruta', () => {
    const { el } = crear();
    expect(el.querySelector('dl div dd')?.textContent).toBe('abc-123');
  });

  it('muestra el estado Inactivo con su etiqueta', () => {
    const { el } = crear({ get: of({ ...cliente, status: 'inactive' }) });
    expect(el.textContent).toContain('Inactivo');
  });

  it('AC-08: mientras espera dice «Cargando…»', () => {
    const { el } = crear({ get: NEVER });
    expect(el.textContent).toContain('Cargando…');
  });

  it('AC-09: sin datos dice «No hay datos que mostrar.»', () => {
    const { el } = crear({ get: of(null as unknown as CustomerDetail) });
    expect(el.textContent).toContain('No hay datos que mostrar.');
  });

  it('AC-10: si la carga falla dice «No se pudo cargar. Vuelve a intentarlo.» y reintenta', () => {
    const { el, get, fixture, boton } = crear({ get: throwError(() => new CustomerInfrastructureError()) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    get.execute.mockReturnValue(of(cliente));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(get.execute).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Ana Pérez');
  });

  it('AC-11: 400 dice «Revisa los datos marcados.»', () => {
    const { el } = crear({ get: throwError(() => new InvalidCustomerInputError()) });
    expect(el.textContent).toContain('Revisa los datos marcados.');
  });

  it('AC-12: 401 dice «Tu sesión terminó: vuelve a entrar.» con enlace a entrar', () => {
    const { el } = crear({ get: throwError(() => new CustomerSessionExpiredError()) });
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
    expect(el.querySelector('a[href*="returnUrl"]')).toBeTruthy();
  });

  it('AC-13: 404 dice «No se encontró lo que buscas.» y no enseña nada vacío', () => {
    const { el } = crear({ get: throwError(() => new CustomerNotFoundError()) });
    expect(el.textContent).toContain('No se encontró lo que buscas.');
    expect(el.querySelector('dl')).toBeNull();
  });
});

describe('CustomerDetailComponent · acciones', () => {
  it('[ctl_zogkx7tx / dlg_eohjwtlv:abre] «Eliminar cliente» abre el diálogo con su texto', () => {
    const { el, abrirDialogo } = crear();
    expect(el.querySelector('[role=dialog]')).toBeNull();
    abrirDialogo();
    const dialogo = el.querySelector('[role=dialog]')!;
    expect(dialogo.textContent).toContain('Confirmar eliminación de cliente');
    expect(dialogo.textContent).toContain('Esta acción no se puede deshacer. ¿Deseas eliminar el cliente?');
  });

  it('[ctl_yr6h2adm] «Cancelar» solo cierra el diálogo, sin llamar a ninguna API', () => {
    const { el, fixture, del, abrirDialogo, boton } = crear();
    abrirDialogo();
    boton('Cancelar').click();
    fixture.detectChanges();
    expect(el.querySelector('[role=dialog]')).toBeNull();
    expect(del.execute).not.toHaveBeenCalled();
  });

  it('[nav_rtn95ez2] «Editar cliente» va a /clientes/:id/editar', () => {
    const { boton } = crear();
    expect(boton('Editar cliente').getAttribute('href')).toBe('/clientes/abc-123/editar');
  });

  it('AC-26 · [act_dri5d0h5:llama/tras · nav_y1v7etao] elimina, cierra, va a /clientes y avisa', () => {
    const { el, fixture, del, abrirDialogo, confirmar } = crear();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    abrirDialogo();
    confirmar();
    expect(del.execute).toHaveBeenCalledTimes(1);
    expect(del.execute).toHaveBeenCalledWith('abc-123');
    expect(el.querySelector('[role=dialog]')).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/clientes']);
    expect(TestBed.inject(NoticeService).message()).toBe('Cliente eliminado.');
    fixture.detectChanges();
  });

  it('[act_dri5d0h5:ocupado] mientras espera se bloquea y un doble clic hace una sola llamada', () => {
    const respuesta = new Subject<void>();
    const { el, fixture, del, abrirDialogo, confirmar } = crear({ del: respuesta });
    abrirDialogo();
    confirmar();
    const principal = el.querySelectorAll('.dialogo__pie button')[1] as HTMLButtonElement;
    expect(principal.disabled).toBe(true);
    expect(principal.textContent).toContain('Eliminando…');
    principal.click();
    fixture.detectChanges();
    expect(del.execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['AC-27', new InvalidCustomerInputError(), 'Revisa los datos marcados.'],
    ['AC-28', new CustomerSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
    ['AC-29', new CustomerNotFoundError(), 'No se encontró lo que buscas.'],
    ['AC-30', new CustomerInUseError(), 'Otro dato lo cita.'],
    ['falla:any', new CustomerInfrastructureError(), 'No se pudo cargar. Vuelve a intentarlo.'],
  ])('%s: al eliminar avisa el mensaje de la spec y deja reintentar', (_id, error, aviso) => {
    const { el, fixture, del, abrirDialogo, confirmar } = crear({ del: throwError(() => error) });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    abrirDialogo();
    confirmar();
    expect(el.querySelector('[role=dialog] [role=alert]')?.textContent).toContain(aviso);
    expect(navegar).not.toHaveBeenCalled();
    const principal = el.querySelectorAll('.dialogo__pie button')[1] as HTMLButtonElement;
    expect(principal.disabled).toBe(false);
    del.execute.mockReturnValue(of(undefined));
    principal.click();
    fixture.detectChanges();
    expect(del.execute).toHaveBeenCalledTimes(2);
    expect(navegar).toHaveBeenCalledWith(['/clientes']);
  });

  it('con 401 al eliminar ofrece entrar de nuevo', () => {
    const { el, abrirDialogo, confirmar } = crear({ del: throwError(() => new CustomerSessionExpiredError()) });
    abrirDialogo();
    confirmar();
    expect(el.querySelector('[role=dialog] a[href*="returnUrl"]')).toBeTruthy();
  });
});
