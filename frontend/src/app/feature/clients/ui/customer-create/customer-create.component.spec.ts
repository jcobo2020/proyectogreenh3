import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { NoticeService } from '../../../../@core/services/notice.service';
import { createSpyObj } from '../../../../../testing/spy-obj';
import {
  CreateCustomerUseCase,
  ListProvincesUseCase,
  ListTownsUseCase,
} from '../../application/customer.use-cases';
import {
  CustomerBusinessRuleError,
  CustomerInfrastructureError,
  CustomerSessionExpiredError,
  DuplicateCustomerEmailError,
  InvalidCustomerInputError,
} from '../../domain/errors/customer.errors';
import { CustomerDetail, Province, Town } from '../../domain/models/customer.model';
import { CustomerCreateComponent } from './customer-create.component';

const provincias: Province[] = [
  { id: 'p1', code: 'M', name: 'Madrid' },
  { id: 'p2', code: 'B', name: 'Barcelona' },
];
const poblaciones: Town[] = [{ id: 't1', provinceId: 'p1', name: 'Getafe' }];
const creado = { id: 'u1' } as unknown as CustomerDetail;

interface Opciones {
  provincias?: Observable<Province[]>;
  poblaciones?: Observable<Town[]>;
  crear?: Observable<CustomerDetail>;
}

function crear(opciones: Opciones = {}) {
  const provinces = createSpyObj<ListProvincesUseCase>(['execute']);
  const towns = createSpyObj<ListTownsUseCase>(['execute']);
  const create = createSpyObj<CreateCustomerUseCase>(['execute']);
  provinces.execute.mockReturnValue(opciones.provincias ?? of(provincias));
  towns.execute.mockReturnValue(opciones.poblaciones ?? of(poblaciones));
  create.execute.mockReturnValue(opciones.crear ?? of(creado));
  TestBed.configureTestingModule({
    imports: [CustomerCreateComponent],
    providers: [
      provideRouter([]),
      { provide: ListProvincesUseCase, useValue: provinces },
      { provide: ListTownsUseCase, useValue: towns },
      { provide: CreateCustomerUseCase, useValue: create },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(CustomerCreateComponent);
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
  const rellenar = () => {
    escribir('name', 'Ana Pérez');
    escribir('email', 'ana@mail.test');
    escribir('streetAddress', 'Calle Mayor 1');
    escribir('provinceId', 'p1');
    escribir('townId', 't1');
    escribir('status', 'active');
  };
  const enviar = () => {
    boton('Crear cliente').click();
    fixture.detectChanges();
  };
  return { fixture, el, navegar, provinces, towns, create, campo, escribir, boton, rellenar, enviar };
}

describe('CustomerCreateComponent · carga', () => {
  it('AC-14: pide las provincias una vez al entrar y ofrece los seis campos', () => {
    const { el, provinces, campo } = crear();
    expect(provinces.execute).toHaveBeenCalledTimes(1);
    const texto = el.textContent ?? '';
    for (const etiqueta of ['Nombre', 'Email', 'Dirección', 'Provincia', 'Población', 'Estado']) {
      expect(texto).toContain(etiqueta);
    }
    expect(el.querySelectorAll('#provinceId option').length).toBe(3);
    expect(campo<HTMLSelectElement>('townId').disabled).toBe(true);
  });

  it('AC-15: mientras espera los datos muestra «Cargando…»', () => {
    const { el } = crear({ provincias: NEVER });
    expect(el.textContent).toContain('Cargando…');
  });

  it('AC-15: al llegar los datos ya no muestra «Cargando…»', () => {
    const { el } = crear();
    expect(el.textContent).not.toContain('Cargando…');
  });

  it('AC-16: si falla la carga, avisa, ofrece reintentar y bloquea «Crear cliente»', () => {
    const { el, provinces, boton, fixture } = crear({ provincias: throwError(() => new CustomerInfrastructureError()) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    expect((boton('Crear cliente') as HTMLButtonElement).disabled).toBe(true);
    provinces.execute.mockReturnValue(of(provincias));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(provinces.execute).toHaveBeenCalledTimes(2);
    expect(el.textContent).not.toContain('No se pudo cargar');
    expect((boton('Crear cliente') as HTMLButtonElement).disabled).toBe(false);
  });

  it('AC-17: la carga con 400 dice «Revisa los datos marcados.»', () => {
    const { el } = crear({ provincias: throwError(() => new InvalidCustomerInputError()) });
    expect(el.textContent).toContain('Revisa los datos marcados.');
  });

  it('AC-18: la carga con 401 dice «Tu sesión terminó: vuelve a entrar.» con enlace a entrar', () => {
    const { el, boton } = crear({ provincias: throwError(() => new CustomerSessionExpiredError()) });
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
    expect(boton('Entrar')).toBeTruthy();
  });
});

describe('CustomerCreateComponent · Provincia y Población', () => {
  it('al elegir Provincia activa Población, la vacía y pide sus opciones con provinceId', () => {
    const { campo, towns, escribir, el } = crear();
    escribir('provinceId', 'p1');
    expect(towns.execute).toHaveBeenCalledWith('p1');
    expect(campo<HTMLSelectElement>('townId').disabled).toBe(false);
    expect(el.querySelectorAll('#townId option').length).toBe(2);
    escribir('townId', 't1');
    expect(campo<HTMLSelectElement>('townId').value).toBe('t1');
    escribir('provinceId', 'p2');
    expect(campo<HTMLSelectElement>('townId').value).toBe('');
    expect(towns.execute).toHaveBeenCalledTimes(2);
  });

  it('al dejar Provincia vacía, Población vuelve a desactivarse', () => {
    const { campo, escribir, towns } = crear();
    escribir('provinceId', 'p1');
    escribir('provinceId', '');
    expect(campo<HTMLSelectElement>('townId').disabled).toBe(true);
    expect(towns.execute).toHaveBeenCalledTimes(1);
  });

  it('si falla cargar Población, ofrece reintentar y bloquea «Crear cliente» mientras falle', () => {
    const { el, towns, escribir, boton, fixture } = crear({
      poblaciones: throwError(() => new CustomerInfrastructureError()),
    });
    escribir('provinceId', 'p1');
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    expect((boton('Crear cliente') as HTMLButtonElement).disabled).toBe(true);
    towns.execute.mockReturnValue(of(poblaciones));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(towns.execute).toHaveBeenCalledTimes(2);
    expect((boton('Crear cliente') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Población con 400 y con 401 muestran el aviso de la pantalla', () => {
    const a = crear({ poblaciones: throwError(() => new InvalidCustomerInputError()) });
    a.escribir('provinceId', 'p1');
    expect(a.el.textContent).toContain('Revisa los datos marcados.');
    TestBed.resetTestingModule();
    const b = crear({ poblaciones: throwError(() => new CustomerSessionExpiredError()) });
    b.escribir('provinceId', 'p1');
    expect(b.el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
  });

  it('ignora la respuesta de una provincia anterior', () => {
    const lenta = new Subject<Town[]>();
    const { towns, escribir, el } = crear();
    towns.execute.mockReturnValueOnce(lenta).mockReturnValueOnce(of([{ id: 't9', provinceId: 'p2', name: 'Sitges' }]));
    escribir('provinceId', 'p1');
    escribir('provinceId', 'p2');
    lenta.next(poblaciones);
    expect(el.textContent).toContain('Sitges');
    expect(el.textContent).not.toContain('Getafe');
  });
});

describe('CustomerCreateComponent · obligatorios y accesibilidad', () => {
  it.each([
    ['name', 'Nombre es obligatorio.'],
    ['email', 'Email es obligatorio.'],
    ['streetAddress', 'Dirección es obligatoria.'],
    ['provinceId', 'Provincia es obligatoria.'],
    ['townId', 'Población es obligatoria.'],
    ['status', 'Estado es obligatorio.'],
  ])('sin «%s» no se envía y aparece su mensaje', (id, mensaje) => {
    const { create, el, campo, rellenar, escribir, enviar } = crear();
    rellenar();
    if (id === 'provinceId') escribir('provinceId', '');
    else if (id === 'townId') escribir('townId', '');
    else escribir(id, '');
    enviar();
    expect(create.execute).not.toHaveBeenCalled();
    expect(el.textContent).toContain(mensaje);
    const c = campo(id);
    expect(c.getAttribute('aria-invalid')).toBe('true');
    const descripcion = c.getAttribute('aria-describedby') ?? '';
    expect(descripcion.split(' ').some((d) => el.querySelector(`#${d}`)?.textContent?.includes(mensaje))).toBe(true);
  });

  it('con Provincia vacía, Población (desactivada) también avisa al enviar', () => {
    const { el, enviar } = crear();
    enviar();
    expect(el.textContent).toContain('Población es obligatoria.');
    expect(el.textContent).toContain('Provincia es obligatoria.');
  });

  it('los obligatorios llevan aria-required y el foco va al primer campo con error', async () => {
    const { el, campo, enviar, fixture } = crear();
    for (const id of ['name', 'email', 'streetAddress', 'provinceId', 'townId', 'status']) {
      expect(campo(id).getAttribute('aria-required')).toBe('true');
    }
    document.body.appendChild(el);
    enviar();
    await fixture.whenStable();
    await Promise.resolve();
    expect(document.activeElement).toBe(campo('name'));
    el.remove();
  });

  it('un campo corregido deja de mostrar su error', () => {
    const { el, enviar, escribir } = crear();
    enviar();
    expect(el.textContent).toContain('Nombre es obligatorio.');
    escribir('name', 'Ana');
    expect(el.textContent).not.toContain('Nombre es obligatorio.');
  });
});

describe('CustomerCreateComponent · Crear cliente', () => {
  it('AC-31: envía el cuerpo con ids y código, va a /clientes y avisa «Cliente creado.»', () => {
    const { create, navegar, rellenar, enviar, fixture } = crear();
    rellenar();
    enviar();
    expect(create.execute).toHaveBeenCalledTimes(1);
    const [cuerpo, clave] = create.execute.mock.calls[0];
    expect(cuerpo).toEqual({
      name: 'Ana Pérez',
      email: 'ana@mail.test',
      provinceId: 'p1',
      townId: 't1',
      status: 'active',
      streetAddress: 'Calle Mayor 1',
    });
    expect(clave).toMatch(/^[0-9a-f-]{36}$/);
    expect(navegar).toHaveBeenCalledWith(['/clientes']);
    expect(TestBed.inject(NoticeService).message()).toBe('Cliente creado.');
    fixture.detectChanges();
  });

  it('solo llama a POST (no vuelve a cargar provincias ni poblaciones)', () => {
    const { provinces, towns, rellenar, enviar } = crear();
    rellenar();
    const antes = [provinces.execute.mock.calls.length, towns.execute.mock.calls.length];
    enviar();
    expect([provinces.execute.mock.calls.length, towns.execute.mock.calls.length]).toEqual(antes);
  });

  it('mientras espera la respuesta bloquea el botón, dice «Enviando…» y un doble clic hace una sola llamada', () => {
    const { create, rellenar, enviar, boton, fixture } = crear({ crear: NEVER });
    rellenar();
    enviar();
    (boton('Enviando…') as HTMLButtonElement).click();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(create.execute).toHaveBeenCalledTimes(1);
    const b = boton('Enviando…') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
  });

  it.each([
    ['AC-32: 400', new InvalidCustomerInputError(), 'Revisa los datos marcados.'],
    ['AC-33: 401', new CustomerSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
    ['AC-34: 409', new DuplicateCustomerEmailError(), 'Ya existe otro con el mismo «Email».'],
    ['AC-35: 422', new CustomerBusinessRuleError(), 'No se pudo por una regla del negocio.'],
    ['fallo genérico', new CustomerInfrastructureError(), 'No se pudo cargar. Vuelve a intentarlo.'],
  ])('%s: avisa, conserva lo escrito y no navega', (_n, error, mensaje) => {
    const { el, campo, navegar, rellenar, enviar } = crear({ crear: throwError(() => error) });
    rellenar();
    enviar();
    expect(el.textContent).toContain(mensaje);
    expect(campo<HTMLInputElement>('name').value).toBe('Ana Pérez');
    expect(campo<HTMLInputElement>('email').value).toBe('ana@mail.test');
    expect(campo<HTMLSelectElement>('townId').value).toBe('t1');
    expect(navegar).not.toHaveBeenCalled();
    expect(TestBed.inject(NoticeService).message()).toBeNull();
  });

  it('401 al crear ofrece volver a entrar', () => {
    const { boton, rellenar, enviar } = crear({ crear: throwError(() => new CustomerSessionExpiredError()) });
    rellenar();
    enviar();
    expect(boton('Entrar')).toBeTruthy();
  });

  it('reintentar tras un fallo usa la misma Idempotency-Key; si cambia lo escrito, una nueva; tras el éxito, otra', () => {
    const { create, rellenar, enviar, boton, escribir, fixture } = crear();
    create.execute.mockReturnValue(throwError(() => new CustomerInfrastructureError()));
    rellenar();
    enviar();
    boton('Reintentar').click();
    fixture.detectChanges();
    const [k1, k2] = create.execute.mock.calls.map((c) => c[1]);
    expect(k2).toBe(k1);
    escribir('name', 'Ana María');
    enviar();
    const k3 = create.execute.mock.calls[2][1];
    expect(k3).not.toBe(k1);
    create.execute.mockReturnValue(of(creado));
    enviar();
    const k4 = create.execute.mock.calls[3][1];
    expect(k4).toBe(k3);
    enviar();
    expect(create.execute.mock.calls[4][1]).not.toBe(k4);
  });

  it('Cancelar enlaza a /clientes', () => {
    const { boton } = crear();
    expect(boton('Cancelar').getAttribute('href')).toBe('/clientes');
  });
});
