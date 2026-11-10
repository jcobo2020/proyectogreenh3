import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { loginUrl } from '../../../../@core/guards/auth.guard';
import { lacksPermission } from '../../../../@core/guards/permissions';
import { NoticeService } from '../../../../@core/services/notice.service';
import { CreateOrderUseCase, ListCustomerOptionsUseCase } from '../../application/order.use-cases';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderBusinessRuleError,
  OrderSessionExpiredError,
} from '../../domain/errors/order.errors';
import { CustomerOption, NewOrder, ORDERS_MANAGE_PERMISSION } from '../../domain/models/order.model';

type Campo = 'customerId' | 'date' | 'amount';

const ORDEN: Campo[] = ['customerId', 'date', 'amount'];
const GENERIC_ERROR = 'No se pudo cargar. Vuelve a intentarlo.';
const MIN_AMOUNT = 0.01;

/** Aviso de un fallo: su texto y si pide volver a entrar. */
interface Aviso {
  texto: string;
  sesion: boolean;
}

/** Aviso de una carga (opciones de «Cliente»). */
function avisoCarga(error: unknown): Aviso {
  if (error instanceof InvalidOrderInputError) return { texto: 'Revisa los datos marcados.', sesion: false };
  if (error instanceof OrderSessionExpiredError) return { texto: 'Tu sesión terminó: vuelve a entrar.', sesion: true };
  if (error instanceof ForbiddenOrderError) return { texto: 'No tienes permiso para ver esto.', sesion: false };
  return { texto: GENERIC_ERROR, sesion: false };
}

/** Aviso de «Crear pedido». */
function avisoEnvio(error: unknown): Aviso {
  if (error instanceof InvalidOrderInputError) return { texto: 'Revisa los datos marcados.', sesion: false };
  if (error instanceof OrderSessionExpiredError) return { texto: 'Tu sesión terminó: vuelve a entrar.', sesion: true };
  if (error instanceof ForbiddenOrderError) return { texto: 'No tienes permiso para hacer esto.', sesion: false };
  if (error instanceof OrderBusinessRuleError) return { texto: 'No se pudo por una regla del negocio.', sesion: false };
  return { texto: GENERIC_ERROR, sesion: false };
}

@Component({
  selector: 'app-order-create',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './order-create.component.html',
  styleUrl: './order-create.component.css',
})
export class OrderCreateComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notice = inject(NoticeService);
  private readonly listCustomers = inject(ListCustomerOptionsUseCase);
  private readonly createOrder = inject(CreateOrderUseCase);
  /** Idempotency-Key del intento de envío en curso, con el cuerpo al que pertenece. */
  private intento: { key: string; cuerpo: string } | null = null;

  protected readonly form = new FormGroup({
    customerId: new FormControl('', { nonNullable: true }),
    date: new FormControl('', { nonNullable: true }),
    amount: new FormControl<string | number | null>(null),
  });

  protected readonly customers = signal<CustomerOption[]>([]);
  protected readonly loadingCustomers = signal(true);
  protected readonly customersError = signal<Aviso | null>(null);
  /** La sesión declara sus permisos y falta «pedidos.gestionar». */
  protected readonly noAccess = signal(false);
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);
  protected readonly submitError = signal<Aviso | null>(null);
  protected readonly loginHref = loginUrl('/pedidos/nuevo');

  ngOnInit(): void {
    // Sin el permiso en la sesión no se ofrece la pantalla: no se llama a la API.
    if (lacksPermission(ORDERS_MANAGE_PERMISSION)) {
      this.noAccess.set(true);
      this.loadingCustomers.set(false);
      return;
    }
    this.loadCustomers();
  }

  /** «Crear pedido» no se pulsa mientras falle la carga de clientes, ni mientras envía. */
  protected get blocked(): boolean {
    return this.sending() || this.loadingCustomers() || !!this.customersError();
  }

  protected loadCustomers(): void {
    this.loadingCustomers.set(true);
    this.customersError.set(null);
    // Una vez, al entrar (sin caché): se pide al servidor.
    this.listCustomers.execute().subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.loadingCustomers.set(false);
      },
      error: (error) => {
        this.loadingCustomers.set(false);
        this.customersError.set(avisoCarga(error));
      },
    });
  }

  /** Mensaje de validación del campo (literal de la spec), solo tras intentar enviar. */
  protected fieldError(campo: Campo): string | null {
    if (!this.submitted()) return null;
    // El input numérico entrega number (o null si está vacío): se normaliza a texto.
    const valor = String(this.form.getRawValue()[campo] ?? '').trim();
    if (campo === 'customerId') return valor === '' ? 'Cliente es obligatorio.' : null;
    if (campo === 'date') return valor === '' ? 'Fecha es obligatoria.' : null;
    if (valor === '') return 'Importe es obligatorio.';
    const numero = Number(valor);
    return Number.isNaN(numero) || numero < MIN_AMOUNT ? 'Importe tiene que ser mayor que 0.' : null;
  }

  protected submit(): void {
    if (this.blocked) return;
    this.submitted.set(true);
    this.submitError.set(null);
    const invalido = ORDEN.find((campo) => this.fieldError(campo));
    if (invalido) {
      // Pinta los errores y lleva el foco al primer campo con error.
      queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const valores = this.form.getRawValue();
    const cuerpo: NewOrder = {
      customerId: valores.customerId,
      date: valores.date,
      amount: Number(valores.amount),
    };
    const json = JSON.stringify(cuerpo);
    // Misma clave al reintentar el mismo envío; nueva si cambia lo escrito.
    if (!this.intento || this.intento.cuerpo !== json) this.intento = { key: crypto.randomUUID(), cuerpo: json };
    this.sending.set(true);
    this.createOrder.execute(cuerpo, this.intento.key).subscribe({
      next: (creado) => {
        this.sending.set(false);
        this.intento = null;
        this.notice.show('Pedido creado.');
        void this.router.navigate(['/pedidos', creado.id]);
      },
      error: (error) => {
        this.sending.set(false);
        this.submitError.set(avisoEnvio(error));
      },
    });
  }
}
