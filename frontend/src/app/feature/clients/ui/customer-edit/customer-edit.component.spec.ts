import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { createSpyObj } from '../../../../../testing/spy-obj';
import { NoticeService } from '../../../../@core/services/notice.service';
import {
  GetCustomerForEditUseCase,
  ListProvincesUseCase,
  ListTownsUseCase,
  UpdateCustomerUseCase,
} from '../../application/customer.use-cases';
import {
  CustomerChangedError,
  CustomerInfrastructureError,
  CustomerNotFoundError,
  CustomerPreconditionRequiredError,
  CustomerSessionExpiredError,
  DuplicateCustomerEmailError,
  InvalidCustomerInputError,
} from '../../domain/errors/customer.errors';
import { Province, Town, VersionedCustomer } from '../../domain/models/customer.model';
import { CustomerEditComponent } from './customer-edit.component';

const provincias: Province[] = [
  { id: 'p1', code: 'M', name: 'Madrid' },
  { id: 'p2', code: 'B', name: 'Barcelona' },
];
const poblaciones: Town[] = [
  { id: 't1', provinceId: 'p1', name: 'Getafe' },
  { id: 't2', provinceId: 'p1', name: 'Leganés' },
];
const cliente: VersionedCustomer = {
  etag: '"3"',
  customer: {
    id: 'u1',
    name: 'Ana Pérez',
    email: 'ana@mail.test',
    streetAddress: 'Calle Mayor 1',
    provinceId: 'p1',
    provinceName: 'Madrid',
    townId: 't1',
    townName: 'Getafe',
    status: 'active',
    version: 3,
  },
};

interface Opciones {
  provincias?: Observable<Province[]>;
  poblaciones?: Observable<Town[]>;
  cliente?: Observable<VersionedCustomer>;
  guardar?: Observable<VersionedCustomer>;
}

function crear(opciones: Opciones = {}) {
  const provinces = createSpyObj<ListProvincesUseCase>(['execute']);
  const towns = createSpyObj<ListTownsUseCase>(['execute']);
  const get = createSpyObj<GetCustomerForEditUseCase>(['execute']);
  const update = createSpyObj<UpdateCustomerUseCase>(['execute']);
  provinces.execute.mockReturnValue(opciones.provincias ?? of(provincias));
  towns.execute.mockReturnValue(opciones.poblaciones ?? of(poblaciones));
  get.execute.mockReturnValue(opciones.cliente ?? of(cliente));
  update.execute.mockReturnValue(opciones.guardar ?? of({ ...cliente, etag: '"4"' }));
  TestBed.configureTestingModule({
    imports: [CustomerEditComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'u1' }) } } },
      { provide: ListProvincesUseCase, useValue: provinces },
      { provide: ListTownsUseCase, useValue: towns },
      { provide: GetCustomerForEditUseCase, useValue: get },
      { provide: UpdateCustomerUseCase, useValue: update },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(CustomerEditComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const campo = <T extends HTMLElement>(id: string) => el.querySelector<T>(`#${id}`) as T;
  const escribir = (id: string, valor: string) => {
    const c = campo<HTMLInputElement | HTMLSelectElement>(id);
    c.value = valor;
    c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  };
  const boton = (texto: string) =>
    Array.from(el.querySelectorAll('button, a')).find((b) => b.textContent?.includes(texto)) as HTMLElement;
  const guardar = () => {
    boton('Guardar cambios').click();
    fixture.detectChanges();
  };
  const cambiarNombre = () => escribir('name', 'Ana Gómez');
  return { fixture, el, navegar, provinces, towns, get, update, campo, escribir, boton, guardar, cambiarNombre };
}

describe('CustomerEditComponent · carga', () => {
  it('AC-19: al abrir pide provincias y registro, rellena los campos y «ID» empieza con el :id', () => {
    const { campo, provinces, get, towns } = crear();
    expect(provinces.execute).toHaveBeenCalledTimes(1);
    expect(get.execute).toHaveBeenCalledWith('u1');
    expect(campo<HTMLInputElement>('id').value).toBe('u1');
    expect(campo<HTMLInputElement>('id').readOnly).toBe(true);
    expect(campo<HTMLInputElement>('name').value).toBe('Ana Pérez');
    expect(campo<HTMLInputElement>('email').value).toBe('ana@mail.test');
    expect(campo<HTMLInputElement>('streetAddress').value).toBe('Calle Mayor 1');
    expect(campo<HTMLSelectElement>('provinceId').value).toBe('p1');
    expect(campo<HTMLSelectElement>('status').value).toBe('active');
    // R4-ARQ-3: Población llega activa, con sus opciones y sin vaciarse.
    expect(towns.execute).toHaveBeenCalledWith('p1');
    expect(campo<HTMLSelectElement>('townId').disabled).toBe(false);
    expect(campo<HTMLSelectElement>('townId').value).toBe('t1');
  });

  it('AC-20: mientras espera los datos muestra «Cargando…», no enseña el formulario y no deja guardar', () => {
    const { el } = crear({ cliente: NEVER });
    expect(el.textContent).toContain('Cargando…');
    expect(el.querySelector('form')).toBeNull();
  });

  it('AC-20: al llegar los datos ya no muestra «Cargando…»', () => {
    const { el } = crear();
    expect(el.textContent).not.toContain('Cargando…');
  });

  it('AC-21: si falla la carga, avisa, ofrece reintentar y no enseña el formulario vacío', () => {
    const { el, get, boton, fixture } = crear({ cliente: throwError(() => new CustomerInfrastructureError()) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    expect(el.querySelector('form')).toBeNull();
    get.execute.mockReturnValue(of(cliente));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(get.execute).toHaveBeenCalledTimes(2);
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('AC-22: la carga con 400 dice «Revisa los datos marcados.»', () => {
    const { el } = crear({ cliente: throwError(() => new InvalidCustomerInputError()) });
    expect(el.textContent).toContain('Revisa los datos marcados.');
  });

  it('AC-23: la carga con 401 dice «Tu sesión terminó: vuelve a entrar.» con enlace a entrar', () => {
    const { el, boton } = crear({ cliente: throwError(() => new CustomerSessionExpiredError()) });
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
    expect(boton('Entrar')).toBeTruthy();
  });

  it('AC-24: la carga con 404 dice «No se encontró lo que buscas.» y no enseña el formulario', () => {
    const { el } = crear({ cliente: throwError(() => new CustomerNotFoundError()) });
    expect(el.textContent).toContain('No se encontró lo que buscas.');
    expect(el.querySelector('form')).toBeNull();
  });

  it('si falla «Provincia», ofrece reintentar y bloquea «Guardar cambios»', () => {
    const { el, provinces, boton, fixture, cambiarNombre } = crear({
      provincias: throwError(() => new CustomerInfrastructureError()),
    });
    cambiarNombre();
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    expect((boton('Guardar cambios') as HTMLButtonElement).disabled).toBe(true);
    provinces.execute.mockReturnValue(of(provincias));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(provinces.execute).toHaveBeenCalledTimes(2);
    expect((boton('Guardar cambios') as HTMLButtonElement).disabled).toBe(false);
  });

  it('si falla «Población», ofrece reintentar y bloquea «Guardar cambios»', () => {
    const { el, towns, boton, fixture, cambiarNombre } = crear({
      poblaciones: throwError(() => new CustomerInfrastructureError()),
    });
    cambiarNombre();
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    expect((boton('Guardar cambios') as HTMLButtonElement).disabled).toBe(true);
    towns.execute.mockReturnValue(of(poblaciones));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(towns.execute).toHaveBeenCalledTimes(2);
    expect((boton('Guardar cambios') as HTMLButtonElement).disabled).toBe(false);
  });

  it('el 401 al cargar provincias o poblaciones ofrece entrar', () => {
    const { boton } = crear({ provincias: throwError(() => new CustomerSessionExpiredError()) });
    expect(boton('Entrar')).toBeTruthy();
  });
});

describe('CustomerEditComponent · Provincia y Población', () => {
  it('al cambiar Provincia vacía Población y pide sus opciones con provinceId', () => {
    const { campo, towns, escribir } = crear();
    escribir('provinceId', 'p2');
    expect(towns.execute).toHaveBeenLastCalledWith('p2');
    expect(campo<HTMLSelectElement>('townId').value).toBe('');
    expect(campo<HTMLSelectElement>('townId').disabled).toBe(false);
  });

  it('al dejar Provincia vacía, Población vuelve a desactivarse', () => {
    const { campo, escribir } = crear();
    escribir('provinceId', '');
    expect(campo<HTMLSelectElement>('townId').disabled).toBe(true);
  });

  it('un registro sin provincia deja Población desactivada', () => {
    const sin = { ...cliente, customer: { ...cliente.customer, provinceId: '', townId: '' } };
    const { campo, towns } = crear({ cliente: of(sin) });
    expect(campo<HTMLSelectElement>('townId').disabled).toBe(true);
    expect(towns.execute).not.toHaveBeenCalled();
  });
});

describe('CustomerEditComponent · validación', () => {
  it.each([
    ['name', 'Nombre es obligatorio.'],
    ['email', 'Email es obligatorio.'],
    ['streetAddress', 'Dirección es obligatoria.'],
    ['provinceId', 'Provincia es obligatoria.'],
    ['status', 'Estado es obligatorio.'],
  ])('sin %s no se envía y aparece su mensaje', (id, mensaje) => {
    const { el, update, escribir, guardar, campo, fixture } = crear();
    escribir(id, '');
    // Provincia vacía vacía también Población: se rellena para aislar el campo.
    if (id === 'provinceId') expect(campo<HTMLSelectElement>('townId').value).toBe('');
    guardar();
    fixture.detectChanges();
    expect(update.execute).not.toHaveBeenCalled();
    expect(el.textContent).toContain(mensaje);
    expect(campo(id).getAttribute('aria-invalid')).toBe('true');
    expect(campo(id).getAttribute('aria-required')).toBe('true');
  });

  it('sin Población no se envía y aparece «Población es obligatoria.»', () => {
    const { el, update, escribir, guardar } = crear();
    escribir('provinceId', 'p2');
    guardar();
    expect(update.execute).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Población es obligatoria.');
  });

  it('accesibilidad: el mensaje se enlaza con aria-describedby y el foco va al primer campo con error', async () => {
    const { el, escribir, guardar, campo } = crear();
    escribir('name', '');
    escribir('email', '');
    const foco = vi.spyOn(campo<HTMLInputElement>('name'), 'focus');
    guardar();
    await Promise.resolve();
    expect(campo('name').getAttribute('aria-describedby')).toBe('name-error');
    expect(el.querySelector('#name-error')?.textContent).toContain('Nombre es obligatorio.');
    expect(campo('email').getAttribute('aria-describedby')).toBe('email-error');
    expect(foco).toHaveBeenCalled();
  });
});

describe('CustomerEditComponent · Guardar cambios', () => {
  it('solo se pulsa si algo cambió', () => {
    const { boton, cambiarNombre, update, guardar } = crear();
    expect((boton('Guardar cambios') as HTMLButtonElement).disabled).toBe(true);
    guardar();
    expect(update.execute).not.toHaveBeenCalled();
    cambiarNombre();
    expect((boton('Guardar cambios') as HTMLButtonElement).disabled).toBe(false);
  });

  it('llama a PUT con el cuerpo del formulario, sin «ID», y con el ETag cargado', () => {
    const { update, cambiarNombre, guardar } = crear();
    cambiarNombre();
    guardar();
    expect(update.execute).toHaveBeenCalledTimes(1);
    expect(update.execute).toHaveBeenCalledWith(
      'u1',
      {
        name: 'Ana Gómez',
        email: 'ana@mail.test',
        provinceId: 'p1',
        townId: 't1',
        status: 'active',
        streetAddress: 'Calle Mayor 1',
      },
      '"3"',
    );
  });

  it('mientras espera la respuesta dice que está enviando y un doble clic hace una sola llamada', () => {
    const { update, cambiarNombre, guardar, boton, fixture } = crear({ guardar: NEVER });
    cambiarNombre();
    const enviar = boton('Guardar cambios');
    guardar();
    enviar.click();
    fixture.detectChanges();
    expect(update.execute).toHaveBeenCalledTimes(1);
    expect(boton('Enviando…')).toBeTruthy();
    expect((boton('Enviando…') as HTMLButtonElement).disabled).toBe(true);
  });

  it('AC-36: con éxito va a /clientes/:id y avisa «Se guardó correctamente.»', () => {
    const { navegar, cambiarNombre, guardar } = crear();
    cambiarNombre();
    guardar();
    expect(TestBed.inject(NoticeService).message()).toBe('Se guardó correctamente.');
    expect(navegar).toHaveBeenCalledWith(['/clientes', 'u1']);
  });

  it.each([
    ['AC-37', new InvalidCustomerInputError(), 'Revisa los datos marcados.'],
    ['AC-38', new CustomerSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
    ['AC-39', new CustomerNotFoundError(), 'No se encontró lo que buscas.'],
    ['AC-40', new DuplicateCustomerEmailError(), 'Ya existe otro con el mismo «Email».'],
    ['AC-42', new CustomerPreconditionRequiredError(), 'Algo falló. Vuelve a intentarlo.'],
    ['otro fallo', new CustomerInfrastructureError(), 'No se pudo cargar. Vuelve a intentarlo.'],
  ])('%s: al fallar avisa «%#», conserva lo escrito y no navega', (_ac, error, texto) => {
    const { el, campo, navegar, cambiarNombre, guardar } = crear({ guardar: throwError(() => error) });
    cambiarNombre();
    guardar();
    expect(el.textContent).toContain(texto);
    expect(campo<HTMLInputElement>('name').value).toBe('Ana Gómez');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('si falla ofrece reintentar y repite el envío', () => {
    const { update, cambiarNombre, guardar, boton, fixture } = crear({
      guardar: throwError(() => new CustomerInfrastructureError()),
    });
    cambiarNombre();
    guardar();
    update.execute.mockReturnValue(of({ ...cliente, etag: '"4"' }));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(update.execute).toHaveBeenCalledTimes(2);
  });

  it('el 401 al guardar ofrece entrar en lugar de reintentar', () => {
    const { boton, cambiarNombre, guardar } = crear({ guardar: throwError(() => new CustomerSessionExpiredError()) });
    cambiarNombre();
    guardar();
    expect(boton('Entrar')).toBeTruthy();
  });

  it('AC-41: con 412 vuelve a cargar el elemento, avisa y usa el ETag nuevo', () => {
    const { el, get, update, campo, cambiarNombre, guardar, escribir } = crear({
      guardar: throwError(() => new CustomerChangedError()),
    });
    const nuevo: VersionedCustomer = {
      etag: '"7"',
      customer: { ...cliente.customer, name: 'Nombre del servidor', version: 7 },
    };
    get.execute.mockReturnValue(of(nuevo));
    cambiarNombre();
    guardar();
    expect(get.execute).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain(
      'Otra persona cambió este cliente mientras lo editabas: se ha cargado lo de ahora; revísalo y vuelve a guardar.',
    );
    expect(campo<HTMLInputElement>('name').value).toBe('Nombre del servidor');
    update.execute.mockReturnValue(of(nuevo));
    escribir('name', 'Otro');
    guardar();
    expect(update.execute).toHaveBeenLastCalledWith('u1', expect.objectContaining({ name: 'Otro' }), '"7"');
  });
});

describe('CustomerEditComponent · salir y Cancelar', () => {
  it('«Cancelar» lleva a /clientes/:id', () => {
    const { boton } = crear();
    expect(boton('Cancelar').getAttribute('href')).toBe('/clientes/u1');
  });

  it('sin cambios se puede salir sin preguntar', () => {
    const { fixture } = crear();
    const confirmar = vi.spyOn(window, 'confirm');
    expect(fixture.componentInstance.canLeave()).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('con cambios sin guardar pregunta si descartarlos', () => {
    const { fixture, cambiarNombre } = crear();
    cambiarNombre();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(fixture.componentInstance.canLeave()).toBe(false);
    expect(fixture.componentInstance.canLeave()).toBe(true);
    expect(confirmar).toHaveBeenCalledTimes(2);
  });
});
