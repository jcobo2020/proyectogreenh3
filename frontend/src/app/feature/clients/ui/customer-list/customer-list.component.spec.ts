import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { createSpyObj } from '../../../../../testing/spy-obj';
import { ListCustomersUseCase, ListProvincesUseCase } from '../../application/customer.use-cases';
import {
  CustomerInfrastructureError,
  CustomerSessionExpiredError,
  InvalidCustomerInputError,
} from '../../domain/errors/customer.errors';
import { CustomerListItem, CustomerPage, Province } from '../../domain/models/customer.model';
import { CustomerListComponent } from './customer-list.component';

const provincias: Province[] = [
  { id: 'p1', code: '01', name: 'Madrid' },
  { id: 'p2', code: '02', name: 'Sevilla' },
];
const cliente = (n: number): CustomerListItem => ({
  id: `c${n}`,
  name: `Cliente ${n}`,
  email: `c${n}@mail.test`,
  provinceId: 'p1',
  provinceName: 'Madrid',
  townId: 't1',
  townName: 'Getafe',
  status: n % 2 ? 'active' : 'inactive',
});
const pagina = (items: CustomerListItem[], total = items.length, page = 1): CustomerPage => ({
  items,
  total,
  page,
  pageSize: 20,
});

function crear(opciones: { customers?: Observable<CustomerPage>; provinces?: Observable<Province[]> } = {}) {
  const customers = createSpyObj<ListCustomersUseCase>(['execute']);
  const provinces = createSpyObj<ListProvincesUseCase>(['execute']);
  customers.execute.mockReturnValue(opciones.customers ?? of(pagina([cliente(1), cliente(2)])));
  provinces.execute.mockReturnValue(opciones.provinces ?? of(provincias));
  TestBed.configureTestingModule({
    imports: [CustomerListComponent],
    providers: [
      provideRouter([]),
      { provide: ListCustomersUseCase, useValue: customers },
      { provide: ListProvincesUseCase, useValue: provinces },
    ],
  });
  const fixture = TestBed.createComponent(CustomerListComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, customers, provinces };
}

function cambiar(el: HTMLElement, selector: string, valor: string) {
  const campo = el.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('change'));
}

describe('CustomerListComponent', () => {
  it('AC-01: lista nombre, email, provincia, población y estado', () => {
    const { el } = crear();
    const celdas = Array.from(el.querySelectorAll('tbody tr:first-child td')).map((c) => c.textContent?.trim());
    expect(celdas.slice(0, 5)).toEqual(['Cliente 1', 'c1@mail.test', 'Madrid', 'Getafe', 'Activo']);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Inactivo');
  });

  it('carga las provincias y los clientes una vez al entrar', () => {
    const { customers, provinces } = crear();
    expect(provinces.execute).toHaveBeenCalledTimes(1);
    expect(customers.execute).toHaveBeenCalledTimes(1);
    expect(customers.execute).toHaveBeenCalledWith({ name: '', provinceId: '', status: '' }, 1, 20);
  });

  it('muestra las provincias como opciones del filtro', () => {
    const { el } = crear();
    const opciones = Array.from(el.querySelectorAll('select[name=provinceId] option')).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Todas', 'Madrid', 'Sevilla']);
  });

  it('AC-01: filtra por nombre, provincia y estado y vuelve a la página 1', () => {
    const { el, customers } = crear();
    cambiar(el, 'input[name=name]', 'Ana');
    expect(customers.execute).toHaveBeenLastCalledWith({ name: 'Ana', provinceId: '', status: '' }, 1, 20);
    cambiar(el, 'select[name=provinceId]', 'p2');
    expect(customers.execute).toHaveBeenLastCalledWith({ name: 'Ana', provinceId: 'p2', status: '' }, 1, 20);
    cambiar(el, 'select[name=status]', 'inactive');
    expect(customers.execute).toHaveBeenLastCalledWith({ name: 'Ana', provinceId: 'p2', status: 'inactive' }, 1, 20);
  });

  it('pagina de 20 en 20 y recarga al cambiar de página', () => {
    const { fixture, el, customers } = crear({ customers: of(pagina([cliente(1)], 45)) });
    expect(el.querySelector('nav')?.textContent).toContain('Página 1 de 3');
    const [anterior, siguiente] = Array.from(el.querySelectorAll('nav button')) as HTMLButtonElement[];
    expect(anterior.disabled).toBe(true);
    siguiente.click();
    fixture.detectChanges();
    expect(customers.execute).toHaveBeenLastCalledWith({ name: '', provinceId: '', status: '' }, 2, 20);
    // fuera de rango: no recarga
    const llamadas = customers.execute.mock.calls.length;
    (fixture.componentInstance as any).goToPage(99);
    (fixture.componentInstance as any).goToPage(0);
    expect(customers.execute.mock.calls.length).toBe(llamadas);
  });

  it('AC-02: mientras espera muestra «Cargando…»', () => {
    const { el } = crear({ customers: NEVER });
    expect(el.textContent).toContain('Cargando…');
  });

  it('AC-03: sin datos muestra «No hay datos que mostrar.»', () => {
    const { el } = crear({ customers: of(pagina([])) });
    expect(el.textContent).toContain('No hay datos que mostrar.');
    expect(el.querySelector('table')).toBeNull();
  });

  it('AC-04: si la carga falla muestra el error y permite reintentar', () => {
    const { fixture, el, customers } = crear({ customers: throwError(() => new CustomerInfrastructureError()) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    customers.execute.mockReturnValue(of(pagina([cliente(1)])));
    (el.querySelector('[role=alert] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('un error desconocido también se trata como fallo de carga', () => {
    const { el } = crear({ customers: throwError(() => new Error('x')) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
  });

  it('AC-05: con 400 muestra «Revisa los datos marcados.»', () => {
    const { el } = crear({ customers: throwError(() => new InvalidCustomerInputError()) });
    expect(el.textContent).toContain('Revisa los datos marcados.');
  });

  it('AC-06: con 401 muestra «Tu sesión terminó: vuelve a entrar.» y un enlace para entrar', () => {
    const { el } = crear({ customers: throwError(() => new CustomerSessionExpiredError()) });
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
    expect(el.querySelector('a[href^="/login"]')).not.toBeNull();
  });

  it('401 al cargar las provincias también muestra el aviso de sesión', () => {
    const { el } = crear({ provinces: throwError(() => new CustomerSessionExpiredError()) });
    expect(el.textContent).toContain('Tu sesión terminó: vuelve a entrar.');
  });

  it('si fallan las provincias ofrece reintentar', () => {
    const { fixture, el, provinces } = crear({ provinces: throwError(() => new CustomerInfrastructureError()) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    provinces.execute.mockReturnValue(of(provincias));
    (el.querySelector('.clientes__aviso button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.clientes__aviso')).toBeNull();
    expect(el.querySelectorAll('select[name=provinceId] option').length).toBe(3);
  });

  it('«Ver detalle» va a /clientes/:id y «Nuevo cliente» a /clientes/nuevo', () => {
    const { el } = crear();
    expect(el.querySelector('a[aria-label="Ver detalle"]')?.getAttribute('href')).toBe('/clientes/c1');
    const nuevo = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('Nuevo cliente'));
    expect(nuevo?.getAttribute('href')).toBe('/clientes/nuevo');
  });

  it('un estado desconocido se muestra tal cual', () => {
    const { el } = crear({ customers: of(pagina([{ ...cliente(1), status: 'otro' }])) });
    expect(el.textContent).toContain('otro');
  });
});
