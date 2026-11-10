import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { loginUrl } from '../../../../@core/guards/auth.guard';
import { NoticeService } from '../../../../@core/services/notice.service';
import { DeleteCustomerUseCase, GetCustomerUseCase } from '../../application/customer.use-cases';
import {
  CustomerInUseError,
  CustomerNotFoundError,
  CustomerSessionExpiredError,
  InvalidCustomerInputError,
} from '../../domain/errors/customer.errors';
import { CustomerDetail } from '../../domain/models/customer.model';

export type DetailState = 'loading' | 'data' | 'empty' | 'error' | 'invalid' | 'session' | 'notfound';

const STATUS_LABELS: Record<string, string> = { active: 'Activo', inactive: 'Inactivo' };
const GENERIC_ERROR = 'No se pudo cargar. Vuelve a intentarlo.';

@Component({
  selector: 'app-customer-detail',
  imports: [RouterLink],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.css',
})
export class CustomerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notice = inject(NoticeService);
  private readonly getCustomer = inject(GetCustomerUseCase);
  private readonly deleteCustomer = inject(DeleteCustomerUseCase);

  /** El `:id` de la ruta; es el valor de partida del campo «ID». */
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly state = signal<DetailState>('loading');
  protected readonly customer = signal<CustomerDetail | null>(null);
  protected readonly dialogOpen = signal(false);
  protected readonly deleting = signal(false);
  /** Aviso de la última eliminación fallida (el diálogo sigue abierto para reintentar). */
  protected readonly deleteError = signal<string | null>(null);
  protected readonly deleteSession = signal(false);
  protected readonly loginHref = loginUrl(`/clientes/${this.id}`);
  protected readonly statusLabel = computed(() => {
    const status = this.customer()?.status ?? '';
    return STATUS_LABELS[status] ?? status;
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    // Una vez, al entrar (sin caché): se pide al servidor.
    this.getCustomer.execute(this.id).subscribe({
      next: (customer) => {
        this.customer.set(customer);
        this.state.set(customer?.id ? 'data' : 'empty');
      },
      error: (error) => {
        if (error instanceof InvalidCustomerInputError) this.state.set('invalid');
        else if (error instanceof CustomerSessionExpiredError) this.state.set('session');
        else if (error instanceof CustomerNotFoundError) this.state.set('notfound');
        else this.state.set('error');
      },
    });
  }

  protected openDialog(): void {
    this.deleteError.set(null);
    this.deleteSession.set(false);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
  }

  protected confirmDelete(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.deleteSession.set(false);
    this.deleteCustomer.execute(this.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.dialogOpen.set(false);
        this.notice.show('Cliente eliminado.');
        void this.router.navigate(['/clientes']);
      },
      error: (error) => {
        this.deleting.set(false);
        if (error instanceof CustomerSessionExpiredError) this.deleteSession.set(true);
        this.deleteError.set(this.deleteMessage(error));
      },
    });
  }

  private deleteMessage(error: unknown): string {
    if (error instanceof InvalidCustomerInputError) return 'Revisa los datos marcados.';
    if (error instanceof CustomerSessionExpiredError) return 'Tu sesión terminó: vuelve a entrar.';
    if (error instanceof CustomerNotFoundError) return 'No se encontró lo que buscas.';
    if (error instanceof CustomerInUseError) return 'Otro dato lo cita.';
    return GENERIC_ERROR;
  }
}
