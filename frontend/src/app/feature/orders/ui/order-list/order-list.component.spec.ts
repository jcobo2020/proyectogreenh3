import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { createSpyObj } from '../../../../../testing/spy-obj';
import { ListCustomerOptionsUseCase, ListOrdersUseCase } from '../../application/order.use-cases';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderInfrastructureError,
  OrderSessionExpiredError,
} from '../../domain/errors/order.errors';
import { CustomerOption, OrderListItem, OrderPage } from '../../domain/models/order.model';
import { OrderListComponent } from './order-list.component';

const clientes: CustomerOption[] = [
  { id: 'c1', name: 'Ana' },
  { id: 'c2', name: 'Luis' },
];
const pedido = (n: number): OrderListItem => ({
  id: `o${n}`,
  number: `P-000${n}`,
  customerId: 'c1',
  customerName: 'Ana',
  date: '2026-03-05',
  amount: 1234.5,
  status: n % 2 ? 'pending' : 'shipped',
});
const pagina = (items: OrderListItem[], total = items.length, page = 1): OrderPage => ({
  items,
  total,
  page,
  pageSize: 20,
});

function token(claims: object): string {
  return `x.${btoa(JSON.stringify(claims))}.y`;
}

function crear(opciones: { orders?: Observable<OrderPage>; customers?: Observable<CustomerOption[]> } = {}) {
  const orders = createSpyObj<ListOrdersUseCase>(['execute']);
  const customers = createSpyObj<ListCustomerOptionsUseCase>(['execute']);
  orders.execute.mockReturnValue(opciones.orders ?? of(pagina([pedido(1), pedido(2)])));
  customers.execute.mockReturnValue(opciones.customers ?? of(clientes));
  TestBed.configureTestingModule({
    imports: [OrderListComponent],
    providers: [
      provideRouter([]),
      { provide: ListOrdersUseCase, useValue: orders },
      { provide: ListCustomerOptionsUseCase, useValue: customers },
    ],
  });
  const fixture = TestBed.createComponent(OrderListComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, orders, customers };
}

function cambiar(el: HTMLElement, selector: string, valor: string) {
  const campo = el.querySelector(selector) as HTMLSelectElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('change'));
}

describe('OrderListComponent', () => {
  afterEach(() => sessionStorage.clear());

  it('AC-01: lista número, cliente, fecha, importe y estado', () => {
    const { el } = crear();
    const celdas = Array.from(el.querySelectorAll('tbody tr:first-child td')).map((c) => c.textContent?.trim());
    expect(celdas.slice(0, 5)).toEqual(['P-0001', 'Ana', '05/03/2026', '1,234.50', 'Pendiente']);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Enviado');
  });

  it('[act_opc_x6hq6ze7] carga los clientes y [act_cargar_oas4tpe4] los pedidos una vez al entrar', () => {
    const { orders, customers } = crear();
    expect(customers.execute).toHaveBeenCalledTimes(1);
    expect(orders.execute).toHaveBeenCalledTimes(1);
    expect(orders.execute).toHaveBeenCalledWith({ customerId: '', status: '' }, 1, 20);
  });

  it('muestra los clientes y los estados como opciones de filtro', () => {
    const { el } = crear();
    const cli = Array.from(el.querySelectorAll('select[name=customerId] option')).map((o) => o.textContent?.trim());
    const est = Array.from(el.querySelectorAll('select[name=status] option')).map((o) => o.textContent?.trim());
    expect(cli).toEqual(['Todos', 'Ana', 'Luis']);
    expect(est).toEqual(['Todos', 'Pendiente', 'Confirmado', 'Enviado', 'Entregado', 'Cancelado']);
  });

  it('AC-01: filtra por cliente y estado y vuelve a la página 1', () => {
    const { el, orders } = crear();
    cambiar(el, 'select[name=customerId]', 'c2');
    expect(orders.execute).toHaveBeenLastCalledWith({ customerId: 'c2', status: '' }, 1, 20);
    cambiar(el, 'select[name=status]', 'shipped');
    expect(orders.execute).toHaveBeenLastCalledWith({ customerId: 'c2', status: 'shipped' }, 1, 20);
  });

  it('pagina de 20 en 20 y recarga al cambiar de página', () => {
    const { fixture, el, orders } = crear({ orders: of(pagina([pedido(1)], 45)) });
    expect(el.querySelector('nav')?.textContent).toContain('Página 1 de 3');
    const [anterior, siguiente] = Array.from(el.querySelectorAll('nav button')) as HTMLButtonElement[];
    expect(anterior.disabled).toBe(true);
    siguiente.click();
    fixture.detectChanges();
    expect(orders.execute).toHaveBeenLastCalledWith({ customerId: '', status: '' }, 2, 20);
    const llamadas = orders.execute.mock.calls.length;
    (fixture.componentInstance as any).goToPage(99);
    (fixture.componentInstance as any).goToPage(0);
    expect(orders.execute.mock.calls.length).toBe(llamadas);
  });

  it('AC-02: mientras espera muestra «Cargando…»', () => {
    const { el } = crear({ orders: NEVER });
    expect(el.textContent).toContain('Cargando…');
  });

  it('AC-03: sin datos muestra «No hay datos que mostrar.»', () => {
    const { el } = crear({ orders: of(pagina([])) });
    expect(el.textContent).toContain('No hay datos que mostrar.');
    expect(el.querySelector('table')).toBeNull();
  });

  it('AC-04: si la carga falla muestra el error y permite reintentar', () => {
    const { fixture, el, orders } = crear({ orders: throwError(() => new OrderInfrastructureError()) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    orders.execute.mockReturnValue(of(pagina([pedido(1)])));
    (el.querySelector('[role=alert] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('un error desconocido también se trata como fallo de carga', () => {
    const { el } = crear({ orders: throwError(() => new Error('x')) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
  });

  it('AC-05: si la sesión no trae «pedidos.consultar» muestra «No tienes permiso para ver esto.» sin llamar a la API', () => {
    sessionStorage.setItem('token', token({ permissions: ['otro.permiso'] }));
    const { el, orders } = crear();
    expect(el.textContent).toContain('No tienes permiso para ver esto.');
    expect(orders.execute).not.toHaveBeenCalled();
    expect(el.querySelector('table')).toBeNull();
  });

  it('con «pedidos.consultar» en la sesión carga los pedidos', () => {
    sessionStorage.setItem('token', token({ permissions: ['pedidos.consultar'] }));
    const { el, orders } = crear();
    expect(orders.execute).toHaveBeenCalledTimes(1);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('AC-06: con 400 muestra «Revisa los datos marcados.»', () => {
    const { el } = crear({ orders: throwError(() => new InvalidOrderInputError()) });
    expect(el.textContent).toContain('Revisa los datos marcados.');
  });

  it('AC-07: con 401 muestra «Tu sesión terminó: vuelve a entrar.» y un enlace para entrar', () => {
    const { el } = crear({ orders: throwError(() => new OrderSessionExpiredError()) });
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
    expect(el.querySelector('a[href^="/login"]')).not.toBeNull();
  });

  it('401 al cargar los clientes también muestra el aviso de sesión', () => {
    const { el } = crear({ customers: throwError(() => new OrderSessionExpiredError()) });
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
  });

  it('AC-08: con 403 muestra «No tienes permiso para hacer esto.»', () => {
    const { el } = crear({ orders: throwError(() => new ForbiddenOrderError()) });
    expect(el.textContent).toContain('No tienes permiso para hacer esto.');
  });

  it('si fallan los clientes ofrece reintentar', () => {
    const { fixture, el, customers } = crear({ customers: throwError(() => new OrderInfrastructureError()) });
    expect(el.querySelector('.pedidos__aviso')?.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    customers.execute.mockReturnValue(of(clientes));
    (el.querySelector('.pedidos__aviso button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.pedidos__aviso')).toBeNull();
    expect(el.querySelectorAll('select[name=customerId] option').length).toBe(3);
  });

  it('[nav_2ei9j4j0] «Ver detalle» va a /pedidos/:id y [nav_iyhphumc] «Nuevo pedido» a /pedidos/nuevo', () => {
    const { el } = crear();
    expect(el.querySelector('a[aria-label="Ver detalle"]')?.getAttribute('href')).toBe('/pedidos/o1');
    const nuevo = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('Nuevo pedido'));
    expect(nuevo?.getAttribute('href')).toBe('/pedidos/nuevo');
  });

  it('un estado desconocido se muestra tal cual', () => {
    const { el } = crear({ orders: of(pagina([{ ...pedido(1), status: 'otro' }])) });
    expect(el.textContent).toContain('otro');
  });
});
