import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { createSpyObj } from '../../../../../testing/spy-obj';
import { NoticeService } from '../../../../@core/services/notice.service';
import { CreateOrderUseCase, ListCustomerOptionsUseCase } from '../../application/order.use-cases';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderBusinessRuleError,
  OrderInfrastructureError,
  OrderSessionExpiredError,
} from '../../domain/errors/order.errors';
import { CreatedOrder, CustomerOption } from '../../domain/models/order.model';
import { OrderCreateComponent } from './order-create.component';

const clientes: CustomerOption[] = [
  { id: 'c1', name: 'Ana Pérez' },
  { id: 'c2', name: 'Luis Gómez' },
];
const creado: CreatedOrder = { id: 'o1', customerId: 'c1', date: '2026-11-01', amount: 25.5, status: 'pending' };

function token(claims: object): string {
  return `x.${btoa(JSON.stringify(claims))}.y`;
}

interface Opciones {
  clientes?: Observable<CustomerOption[]>;
  crear?: Observable<CreatedOrder>;
}

function crear(opciones: Opciones = {}) {
  const customers = createSpyObj<ListCustomerOptionsUseCase>(['execute']);
  const create = createSpyObj<CreateOrderUseCase>(['execute']);
  customers.execute.mockReturnValue(opciones.clientes ?? of(clientes));
  create.execute.mockReturnValue(opciones.crear ?? of(creado));
  TestBed.configureTestingModule({
    imports: [OrderCreateComponent],
    providers: [
      provideRouter([]),
      { provide: ListCustomerOptionsUseCase, useValue: customers },
      { provide: CreateOrderUseCase, useValue: create },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(OrderCreateComponent);
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
    escribir('customerId', 'c1');
    escribir('date', '2026-11-01');
    escribir('amount', '25.5');
  };
  const enviar = () => {
    boton('Crear pedido').click();
    fixture.detectChanges();
  };
  return { fixture, el, navegar, customers, create, campo, escribir, boton, rellenar, enviar };
}

afterEach(() => sessionStorage.clear());

describe('OrderCreateComponent · carga', () => {
  it('AC-09: pide los clientes una vez al entrar y ofrece Cliente, Fecha e Importe', () => {
    const { el, customers, campo } = crear();
    expect(customers.execute).toHaveBeenCalledTimes(1);
    for (const etiqueta of ['Cliente', 'Fecha', 'Importe', 'Datos del pedido']) {
      expect(el.textContent).toContain(etiqueta);
    }
    expect(el.querySelectorAll('#customerId option').length).toBe(3);
    expect(campo<HTMLInputElement>('date').type).toBe('date');
  });

  it('AC-10: mientras espera los datos muestra «Cargando…»', () => {
    const { el } = crear({ clientes: NEVER });
    expect(el.textContent).toContain('Cargando…');
  });

  it('AC-10: al llegar los datos ya no muestra «Cargando…»', () => {
    const { el } = crear();
    expect(el.textContent).not.toContain('Cargando…');
  });

  it('AC-11: si falla la carga, avisa, ofrece reintentar y bloquea «Crear pedido»', () => {
    const { el, customers, boton, fixture } = crear({ clientes: throwError(() => new OrderInfrastructureError()) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    expect((boton('Crear pedido') as HTMLButtonElement).disabled).toBe(true);
    customers.execute.mockReturnValue(of(clientes));
    boton('Reintentar').click();
    fixture.detectChanges();
    expect(customers.execute).toHaveBeenCalledTimes(2);
    expect(el.textContent).not.toContain('No se pudo cargar');
    expect((boton('Crear pedido') as HTMLButtonElement).disabled).toBe(false);
  });

  it('AC-12: sin «pedidos.gestionar» en la sesión dice «No tienes permiso para ver esto.» y no llama a la API', () => {
    sessionStorage.setItem('token', token({ permissions: ['pedidos.consultar'] }));
    const { el, customers } = crear();
    expect(el.textContent).toContain('No tienes permiso para ver esto.');
    expect(el.querySelector('form')).toBeNull();
    expect(customers.execute).not.toHaveBeenCalled();
  });

  it('AC-12: con «pedidos.gestionar» en la sesión muestra el formulario', () => {
    sessionStorage.setItem('token', token({ permissions: ['pedidos.gestionar'] }));
    const { el } = crear();
    expect(el.textContent).not.toContain('No tienes permiso para ver esto.');
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('AC-12: si la carga responde 403 también dice «No tienes permiso para ver esto.»', () => {
    const { el } = crear({ clientes: throwError(() => new ForbiddenOrderError()) });
    expect(el.textContent).toContain('No tienes permiso para ver esto.');
  });

  it('AC-13: la carga con 400 dice «Revisa los datos marcados.»', () => {
    const { el } = crear({ clientes: throwError(() => new InvalidOrderInputError()) });
    expect(el.textContent).toContain('Revisa los datos marcados.');
  });

  it('AC-14: la carga con 401 dice «Tu sesión terminó: vuelve a entrar.» con enlace a entrar', () => {
    const { el, boton } = crear({ clientes: throwError(() => new OrderSessionExpiredError()) });
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
    expect(boton('Entrar')).toBeTruthy();
  });
});

describe('OrderCreateComponent · validación y accesibilidad', () => {
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
    const { el, enviar, escribir } = crear();
    enviar();
    expect(el.textContent).toContain('Cliente es obligatorio.');
    escribir('customerId', 'c1');
    expect(el.textContent).not.toContain('Cliente es obligatorio.');
  });
});

describe('OrderCreateComponent · Crear pedido', () => {
  it('AC-09/AC-25: envía customerId, date y amount (número), va a /pedidos/:id y avisa «Pedido creado.»', () => {
    const { create, navegar, rellenar, enviar, fixture } = crear();
    rellenar();
    enviar();
    expect(create.execute).toHaveBeenCalledTimes(1);
    const [cuerpo, clave] = create.execute.mock.calls[0];
    expect(cuerpo).toEqual({ customerId: 'c1', date: '2026-11-01', amount: 25.5 });
    expect(clave).toMatch(/^[0-9a-f-]{36}$/);
    expect(navegar).toHaveBeenCalledWith(['/pedidos', 'o1']);
    expect(TestBed.inject(NoticeService).message()).toBe('Pedido creado.');
    fixture.detectChanges();
  });

  it('solo llama a POST (no vuelve a cargar clientes)', () => {
    const { customers, rellenar, enviar } = crear();
    rellenar();
    const antes = customers.execute.mock.calls.length;
    enviar();
    expect(customers.execute.mock.calls.length).toBe(antes);
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
    ['AC-26: 400', new InvalidOrderInputError(), 'Revisa los datos marcados.'],
    ['AC-27: 401', new OrderSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
    ['AC-28: 403', new ForbiddenOrderError(), 'No tienes permiso para hacer esto.'],
    ['AC-29: 422', new OrderBusinessRuleError(), 'No se pudo por una regla del negocio.'],
    ['fallo genérico', new OrderInfrastructureError(), 'No se pudo cargar. Vuelve a intentarlo.'],
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
    const { boton, rellenar, enviar } = crear({ crear: throwError(() => new OrderSessionExpiredError()) });
    rellenar();
    enviar();
    expect(boton('Entrar')).toBeTruthy();
  });

  it('reintentar tras un fallo usa la misma Idempotency-Key; si cambia lo escrito, una nueva; tras el éxito, otra', () => {
    const { create, rellenar, enviar, boton, escribir, fixture } = crear();
    create.execute.mockReturnValue(throwError(() => new OrderInfrastructureError()));
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
    create.execute.mockReturnValue(of(creado));
    enviar();
    const k4 = create.execute.mock.calls[3][1];
    expect(k4).toBe(k3);
    enviar();
    expect(create.execute.mock.calls[4][1]).not.toBe(k4);
  });

  it('Cancelar enlaza a /pedidos', () => {
    const { boton } = crear();
    expect(boton('Cancelar').getAttribute('href')).toBe('/pedidos');
  });
});
