import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { createSpyObj } from '../../../testing/spy-obj';
import { NoticeService } from '../../@core/services/notice.service';
import {
  CancelOrderUseCase,
  ConfirmOrderUseCase,
  CreateOrderUseCase,
  DeliverOrderUseCase,
  GetOrderUseCase,
  ListCustomerOptionsUseCase,
  ListOrdersUseCase,
  ShipOrderUseCase,
} from './application/order.use-cases';
import { OrderBusinessRuleError } from './domain/errors/order.errors';
import { OrderDetail } from './domain/models/order.model';
import { CUSTOMER_OPTION_REPOSITORY, CustomerOptionRepositoryPort } from './domain/ports/customer-option-repository.port';
import { ORDER_REPOSITORY, OrderRepositoryPort } from './domain/ports/order-repository.port';
import { ordersRoutes } from './orders.routes';

/**
 * Prueba de punta a punta del recorrido
 * «Lista de pedidos → Nuevo pedido → Detalle del pedido → Enviar pedido → Detalle del pedido».
 * Usa el router real, las rutas hijas reales de la feature, los componentes y los casos de uso reales;
 * solo los puertos de repositorio (el contrato HTTP de /api) son dobles con estado, como el backend:
 * el estado del pedido vive ahí y cada pantalla lo vuelve a pedir.
 */
function preparar(opciones: { falloCrear?: Error } = {}) {
  let pedidos: OrderDetail[] = [
    { id: 'o-0', number: 'P-0001', customerId: 'c1', customerName: 'Ana Pérez', date: '2026-10-01', amount: 10, status: 'delivered' },
  ];
  const repo = createSpyObj<OrderRepositoryPort>(['list', 'create', 'get', 'confirm', 'ship', 'cancel', 'deliver']);
  repo.list.mockImplementation(() => of({ items: pedidos, total: pedidos.length, page: 1, pageSize: 20 }));
  repo.create.mockImplementation((nuevo) => {
    if (opciones.falloCrear) return throwError(() => opciones.falloCrear);
    const id = `o-${pedidos.length}`;
    pedidos = [
      { id, number: `P-000${pedidos.length + 1}`, customerName: 'Ana Pérez', ...nuevo, status: 'pending' },
      ...pedidos,
    ];
    return of({ id, ...nuevo, status: 'pending' });
  });
  repo.get.mockImplementation((id: string) => of({ ...pedidos.find((p) => p.id === id)! }));
  const cambiar = (id: string, estado: string, desde: string[]) => {
    const p = pedidos.find((x) => x.id === id)!;
    if (!desde.includes(p.status)) return throwError(() => new OrderBusinessRuleError());
    pedidos = pedidos.map((x) => (x.id === id ? { ...x, status: estado } : x));
    return of({ id, status: estado });
  };
  repo.confirm.mockImplementation((id: string) => cambiar(id, 'confirmed', ['pending']));
  repo.ship.mockImplementation((id: string) => cambiar(id, 'shipped', ['confirmed']));
  const clientes = createSpyObj<CustomerOptionRepositoryPort>(['list']);
  clientes.list.mockReturnValue(of([{ id: 'c1', name: 'Ana Pérez' }]));

  const rutas: Routes = [
    {
      path: 'pedidos',
      providers: [
        { provide: ORDER_REPOSITORY, useValue: repo },
        { provide: CUSTOMER_OPTION_REPOSITORY, useValue: clientes },
        ListOrdersUseCase,
        CreateOrderUseCase,
        ListCustomerOptionsUseCase,
        GetOrderUseCase,
        ConfirmOrderUseCase,
        ShipOrderUseCase,
        CancelOrderUseCase,
        DeliverOrderUseCase,
      ],
      children: ordersRoutes[0].children!,
    },
  ];
  TestBed.configureTestingModule({ providers: [provideRouter(rutas)] });
  return { repo };
}

const botonConTexto = (el: HTMLElement, texto: string) =>
  Array.from(el.querySelectorAll<HTMLElement>('button, a')).find((b) => b.textContent?.trim().includes(texto))!;

const escribirEn = (el: HTMLElement, id: string, valor: string) => {
  const c = el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#${id}`)!;
  c.value = valor;
  c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input'));
};

describe('Recorrido · Lista de pedidos → Nuevo pedido → Detalle del pedido → Enviar pedido → Detalle del pedido', () => {
  afterEach(() => sessionStorage.clear());

  it('AC-24: lleva a la persona de cada paso al siguiente hasta el detalle del pedido ya enviado', async () => {
    const { repo } = preparar();
    const harness = await RouterTestingHarness.create();
    const location = TestBed.inject(Location);
    const notice = TestBed.inject(NoticeService);
    const estable = async () => {
      await harness.fixture.whenStable();
      harness.detectChanges();
      return harness.routeNativeElement as HTMLElement;
    };
    const escribir = (el: HTMLElement, id: string, valor: string) => {
      escribirEn(el, id, valor);
      harness.detectChanges();
    };

    // 1 · Lista de pedidos
    await harness.navigateByUrl('/pedidos');
    let el = harness.routeNativeElement as HTMLElement;
    expect(location.path()).toBe('/pedidos');
    expect(el.querySelector('h1')?.textContent).toContain('Pedidos');
    expect(el.textContent).toContain('P-0001');

    // 2 · «Nuevo pedido» → Nuevo pedido (/pedidos/nuevo)
    botonConTexto(el, 'Nuevo pedido').click();
    el = await estable();
    expect(location.path()).toBe('/pedidos/nuevo');
    expect(el.querySelector('h1')?.textContent).toContain('Nuevo pedido');

    // 3 · «Crear pedido» → POST /api/orders, avisa y va al Detalle del pedido (/pedidos/:id)
    escribir(el, 'customerId', 'c1');
    escribir(el, 'date', '2026-11-05');
    escribir(el, 'amount', '25.5');
    botonConTexto(el, 'Crear pedido').click();
    el = await estable();
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create.mock.calls[0][0]).toEqual({ customerId: 'c1', date: '2026-11-05', amount: 25.5 });
    expect(repo.create.mock.calls[0][1]).toEqual(expect.any(String));
    expect(notice.message()).toBe('Pedido creado.');
    expect(location.path()).toBe('/pedidos/o-1');
    expect(repo.get).toHaveBeenCalledWith('o-1');
    expect(el.querySelector('h1')?.textContent).toContain('Detalle del pedido');
    expect(el.textContent).toContain('Pendiente');
    expect(botonConTexto(el, 'Enviar') as HTMLButtonElement).toHaveProperty('disabled', true);

    // El backend decide el estado: «Enviar» solo se puede desde «Confirmado», así que primero se confirma
    botonConTexto(el, 'Confirmar').click();
    el = await estable();
    expect(repo.confirm).toHaveBeenCalledWith('o-1');
    expect(notice.message()).toBe('Pedido confirmado.');
    expect(el.textContent).toContain('Confirmado');

    // 4 · «Enviar» abre el diálogo «Enviar pedido», sin llamar a nada aún
    botonConTexto(el, 'Enviar').click();
    harness.detectChanges();
    const dialogo = el.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialogo.querySelector('h2')?.textContent).toContain('Enviar pedido');
    expect(repo.ship).not.toHaveBeenCalled();
    escribir(el, 'carrier', 'DHL');
    escribir(el, 'shippingDate', '2026-11-06');

    // 5 · «Enviar pedido» → POST /api/orders/:id/ship, cierra, avisa y vuelve al Detalle ya «Enviado»
    botonConTexto(dialogo, 'Enviar pedido').click();
    el = await estable();
    expect(repo.ship).toHaveBeenCalledTimes(1);
    expect(repo.ship).toHaveBeenCalledWith('o-1', { carrier: 'DHL', shippingDate: '2026-11-06' });
    expect(notice.message()).toBe('Pedido enviado.');
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(location.path()).toBe('/pedidos/o-1');
    expect(repo.get).toHaveBeenCalledTimes(3); // al entrar, tras confirmar y tras enviar: siempre del servidor
    expect(el.querySelector('h1')?.textContent).toContain('Detalle del pedido');
    expect(el.textContent).toContain('Enviado');
    expect(botonConTexto(el, 'Enviar') as HTMLButtonElement).toHaveProperty('disabled', true);
    expect(botonConTexto(el, 'Marcar como entregado') as HTMLButtonElement).toHaveProperty('disabled', false);
  });

  it('«Cancelar» en Nuevo pedido vuelve a la lista sin crear nada', async () => {
    const { repo } = preparar();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/pedidos/nuevo');
    const el = harness.routeNativeElement as HTMLElement;
    botonConTexto(el, 'Cancelar').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Location).path()).toBe('/pedidos');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('si «Crear pedido» falla (422), el recorrido no avanza: sigue en Nuevo pedido con el aviso', async () => {
    const { repo } = preparar({ falloCrear: new OrderBusinessRuleError() });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/pedidos/nuevo');
    const el = harness.routeNativeElement as HTMLElement;
    escribirEn(el, 'customerId', 'c1');
    escribirEn(el, 'date', '2026-11-05');
    escribirEn(el, 'amount', '5');
    harness.detectChanges();
    botonConTexto(el, 'Crear pedido').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Location).path()).toBe('/pedidos/nuevo');
    expect(el.textContent).toContain('No se pudo por una regla del negocio.');
  });
});
