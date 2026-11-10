import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { createSpyObj } from '../../../../../testing/spy-obj';
import { NoticeService } from '../../../../@core/services/notice.service';
import { CreateInvoiceUseCase, SearchCustomerOptionsUseCase } from '../../application/invoice.use-cases';
import {
  InvalidInvoiceInputError,
  InvoiceBusinessRuleError,
  InvoiceInfrastructureError,
  InvoiceSessionExpiredError,
} from '../../domain/errors/invoice.errors';
import { CreatedInvoice, CustomerOption } from '../../domain/models/invoice.model';
import { InvoiceCreateComponent } from './invoice-create.component';

const clientes: CustomerOption[] = [
  { id: 'c1', name: 'Ana Pérez' },
  { id: 'c2', name: 'Anselmo Gómez' },
];
const creada: CreatedInvoice = {
  id: 'f1',
  customerId: 'c1',
  date: '2026-11-01',
  amount: 25.5,
  number: 'F-2026-000001',
  customerName: 'Ana Pérez',
};

interface Opciones {
  clientes?: Observable<CustomerOption[]>;
  crear?: Observable<CreatedInvoice>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function crear(opciones: Opciones = {}) {
  const search = createSpyObj<SearchCustomerOptionsUseCase>(['execute']);
  const create = createSpyObj<CreateInvoiceUseCase>(['execute']);
  search.execute.mockReturnValue(opciones.clientes ?? of(clientes));
  create.execute.mockReturnValue(opciones.crear ?? of(creada));
  TestBed.configureTestingModule({
    imports: [InvoiceCreateComponent],
    providers: [
      provideRouter([]),
      { provide: SearchCustomerOptionsUseCase, useValue: search },
      { provide: CreateInvoiceUseCase, useValue: create },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(InvoiceCreateComponent);
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
  /** Escribe y deja pasar la espera de 300 ms entre teclas. */
  const buscar = (texto: string) => {
    escribir('customerSearch', texto);
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
  };
  const rellenar = () => {
    buscar('an');
    escribir('customerId', 'c1');
    escribir('date', '2026-11-01');
    escribir('amount', '25.5');
  };
  const enviar = () => {
    boton('Crear factura').click();
    fixture.detectChanges();
  };
  return { fixture, el, navegar, search, create, campo, escribir, boton, buscar, rellenar, enviar };
}

describe('InvoiceCreateComponent · carga de clientes', () => {
  it('AC-07: ofrece Cliente, Fecha e Importe y no pide clientes hasta escribir', () => {
    const { el, search, campo } = crear();
    expect(search.execute).not.toHaveBeenCalled();
    for (const etiqueta of ['Cliente', 'Fecha', 'Importe', 'Datos de la factura', 'Crear factura']) {
      expect(el.textContent).toContain(etiqueta);
    }
    expect(campo<HTMLInputElement>('date').type).toBe('date');
    expect(el.textContent).not.toContain('Número');
  });

  it('con menos de 2 letras no llama a GET /api/customers', () => {
    const { search, buscar } = crear();
    buscar('a');
    expect(search.execute).not.toHaveBeenCalled();
  });

  it('desde 2 letras pide los clientes por lo escrito y enseña lo que llega', () => {
    const { el, search, buscar } = crear();
    buscar('an');
    expect(search.execute).toHaveBeenCalledWith('an');
    expect(el.querySelectorAll('#customerId option').length).toBe(3);
    buscar('ana');
    expect(search.execute).toHaveBeenLastCalledWith('ana');
  });

  it('espera 300 ms entre teclas: solo pide una vez, con lo último escrito', () => {
    const { escribir, search, fixture } = crear();
    escribir('customerSearch', 'an');
    vi.advanceTimersByTime(299);
    expect(search.execute).not.toHaveBeenCalled();
    escribir('customerSearch', 'ana');
    vi.advanceTimersByTime(299);
    expect(search.execute).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(search.execute).toHaveBeenCalledTimes(1);
    expect(search.execute).toHaveBeenCalledWith('ana');
  });

  it('una tecla nueva cancela la petición anterior aún pendiente, sin esperar a la espera', () => {
    const { el, escribir, buscar } = crear({ clientes: NEVER });
    buscar('an');
    expect(el.textContent).toContain('Cargando…');
    escribir('customerSearch', 'ana');
    expect(el.textContent).not.toContain('Cargando…');
  });

  it('al destruir el componente cancela la espera pendiente', () => {
    const { fixture, escribir, search } = crear();
    escribir('customerSearch', 'an');
    fixture.destroy();
    vi.advanceTimersByTime(500);
    expect(search.execute).not.toHaveBeenCalled();
  });

  it('al borrar el texto por debajo de 2 letras vacía las opciones', () => {
    const { el, buscar } = crear();
    buscar('an');
    buscar('a');
    expect(el.querySelectorAll('#customerId option').length).toBe(1);
  });

  it('AC-08: mientras espera los datos muestra «Cargando…»', () => {
    const { el, buscar } = crear({ clientes: NEVER });
    buscar('an');
    expect(el.textContent).toContain('Cargando…');
  });

  it('AC-08: al llegar los datos ya no muestra «Cargando…»', () => {
    const { el, buscar } = crear();
    buscar('an');
    expect(el.textContent).not.toContain('Cargando…');
  });

  it('una búsqueda nueva cancela la anterior que seguía pendiente', () => {
    const { el, buscar, search } = crear({ clientes: NEVER });
    buscar('an');
    search.execute.mockReturnValue(of(clientes));
    buscar('ana');
    expect(el.textContent).not.toContain('Cargando…');
  });

  it('AC-09: si falla, avisa, ofrece reintentar y bloquea «Crear factura»', () => {
    const { el, search, boton, buscar, fixture } = crear({ clientes: throwError(() => new InvoiceInfrastructureError()) });
    buscar('an');
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    expect((boton('Crear factura') as HTMLButtonElement).disabled).toBe(true);
    search.execute.mockReturnValue(of(clientes));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(search.execute).toHaveBeenCalledTimes(2);
    expect(search.execute).toHaveBeenLastCalledWith('an');
    expect(el.textContent).not.toContain('No se pudo cargar');
    expect((boton('Crear factura') as HTMLButtonElement).disabled).toBe(false);
  });

  it('AC-10: la carga con 400 dice «Revisa los datos marcados.»', () => {
    const { el, buscar } = crear({ clientes: throwError(() => new InvalidInvoiceInputError()) });
    buscar('an');
    expect(el.textContent).toContain('Revisa los datos marcados.');
  });

  it('AC-11: la carga con 401 dice «Tu sesión terminó: vuelve a entrar.» con enlace a entrar', () => {
    const { el, boton, buscar } = crear({ clientes: throwError(() => new InvoiceSessionExpiredError()) });
    buscar('an');
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
    expect(boton('Entrar')).toBeTruthy();
  });

  it('el cliente elegido sigue entre las opciones aunque la búsqueda siguiente no lo traiga', () => {
    const { el, search, buscar, escribir, campo } = crear();
    buscar('an');
    escribir('customerId', 'c1');
    search.execute.mockReturnValue(of([{ id: 'c9', name: 'Zoe' }]));
    buscar('zo');
    const textos = Array.from(el.querySelectorAll('#customerId option')).map((o) => o.textContent);
    expect(textos).toEqual(['Selecciona…', 'Ana Pérez', 'Zoe']);
    expect(campo<HTMLSelectElement>('customerId').value).toBe('c1');
  });
});

describe('InvoiceCreateComponent · validación y accesibilidad', () => {
  it.each([
    ['customerId', 'Cliente es obligatorio.'],
    ['date', 'Fecha es obligatoria.'],
    ['amount', 'Importe es obligatorio.'],
  ])('sin «%s» no se envía y aparece su mensaje', (id, mensaje) => {
    const { create, el, campo, rellenar, escribir, enviar } = crear();
    rellenar();
    escribir(id, '');
    enviar();
    expect(create.execute).not.toHaveBeenCalled();
    expect(el.textContent).toContain(mensaje);
    const c = campo(id);
    expect(c.getAttribute('aria-invalid')).toBe('true');
    const descripcion = c.getAttribute('aria-describedby') ?? '';
    expect(descripcion.split(' ').some((d) => el.querySelector(`#${d}`)?.textContent?.includes(mensaje))).toBe(true);
  });

  it('una Fecha futura no se envía y dice «Fecha no puede ser futura.»', () => {
    const { create, el, rellenar, escribir, enviar } = crear();
    rellenar();
    escribir('date', '2999-01-01');
    enviar();
    expect(create.execute).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Fecha no puede ser futura.');
  });

  it('la Fecha de hoy es válida y el input limita su máximo a hoy', () => {
    const { create, campo, rellenar, escribir, enviar } = crear();
    rellenar();
    const hoy = campo<HTMLInputElement>('date').max;
    expect(hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    escribir('date', hoy);
    enviar();
    expect(create.execute).toHaveBeenCalledTimes(1);
  });

  it.each(['0', '0.001', '-5'])('Importe %s no cumple el mínimo 0.01', (valor) => {
    const { create, el, rellenar, escribir, enviar } = crear();
    rellenar();
    escribir('amount', valor);
    enviar();
    expect(create.execute).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Importe tiene que ser mayor que 0.');
  });

  it('Importe 0.01 es válido', () => {
    const { create, rellenar, escribir, enviar } = crear();
    rellenar();
    escribir('amount', '0.01');
    enviar();
    expect(create.execute).toHaveBeenCalledTimes(1);
  });

  it('los obligatorios llevan aria-required y el foco va al primer campo con error', async () => {
    const { el, campo, enviar, fixture } = crear();
    for (const id of ['customerId', 'date', 'amount']) {
      expect(campo(id).getAttribute('aria-required')).toBe('true');
    }
    document.body.appendChild(el);
    enviar();
    await fixture.whenStable();
    await Promise.resolve();
    expect(document.activeElement).toBe(campo('customerId'));
    el.remove();
  });

  it('un campo corregido deja de mostrar su error', () => {
    const { el, buscar, enviar, escribir } = crear();
    buscar('an');
    enviar();
    expect(el.textContent).toContain('Cliente es obligatorio.');
    escribir('customerId', 'c1');
    expect(el.textContent).not.toContain('Cliente es obligatorio.');
  });
});

describe('InvoiceCreateComponent · Crear factura', () => {
  it('AC-13: envía customerId, date y amount (número), va a /facturas y avisa «Factura creada.»', () => {
    const { create, navegar, rellenar, enviar, fixture } = crear();
    rellenar();
    enviar();
    expect(create.execute).toHaveBeenCalledTimes(1);
    const [cuerpo, clave] = create.execute.mock.calls[0];
    expect(cuerpo).toEqual({ customerId: 'c1', date: '2026-11-01', amount: 25.5 });
    expect(clave).toMatch(/^[0-9a-f-]{36}$/);
    expect(navegar).toHaveBeenCalledWith(['/facturas']);
    expect(TestBed.inject(NoticeService).message()).toBe('Factura creada.');
    fixture.detectChanges();
  });

  it('solo llama a POST (no vuelve a buscar clientes)', () => {
    const { search, rellenar, enviar } = crear();
    rellenar();
    const antes = search.execute.mock.calls.length;
    enviar();
    expect(search.execute.mock.calls.length).toBe(antes);
  });

  it('mientras espera bloquea el botón, dice «Enviando…» y un doble clic hace una sola llamada', () => {
    const { create, rellenar, enviar, boton, fixture } = crear({ crear: NEVER });
    rellenar();
    enviar();
    (boton('Enviando…') as HTMLButtonElement).click();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(create.execute).toHaveBeenCalledTimes(1);
    expect((boton('Enviando…') as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    ['AC-14: 400', new InvalidInvoiceInputError(), 'Revisa los datos marcados.'],
    ['AC-15: 401', new InvoiceSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
    ['AC-16: 422', new InvoiceBusinessRuleError(), 'No se pudo por una regla del negocio.'],
    ['fallo genérico', new InvoiceInfrastructureError(), 'No se pudo cargar. Vuelve a intentarlo.'],
  ])('%s: avisa, conserva lo escrito y no navega', (_n, error, mensaje) => {
    const { el, campo, navegar, rellenar, enviar } = crear({ crear: throwError(() => error) });
    rellenar();
    enviar();
    expect(el.textContent).toContain(mensaje);
    expect(campo<HTMLSelectElement>('customerId').value).toBe('c1');
    expect(campo<HTMLInputElement>('date').value).toBe('2026-11-01');
    expect(campo<HTMLInputElement>('amount').value).toBe('25.5');
    expect(navegar).not.toHaveBeenCalled();
    expect(TestBed.inject(NoticeService).message()).toBeNull();
  });

  it('401 al crear ofrece volver a entrar', () => {
    const { boton, rellenar, enviar } = crear({ crear: throwError(() => new InvoiceSessionExpiredError()) });
    rellenar();
    enviar();
    expect(boton('Entrar')).toBeTruthy();
  });

  it('reintentar tras un fallo usa la misma Idempotency-Key; si cambia lo escrito, una nueva; tras el éxito, otra', () => {
    const { create, rellenar, enviar, boton, escribir, fixture } = crear();
    create.execute.mockReturnValue(throwError(() => new InvoiceInfrastructureError()));
    rellenar();
    enviar();
    boton('Reintentar').click();
    fixture.detectChanges();
    const [k1, k2] = create.execute.mock.calls.map((c) => c[1]);
    expect(k2).toBe(k1);
    escribir('amount', '30');
    enviar();
    const k3 = create.execute.mock.calls[2][1];
    expect(k3).not.toBe(k1);
    create.execute.mockReturnValue(of(creada));
    enviar();
    const k4 = create.execute.mock.calls[3][1];
    expect(k4).toBe(k3);
    enviar();
    expect(create.execute.mock.calls[4][1]).not.toBe(k4);
  });

  it('Cancelar enlaza a /facturas', () => {
    const { boton } = crear();
    expect(boton('Cancelar').getAttribute('href')).toBe('/facturas');
  });
});
