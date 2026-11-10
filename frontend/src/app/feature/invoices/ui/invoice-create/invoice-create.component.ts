import { Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { loginUrl } from '../../../../@core/guards/auth.guard';
import { NoticeService } from '../../../../@core/services/notice.service';
import { CreateInvoiceUseCase, SearchCustomerOptionsUseCase } from '../../application/invoice.use-cases';
import {
  InvalidInvoiceInputError,
  InvoiceBusinessRuleError,
  InvoiceSessionExpiredError,
} from '../../domain/errors/invoice.errors';
import { CUSTOMER_SEARCH_MIN_LENGTH, CustomerOption, NewInvoice } from '../../domain/models/invoice.model';

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
  if (error instanceof InvalidInvoiceInputError) return { texto: 'Revisa los datos marcados.', sesion: false };
  if (error instanceof InvoiceSessionExpiredError) return { texto: 'Tu sesión terminó: vuelve a entrar.', sesion: true };
  return { texto: GENERIC_ERROR, sesion: false };
}

/** Aviso de «Crear factura». */
function avisoEnvio(error: unknown): Aviso {
  if (error instanceof InvalidInvoiceInputError) return { texto: 'Revisa los datos marcados.', sesion: false };
  if (error instanceof InvoiceSessionExpiredError) return { texto: 'Tu sesión terminó: vuelve a entrar.', sesion: true };
  if (error instanceof InvoiceBusinessRuleError) return { texto: 'No se pudo por una regla del negocio.', sesion: false };
  return { texto: GENERIC_ERROR, sesion: false };
}

/** Hoy como YYYY-MM-DD en hora local. */
function hoy(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

@Component({
  selector: 'app-invoice-create',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './invoice-create.component.html',
  styleUrl: './invoice-create.component.css',
})
export class InvoiceCreateComponent {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notice = inject(NoticeService);
  private readonly searchCustomers = inject(SearchCustomerOptionsUseCase);
  private readonly createInvoice = inject(CreateInvoiceUseCase);
  /** Idempotency-Key del intento de envío en curso, con el cuerpo al que pertenece. */
  private intento: { key: string; cuerpo: string } | null = null;
  private busqueda: Subscription | null = null;
  private ultimaBusqueda = '';

  protected readonly today = hoy();

  protected readonly form = new FormGroup({
    customerId: new FormControl('', { nonNullable: true }),
    date: new FormControl('', { nonNullable: true }),
    amount: new FormControl<string | number | null>(null),
  });

  protected readonly found = signal<CustomerOption[]>([]);
  /** El cliente elegido se conserva entre las opciones aunque la siguiente búsqueda no lo traiga. */
  private readonly chosen = signal<CustomerOption | null>(null);
  protected readonly customers = computed(() => {
    const elegido = this.chosen();
    const lista = this.found();
    return elegido && !lista.some((c) => c.id === elegido.id) ? [elegido, ...lista] : lista;
  });
  protected readonly loadingCustomers = signal(false);
  protected readonly customersError = signal<Aviso | null>(null);
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);
  protected readonly submitError = signal<Aviso | null>(null);
  protected readonly loginHref = loginUrl('/facturas/nueva');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.busqueda?.unsubscribe());
  }

  /** «Crear factura» no se pulsa mientras falle la carga de clientes, ni mientras envía. */
  protected get blocked(): boolean {
    return this.sending() || !!this.customersError();
  }

  /** Al escribir en «Cliente»: desde 2 letras pide GET /api/customers?name=<lo escrito>. */
  protected onSearch(event: Event): void {
    this.search((event.target as HTMLInputElement).value);
  }

  protected retrySearch(): void {
    this.search(this.ultimaBusqueda);
  }

  protected onCustomerChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.chosen.set(this.customers().find((c) => c.id === id) ?? null);
  }

  private search(texto: string): void {
    const nombre = texto.trim();
    this.ultimaBusqueda = nombre;
    this.busqueda?.unsubscribe();
    this.customersError.set(null);
    if (nombre.length < CUSTOMER_SEARCH_MIN_LENGTH) {
      this.found.set([]);
      this.loadingCustomers.set(false);
      return;
    }
    this.loadingCustomers.set(true);
    this.busqueda = this.searchCustomers.execute(nombre).subscribe({
      next: (customers) => {
        this.found.set(customers);
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
    if (campo === 'date') {
      if (valor === '') return 'Fecha es obligatoria.';
      return valor > this.today ? 'Fecha no puede ser futura.' : null;
    }
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
    const cuerpo: NewInvoice = {
      customerId: valores.customerId,
      date: valores.date,
      amount: Number(valores.amount),
    };
    const json = JSON.stringify(cuerpo);
    // Misma clave al reintentar el mismo envío; nueva si cambia lo escrito.
    if (!this.intento || this.intento.cuerpo !== json) this.intento = { key: crypto.randomUUID(), cuerpo: json };
    this.sending.set(true);
    this.createInvoice.execute(cuerpo, this.intento.key).subscribe({
      next: () => {
        this.sending.set(false);
        this.intento = null;
        this.notice.show('Factura creada.');
        void this.router.navigate(['/facturas']);
      },
      error: (error) => {
        this.sending.set(false);
        this.submitError.set(avisoEnvio(error));
      },
    });
  }
}
