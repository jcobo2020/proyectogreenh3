import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { loginUrl } from '../../../../@core/guards/auth.guard';
import { lacksPermission } from '../../../../@core/guards/permissions';
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
  OrderNotFoundError,
  OrderSessionExpiredError,
} from '../../domain/errors/order.errors';
import {
  ORDER_STATUSES,
  ORDERS_MANAGE_PERMISSION,
  ORDERS_VIEW_PERMISSION,
  OrderActionResult,
  OrderDetail,
} from '../../domain/models/order.model';

export type DetailState = 'loading' | 'data' | 'empty' | 'error' | 'invalid' | 'session' | 'notfound' | 'forbidden' | 'noaccess';
type Accion = 'confirm' | 'ship' | 'cancel' | 'deliver';
type Dialogo = 'ship' | 'cancel';
type CampoEnvio = 'carrier' | 'shippingDate';

const GENERIC_ERROR = 'No se pudo cargar. Vuelve a intentarlo.';

/** Lo que dice cada acción: su aviso de éxito y el de 409. */
const TEXTOS: Record<Accion, { ok: string; conflicto: string }> = {
  confirm: { ok: 'Pedido confirmado.', conflicto: 'Este pedido ya no se puede confirmar.' },
  ship: { ok: 'Pedido enviado.', conflicto: 'Este pedido ya no se puede enviar.' },
  cancel: { ok: 'Pedido cancelado.', conflicto: 'Este pedido ya no se puede cancelar.' },
  deliver: { ok: 'Pedido entregado.', conflicto: 'Este pedido ya no se puede entregar.' },
};

/** Estados desde los que se puede pulsar cada acción (el servidor sigue decidiendo). */
const DESDE: Record<Accion, string[]> = {
  confirm: ['pending'],
  ship: ['confirmed'],
  cancel: ['pending', 'confirmed'],
  deliver: ['shipped'],
};

const OBLIGATORIOS: Record<string, string> = {
  carrier: 'Transportista es obligatorio.',
  shippingDate: 'Fecha de envío es obligatoria.',
  cancellationReason: 'Motivo es obligatorio.',
};

interface Aviso {
  texto: string;
  sesion: boolean;
}

@Component({
  selector: 'app-order-detail',
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css',
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notice = inject(NoticeService);
  private readonly getOrder = inject(GetOrderUseCase);
  private readonly confirmOrder = inject(ConfirmOrderUseCase);
  private readonly shipOrder = inject(ShipOrderUseCase);
  private readonly cancelOrder = inject(CancelOrderUseCase);
  private readonly deliverOrder = inject(DeliverOrderUseCase);

  /** El `:id` de la ruta. */
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly state = signal<DetailState>('loading');
  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly statusLabel = computed(() => {
    const status = this.order()?.status ?? '';
    return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
  });
  protected readonly loginHref = loginUrl(`/pedidos/${this.id}`);

  /** Se ofrecen los botones de acción solo si la sesión no declara que falta «pedidos.gestionar». */
  protected readonly canManage = !lacksPermission(ORDERS_MANAGE_PERMISSION);
  protected readonly dialog = signal<Dialogo | null>(null);
  /** Acción esperando respuesta: bloquea su botón (un doble clic hace una sola llamada). */
  protected readonly busy = signal<Accion | null>(null);
  protected readonly aviso = signal<Aviso | null>(null);
  protected readonly submitted = signal(false);
  /** Mensajes del servidor por campo (400), hasta que se vuelva a enviar. */
  protected readonly serverErrors = signal<Record<string, string>>({});

  protected readonly shipForm = new FormGroup({
    carrier: new FormControl('', { nonNullable: true }),
    shippingDate: new FormControl('', { nonNullable: true }),
  });
  protected readonly cancelForm = new FormGroup({
    cancellationReason: new FormControl('', { nonNullable: true }),
  });

  /** Última acción lanzada, para «Reintentar». */
  private ultima: Accion | null = null;

  ngOnInit(): void {
    // Sin el permiso de consulta en la sesión no se ofrece la pantalla: no se llama a la API.
    if (lacksPermission(ORDERS_VIEW_PERMISSION)) {
      this.state.set('noaccess');
      return;
    }
    this.load();
  }

  /** «Cargar el elemento»: sin caché. Tras una acción se recarga sin tapar la pantalla. */
  protected load(silent = false): void {
    if (!silent) this.state.set('loading');
    this.getOrder.execute(this.id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.state.set(order?.id ? 'data' : 'empty');
      },
      error: (error) => {
        if (error instanceof InvalidOrderInputError) this.state.set('invalid');
        else if (error instanceof OrderSessionExpiredError) this.state.set('session');
        else if (error instanceof ForbiddenOrderError) this.state.set('forbidden');
        else if (error instanceof OrderNotFoundError) this.state.set('notfound');
        else this.state.set('error');
      },
    });
  }

  /** Cada botón hereda cuándo se pulsa de la acción que hace (o que envía el diálogo que abre). */
  protected can(accion: Accion): boolean {
    return DESDE[accion].includes(this.order()?.status ?? '');
  }

  protected openDialog(dialogo: Dialogo): void {
    this.aviso.set(null);
    this.submitted.set(false);
    this.serverErrors.set({});
    this.dialog.set(dialogo);
  }

  protected closeDialog(): void {
    this.dialog.set(null);
    this.aviso.set(null);
  }

  /** Mensaje de validación del campo (literal de la spec), o el que dio el servidor. */
  protected fieldError(campo: CampoEnvio | 'cancellationReason'): string | null {
    const servidor = this.serverErrors()[campo];
    if (servidor) return servidor;
    if (!this.submitted()) return null;
    const valor = (campo === 'cancellationReason' ? this.cancelForm.getRawValue() : this.shipForm.getRawValue()) as Record<string, string>;
    return (valor[campo] ?? '').trim() === '' ? OBLIGATORIOS[campo] : null;
  }

  protected confirm(): void {
    this.run('confirm', () => this.confirmOrder.execute(this.id));
  }

  protected deliver(): void {
    this.run('deliver', () => this.deliverOrder.execute(this.id));
  }

  protected submitShip(): void {
    if (this.busy()) return;
    this.submitted.set(true);
    this.serverErrors.set({});
    this.aviso.set(null);
    if (!this.validar(['carrier', 'shippingDate'])) return;
    const { carrier, shippingDate } = this.shipForm.getRawValue();
    this.run('ship', () => this.shipOrder.execute(this.id, { carrier: carrier.trim(), shippingDate }));
  }

  protected submitCancel(): void {
    if (this.busy()) return;
    this.submitted.set(true);
    this.serverErrors.set({});
    this.aviso.set(null);
    if (!this.validar(['cancellationReason'])) return;
    const { cancellationReason } = this.cancelForm.getRawValue();
    this.run('cancel', () => this.cancelOrder.execute(this.id, { cancellationReason: cancellationReason.trim() }));
  }

  protected retry(): void {
    if (this.busy()) return;
    if (this.ultima === 'ship') this.submitShip();
    else if (this.ultima === 'cancel') this.submitCancel();
    else if (this.ultima === 'confirm') this.confirm();
    else if (this.ultima === 'deliver') this.deliver();
  }

  /** Pinta los errores y lleva el foco al primer campo con error. */
  private validar(campos: (CampoEnvio | 'cancellationReason')[]): boolean {
    const invalido = campos.find((c) => this.fieldError(c));
    if (invalido) {
      queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('.dialogo [aria-invalid="true"]')?.focus());
    }
    return !invalido;
  }

  private run(accion: Accion, llamada: () => Observable<OrderActionResult>): void {
    if (this.busy()) return;
    this.ultima = accion;
    this.busy.set(accion);
    this.aviso.set(null);
    llamada().subscribe({
      next: () => {
        this.busy.set(null);
        this.dialog.set(null);
        this.notice.show(TEXTOS[accion].ok);
        this.load(true);
      },
      error: (error) => {
        this.busy.set(null);
        this.fallo(accion, error);
      },
    });
  }

  private fallo(accion: Accion, error: unknown): void {
    if (error instanceof OrderConflictError) {
      // El estado cambió en otro sitio: la acción ya no cabe, se cierra el diálogo y se vuelve a pedir el pedido.
      this.dialog.set(null);
      this.aviso.set({ texto: TEXTOS[accion].conflicto, sesion: false });
      this.load(true);
    } else if (error instanceof InvalidOrderInputError) {
      const porCampo: Record<string, string> = {};
      for (const d of error.details) porCampo[d.field] = d.message;
      this.serverErrors.set(porCampo);
      this.aviso.set({ texto: 'Revisa los datos marcados.', sesion: false });
      queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('.dialogo [aria-invalid="true"]')?.focus());
    } else if (error instanceof OrderSessionExpiredError) {
      this.aviso.set({ texto: 'Tu sesión terminó: vuelve a entrar.', sesion: true });
    } else if (error instanceof ForbiddenOrderError) {
      this.aviso.set({ texto: 'No tienes permiso para hacer esto.', sesion: false });
    } else if (error instanceof OrderNotFoundError) {
      this.aviso.set({ texto: 'No se encontró lo que buscas.', sesion: false });
    } else {
      this.aviso.set({ texto: GENERIC_ERROR, sesion: false });
    }
  }
}
