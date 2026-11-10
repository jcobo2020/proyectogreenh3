import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { createSpyObj } from '../../../../../testing/spy-obj';
import { NoticeService } from '../../../../@core/services/notice.service';
import {
  CancelOrderUseCase,
  ConfirmOrderUseCase,
  DeliverOrderUseCase,
  GetOrderUseCase,
  ShipOrderUseCase,
} from '../../application/order.use-cases';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderConflictError,
  OrderInfrastructureError,
  OrderNotFoundError,
  OrderSessionExpiredError,
} from '../../domain/errors/order.errors';
import { OrderActionResult, OrderDetail } from '../../domain/models/order.model';
import { OrderDetailComponent } from './order-detail.component';

function pedido(status: string): OrderDetail {
  return { id: 'o1', number: 'P-0001', customerId: 'c1', customerName: 'Ana Pérez', date: '2026-11-01', amount: 25.5, status };
}
const ok = (status: string): OrderActionResult => ({ id: 'o1', status });

function token(claims: object): string {
  return `x.${btoa(JSON.stringify(claims))}.y`;
}

interface Opciones {
  carga?: Observable<OrderDetail>;
  status?: string;
  accion?: Observable<OrderActionResult>;
}

function crear(opciones: Opciones = {}) {
  const get = createSpyObj<GetOrderUseCase>(['execute']);
  const confirm = createSpyObj<ConfirmOrderUseCase>(['execute']);
  const ship = createSpyObj<ShipOrderUseCase>(['execute']);
  const cancel = createSpyObj<CancelOrderUseCase>(['execute']);
  const deliver = createSpyObj<DeliverOrderUseCase>(['execute']);
  get.execute.mockReturnValue(opciones.carga ?? of(pedido(opciones.status ?? 'pending')));
  for (const uc of [confirm, ship, cancel, deliver]) uc.execute.mockReturnValue(opciones.accion ?? of(ok('x')));
  TestBed.configureTestingModule({
    imports: [OrderDetailComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'o1']]) } } },
      { provide: GetOrderUseCase, useValue: get },
      { provide: ConfirmOrderUseCase, useValue: confirm },
      { provide: ShipOrderUseCase, useValue: ship },
      { provide: CancelOrderUseCase, useValue: cancel },
      { provide: DeliverOrderUseCase, useValue: deliver },
    ],
  });
  const fixture = TestBed.createComponent(OrderDetailComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const notice = TestBed.inject(NoticeService);
  const botones = () => Array.from(el.querySelectorAll<HTMLElement>('button, a'));
  const boton = (texto: string, dentroDeDialogo = false) =>
    botones().find(
      (b) => b.textContent?.trim().replace(/^[^\wÁ-ú]+\s*/, '') === texto && !!b.closest('.dialogo') === dentroDeDialogo,
    ) as HTMLButtonElement;
  const pulsar = (b: HTMLElement) => {
    b.click();
    fixture.detectChanges();
  };
  const escribir = (id: string, valor: string) => {
    const c = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
    c.value = valor;
    c.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const dialogo = () => el.querySelector('.dialogo');
  return { fixture, el, get, confirm, ship, cancel, deliver, notice, boton, pulsar, escribir, dialogo };
}

afterEach(() => sessionStorage.clear());

describe('OrderDetailComponent · estados de la pantalla', () => {
  it('AC-15: pide el pedido por su id y enseña Número, Cliente, Fecha, Importe y Estado', () => {
    const { el, get } = crear({ status: 'confirmed' });
    expect(get.execute).toHaveBeenCalledTimes(1);
    expect(get.execute).toHaveBeenCalledWith('o1');
    for (const t of ['Detalle del pedido', 'Número', 'P-0001', 'Cliente', 'Ana Pérez', 'Fecha', '2026-11-01', 'Importe', '25.50', 'Estado', 'Confirmado']) {
      expect(el.textContent).toContain(t);
    }
  });

  it('AC-16: mientras espera los datos muestra «Cargando…»', () => {
    const { el } = crear({ carga: NEVER });
    expect(el.textContent).toContain('Cargando…');
  });

  it('AC-17: sin datos muestra «No hay datos que mostrar.»', () => {
    const { el } = crear({ carga: of({} as OrderDetail) });
    expect(el.textContent).toContain('No hay datos que mostrar.');
  });

  it('AC-18: si la carga falla muestra el aviso y ofrece reintentar', () => {
    const { el, get, boton, pulsar } = crear({ carga: throwError(() => new OrderInfrastructureError()) });
    expect(el.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    get.execute.mockReturnValue(of(pedido('pending')));
    pulsar(boton('Reintentar'));
    expect(get.execute).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('P-0001');
  });

  it('AC-19: si la sesión declara permisos y falta «pedidos.consultar», dice que no hay permiso y no llama a la API', () => {
    sessionStorage.setItem('token', token({ permissions: ['pedidos.gestionar'] }));
    const { el, get } = crear();
    expect(el.textContent).toContain('No tienes permiso para ver esto.');
    expect(get.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['AC-20', new InvalidOrderInputError(), 'Revisa los datos marcados.'],
    ['AC-21', new OrderSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
    ['AC-22', new ForbiddenOrderError(), 'No tienes permiso para hacer esto.'],
    ['AC-23', new OrderNotFoundError(), 'No se encontró lo que buscas.'],
  ])('%s: la carga con ese error dice su aviso', (_ac, error, texto) => {
    const { el } = crear({ carga: throwError(() => error) });
    expect(el.textContent).toContain(texto);
    expect(el.querySelector('h1')).toBeNull();
  });

  it('AC-21: con 401 ofrece volver a entrar', () => {
    const { el } = crear({ carga: throwError(() => new OrderSessionExpiredError()) });
    expect(el.querySelector('a.boton')?.textContent).toContain('Entrar');
  });
});

describe('OrderDetailComponent · botones según el Estado', () => {
  it.each([
    ['pending', { Confirmar: true, Enviar: false, 'Marcar como entregado': false, 'Cancelar pedido': true }],
    ['confirmed', { Confirmar: false, Enviar: true, 'Marcar como entregado': false, 'Cancelar pedido': true }],
    ['shipped', { Confirmar: false, Enviar: false, 'Marcar como entregado': true, 'Cancelar pedido': false }],
    ['delivered', { Confirmar: false, Enviar: false, 'Marcar como entregado': false, 'Cancelar pedido': false }],
    ['cancelled', { Confirmar: false, Enviar: false, 'Marcar como entregado': false, 'Cancelar pedido': false }],
  ])('estado %s: cada botón se pulsa solo cuando su acción cabe; si no, desactivado', (status, activos) => {
    const { boton } = crear({ status });
    for (const [texto, activo] of Object.entries(activos)) {
      expect(boton(texto).disabled, `${texto} en ${status}`).toBe(!activo);
    }
  });

  it('sin «pedidos.gestionar» en la sesión no se ofrecen los botones de acción', () => {
    sessionStorage.setItem('token', token({ permissions: ['pedidos.consultar'] }));
    const { el } = crear();
    expect(el.textContent).toContain('P-0001');
    expect(el.querySelector('.detalle__acciones')).toBeNull();
  });
});

describe('OrderDetailComponent · Confirmar y Marcar como entregado', () => {
  const casos = [
    { nombre: 'Confirmar', status: 'pending', uc: 'confirm' as const, ok: 'Pedido confirmado.', conflicto: 'Este pedido ya no se puede confirmar.', acs: [42, 43, 44, 45, 46, 47] },
    { nombre: 'Marcar como entregado', status: 'shipped', uc: 'deliver' as const, ok: 'Pedido entregado.', conflicto: 'Este pedido ya no se puede entregar.', acs: [48, 49, 50, 51, 52, 53] },
  ];

  for (const c of casos) {
    describe(c.nombre, () => {
      it(`AC-${c.acs[0]}: llama a su API con el id, recarga el pedido y avisa «${c.ok}»`, () => {
        const { get, notice, boton, pulsar, ...resto } = crear({ status: c.status });
        pulsar(boton(c.nombre));
        expect(resto[c.uc].execute).toHaveBeenCalledWith('o1');
        expect(get.execute).toHaveBeenCalledTimes(2);
        expect(notice.message()).toBe(c.ok);
      });

      it.each([
        [c.acs[1], new InvalidOrderInputError(), 'Revisa los datos marcados.'],
        [c.acs[2], new OrderSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
        [c.acs[3], new ForbiddenOrderError(), 'No tienes permiso para hacer esto.'],
        [c.acs[4], new OrderNotFoundError(), 'No se encontró lo que buscas.'],
      ])('AC-%i: con ese error avisa y no recarga', (_ac, error, texto) => {
        const { el, get, boton, pulsar, ...resto } = crear({ status: c.status });
        resto[c.uc].execute.mockReturnValue(throwError(() => error));
        pulsar(boton(c.nombre));
        expect(el.querySelector('.detalle__aviso')?.textContent).toContain(texto);
        expect(get.execute).toHaveBeenCalledTimes(1);
      });

      it(`AC-${c.acs[5]}: con 409 vuelve a cargar y avisa «${c.conflicto}»`, () => {
        const { el, get, boton, pulsar, ...resto } = crear({ status: c.status });
        resto[c.uc].execute.mockReturnValue(throwError(() => new OrderConflictError()));
        pulsar(boton(c.nombre));
        expect(get.execute).toHaveBeenCalledTimes(2);
        expect(el.querySelector('.detalle__aviso')?.textContent).toContain(c.conflicto);
      });

      it('si falla de otra forma ofrece reintentar y reintenta', () => {
        const { el, boton, pulsar, ...resto } = crear({ status: c.status });
        resto[c.uc].execute.mockReturnValue(throwError(() => new OrderInfrastructureError()));
        pulsar(boton(c.nombre));
        expect(el.querySelector('.detalle__aviso')?.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
        resto[c.uc].execute.mockReturnValue(of(ok('x')));
        pulsar(boton('Reintentar'));
        expect(resto[c.uc].execute).toHaveBeenCalledTimes(2);
      });

      it('mientras espera se bloquea, dice que está enviando y un doble clic hace una sola llamada', () => {
        const { boton, pulsar, fixture, ...resto } = crear({ status: c.status, accion: NEVER });
        const b = boton(c.nombre);
        pulsar(b);
        pulsar(b);
        fixture.detectChanges();
        expect(resto[c.uc].execute).toHaveBeenCalledTimes(1);
        expect(b.disabled).toBe(true);
        expect(b.textContent).toContain('Enviando…');
      });
    });
  }

  it('Confirmar: un 401 ofrece volver a entrar', () => {
    const { el, boton, pulsar, confirm } = crear({ status: 'pending' });
    confirm.execute.mockReturnValue(throwError(() => new OrderSessionExpiredError()));
    pulsar(boton('Confirmar'));
    expect(el.querySelector('.detalle__aviso a')?.textContent).toContain('Entrar');
  });
});

describe('OrderDetailComponent · diálogo «Enviar pedido»', () => {
  function abrir(o: Opciones = {}) {
    const c = crear({ status: 'confirmed', ...o });
    c.pulsar(c.boton('Enviar'));
    return c;
  }
  const rellenar = (c: ReturnType<typeof abrir>) => {
    c.escribir('carrier', 'DHL');
    c.escribir('shippingDate', '2026-11-02');
  };

  it('el botón «Enviar» abre el diálogo con Transportista y Fecha de envío', () => {
    const { dialogo } = abrir();
    expect(dialogo()?.textContent).toContain('Enviar pedido');
    expect(dialogo()?.textContent).toContain('Transportista');
    expect(dialogo()?.textContent).toContain('Fecha de envío');
  });

  it('«Cancelar» cierra sin llamar a nada y la pantalla se queda como estaba', () => {
    const c = abrir();
    c.pulsar(c.boton('Cancelar', true));
    expect(c.dialogo()).toBeNull();
    expect(c.ship.execute).not.toHaveBeenCalled();
    expect(c.el.textContent).toContain('P-0001');
  });

  it('obligatorios: sin Transportista ni Fecha de envío no se envía y salen sus mensajes, con aria y foco', async () => {
    const c = abrir();
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.ship.execute).not.toHaveBeenCalled();
    expect(c.dialogo()?.textContent).toContain('Transportista es obligatorio.');
    expect(c.dialogo()?.textContent).toContain('Fecha de envío es obligatoria.');
    const carrier = c.el.querySelector<HTMLInputElement>('#carrier')!;
    expect(carrier.getAttribute('aria-required')).toBe('true');
    expect(carrier.getAttribute('aria-invalid')).toBe('true');
    expect(carrier.getAttribute('aria-describedby')).toBe('carrier-error');
    expect(c.el.querySelector('#carrier-error')).not.toBeNull();
    await Promise.resolve();
    expect(document.activeElement === carrier || !document.body.contains(carrier)).toBe(true);
  });

  it('solo con Transportista falta Fecha de envío', () => {
    const c = abrir();
    c.escribir('carrier', 'DHL');
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.dialogo()?.textContent).toContain('Fecha de envío es obligatoria.');
    expect(c.dialogo()?.textContent).not.toContain('Transportista es obligatorio.');
  });

  it('AC-30: llama a POST ship con carrier y shippingDate, y solo a esa; cierra, recarga y avisa «Pedido enviado.»', () => {
    const c = abrir();
    rellenar(c);
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.ship.execute).toHaveBeenCalledWith('o1', { carrier: 'DHL', shippingDate: '2026-11-02' });
    expect(c.confirm.execute).not.toHaveBeenCalled();
    expect(c.cancel.execute).not.toHaveBeenCalled();
    expect(c.deliver.execute).not.toHaveBeenCalled();
    expect(c.dialogo()).toBeNull();
    expect(c.get.execute).toHaveBeenCalledTimes(2);
    expect(c.notice.message()).toBe('Pedido enviado.');
  });

  it('AC-31: con 400 conserva lo escrito, marca cada campo con el mensaje del servidor y avisa', () => {
    const c = abrir();
    rellenar(c);
    c.ship.execute.mockReturnValue(
      throwError(() => new InvalidOrderInputError([{ field: 'carrier', message: 'Transportista no válido.' }])),
    );
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.dialogo()?.textContent).toContain('Transportista no válido.');
    expect(c.dialogo()?.textContent).toContain('Revisa los datos marcados.');
    expect(c.el.querySelector<HTMLInputElement>('#carrier')!.value).toBe('DHL');
    expect(c.el.querySelector('#carrier')!.getAttribute('aria-invalid')).toBe('true');
  });

  it.each([
    ['AC-32', new OrderSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
    ['AC-33', new ForbiddenOrderError(), 'No tienes permiso para hacer esto.'],
    ['AC-34', new OrderNotFoundError(), 'No se encontró lo que buscas.'],
  ])('%s: con ese error avisa y conserva lo escrito', (_ac, error, texto) => {
    const c = abrir();
    rellenar(c);
    c.ship.execute.mockReturnValue(throwError(() => error));
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.dialogo()?.textContent).toContain(texto);
    expect(c.el.querySelector<HTMLInputElement>('#shippingDate')!.value).toBe('2026-11-02');
  });

  it('AC-32: con 401 ofrece volver a entrar', () => {
    const c = abrir();
    rellenar(c);
    c.ship.execute.mockReturnValue(throwError(() => new OrderSessionExpiredError()));
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.dialogo()?.querySelector('a')?.textContent).toContain('Entrar');
  });

  it('AC-35: con 409 vuelve a cargar y avisa «Este pedido ya no se puede enviar.»', () => {
    const c = abrir();
    rellenar(c);
    c.ship.execute.mockReturnValue(throwError(() => new OrderConflictError()));
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.get.execute).toHaveBeenCalledTimes(2);
    expect(c.el.textContent).toContain('Este pedido ya no se puede enviar.');
  });

  it('si falla de otra forma conserva lo escrito y ofrece reintentar', () => {
    const c = abrir();
    rellenar(c);
    c.ship.execute.mockReturnValue(throwError(() => new OrderInfrastructureError()));
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.dialogo()?.textContent).toContain('No se pudo cargar. Vuelve a intentarlo.');
    c.ship.execute.mockReturnValue(of(ok('shipped')));
    c.pulsar(c.boton('Reintentar', true));
    expect(c.ship.execute).toHaveBeenCalledTimes(2);
    expect(c.notice.message()).toBe('Pedido enviado.');
  });

  it('mientras espera se bloquea, dice que está enviando y un doble clic hace una sola llamada', () => {
    const c = abrir({ accion: NEVER });
    rellenar(c);
    const b = c.boton('Enviar pedido', true);
    c.pulsar(b);
    c.pulsar(c.boton('Enviando…', true));
    expect(c.ship.execute).toHaveBeenCalledTimes(1);
    expect(c.boton('Enviando…', true).disabled).toBe(true);
  });

  it('nada de lo escrito llega al servidor sin recortar espacios', () => {
    const c = abrir();
    c.escribir('carrier', '  DHL  ');
    c.escribir('shippingDate', '2026-11-02');
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.ship.execute).toHaveBeenCalledWith('o1', { carrier: 'DHL', shippingDate: '2026-11-02' });
  });

  it('el éxito deja que la respuesta pendiente se resuelva después', () => {
    const respuesta = new Subject<OrderActionResult>();
    const c = abrir({ accion: respuesta });
    rellenar(c);
    c.pulsar(c.boton('Enviar pedido', true));
    expect(c.dialogo()).not.toBeNull();
    respuesta.next(ok('shipped'));
    c.fixture.detectChanges();
    expect(c.dialogo()).toBeNull();
  });
});

describe('OrderDetailComponent · diálogo «Cancelar pedido»', () => {
  function abrir(o: Opciones = {}) {
    const c = crear({ status: 'pending', ...o });
    c.pulsar(c.boton('Cancelar pedido'));
    return c;
  }

  it('el botón «Cancelar pedido» abre el diálogo con Motivo, con «Volver» para cerrar', () => {
    const c = abrir();
    expect(c.dialogo()?.textContent).toContain('Motivo');
    expect(c.boton('Cancelar pedido', true).classList).toContain('boton--peligro');
    c.pulsar(c.boton('Volver', true));
    expect(c.dialogo()).toBeNull();
    expect(c.cancel.execute).not.toHaveBeenCalled();
  });

  it('obligatorio: sin Motivo no se envía y sale «Motivo es obligatorio.» con aria', () => {
    const c = abrir();
    c.pulsar(c.boton('Cancelar pedido', true));
    expect(c.cancel.execute).not.toHaveBeenCalled();
    expect(c.dialogo()?.textContent).toContain('Motivo es obligatorio.');
    const motivo = c.el.querySelector('#cancellationReason')!;
    expect(motivo.getAttribute('aria-required')).toBe('true');
    expect(motivo.getAttribute('aria-invalid')).toBe('true');
    expect(motivo.getAttribute('aria-describedby')).toBe('cancellationReason-error');
  });

  it('AC-36: llama a POST cancel con cancellationReason y solo a esa; cierra, recarga y avisa «Pedido cancelado.»', () => {
    const c = abrir();
    c.escribir('cancellationReason', 'Duplicado');
    c.pulsar(c.boton('Cancelar pedido', true));
    expect(c.cancel.execute).toHaveBeenCalledWith('o1', { cancellationReason: 'Duplicado' });
    expect(c.ship.execute).not.toHaveBeenCalled();
    expect(c.dialogo()).toBeNull();
    expect(c.get.execute).toHaveBeenCalledTimes(2);
    expect(c.notice.message()).toBe('Pedido cancelado.');
  });

  it('AC-37: con 400 conserva lo escrito y marca el campo con el mensaje del servidor', () => {
    const c = abrir();
    c.escribir('cancellationReason', 'Duplicado');
    c.cancel.execute.mockReturnValue(
      throwError(() => new InvalidOrderInputError([{ field: 'cancellationReason', message: 'Motivo demasiado largo.' }])),
    );
    c.pulsar(c.boton('Cancelar pedido', true));
    expect(c.dialogo()?.textContent).toContain('Motivo demasiado largo.');
    expect(c.dialogo()?.textContent).toContain('Revisa los datos marcados.');
    expect(c.el.querySelector<HTMLTextAreaElement>('#cancellationReason')!.value).toBe('Duplicado');
  });

  it.each([
    ['AC-38', new OrderSessionExpiredError(), 'Tu sesión terminó: vuelve a entrar.'],
    ['AC-39', new ForbiddenOrderError(), 'No tienes permiso para hacer esto.'],
    ['AC-40', new OrderNotFoundError(), 'No se encontró lo que buscas.'],
  ])('%s: con ese error avisa y conserva lo escrito', (_ac, error, texto) => {
    const c = abrir();
    c.escribir('cancellationReason', 'Duplicado');
    c.cancel.execute.mockReturnValue(throwError(() => error));
    c.pulsar(c.boton('Cancelar pedido', true));
    expect(c.dialogo()?.textContent).toContain(texto);
    expect(c.el.querySelector<HTMLTextAreaElement>('#cancellationReason')!.value).toBe('Duplicado');
  });

  it('AC-41: con 409 vuelve a cargar y avisa «Este pedido ya no se puede cancelar.»', () => {
    const c = abrir();
    c.escribir('cancellationReason', 'Duplicado');
    c.cancel.execute.mockReturnValue(throwError(() => new OrderConflictError()));
    c.pulsar(c.boton('Cancelar pedido', true));
    expect(c.get.execute).toHaveBeenCalledTimes(2);
    expect(c.el.textContent).toContain('Este pedido ya no se puede cancelar.');
  });

  it('si falla de otra forma conserva lo escrito y ofrece reintentar', () => {
    const c = abrir();
    c.escribir('cancellationReason', 'Duplicado');
    c.cancel.execute.mockReturnValue(throwError(() => new OrderInfrastructureError()));
    c.pulsar(c.boton('Cancelar pedido', true));
    c.cancel.execute.mockReturnValue(of(ok('cancelled')));
    c.pulsar(c.boton('Reintentar', true));
    expect(c.cancel.execute).toHaveBeenCalledTimes(2);
  });

  it('mientras espera se bloquea y un doble clic hace una sola llamada', () => {
    const c = abrir({ accion: NEVER });
    c.escribir('cancellationReason', 'Duplicado');
    c.pulsar(c.boton('Cancelar pedido', true));
    c.pulsar(c.boton('Enviando…', true));
    expect(c.cancel.execute).toHaveBeenCalledTimes(1);
  });

  it('con 401 ofrece volver a entrar', () => {
    const c = abrir();
    c.escribir('cancellationReason', 'Duplicado');
    c.cancel.execute.mockReturnValue(throwError(() => new OrderSessionExpiredError()));
    c.pulsar(c.boton('Cancelar pedido', true));
    expect(c.dialogo()?.querySelector('a')?.textContent).toContain('Entrar');
  });
});

describe('OrderDetailComponent · reintento sin acción previa', () => {
  it('retry no hace nada si no hubo ninguna acción', () => {
    const c = crear({ status: 'pending' });
    (c.fixture.componentInstance as unknown as { retry(): void }).retry();
    expect(c.confirm.execute).not.toHaveBeenCalled();
  });
});
