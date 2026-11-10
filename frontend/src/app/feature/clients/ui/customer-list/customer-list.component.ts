import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { loginUrl } from '../../../../@core/guards/auth.guard';
import { ListCustomersUseCase, ListProvincesUseCase } from '../../application/customer.use-cases';
import {
  CustomerSessionExpiredError,
  InvalidCustomerInputError,
} from '../../domain/errors/customer.errors';
import {
  CUSTOMERS_PAGE_SIZE,
  CustomerFilters,
  CustomerListItem,
  Province,
} from '../../domain/models/customer.model';

export type ListState = 'loading' | 'data' | 'empty' | 'error' | 'invalid' | 'session';

const STATUS_LABELS: Record<string, string> = { active: 'Activo', inactive: 'Inactivo' };

@Component({
  selector: 'app-customer-list',
  imports: [RouterLink],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.css',
})
export class CustomerListComponent implements OnInit {
  private readonly listCustomers = inject(ListCustomersUseCase);
  private readonly listProvinces = inject(ListProvincesUseCase);

  private readonly loadState = signal<ListState>('loading');
  private readonly sessionExpired = signal(false);
  /** Un 401 en cualquiera de las dos cargas manda sobre el resto de estados. */
  protected readonly state = computed<ListState>(() => (this.sessionExpired() ? 'session' : this.loadState()));
  protected readonly customers = signal<CustomerListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly provinces = signal<Province[]>([]);
  protected readonly provincesFailed = signal(false);
  protected readonly filters = signal<CustomerFilters>({ name: '', provinceId: '', status: '' });

  protected readonly pageSize = CUSTOMERS_PAGE_SIZE;
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  protected readonly loginHref = loginUrl('/clientes');

  ngOnInit(): void {
    // Una vez, al entrar: las dos cargas a la vez.
    this.loadProvinces();
    this.loadCustomers();
  }

  protected loadProvinces(): void {
    this.provincesFailed.set(false);
    this.listProvinces.execute().subscribe({
      next: (provinces) => this.provinces.set(provinces),
      error: (error) => {
        this.provincesFailed.set(true);
        if (error instanceof CustomerSessionExpiredError) this.sessionExpired.set(true);
      },
    });
  }

  protected loadCustomers(): void {
    this.loadState.set('loading');
    this.listCustomers.execute(this.filters(), this.page(), this.pageSize).subscribe({
      next: (result) => {
        this.customers.set(result.items);
        this.total.set(result.total);
        this.loadState.set(result.items.length === 0 ? 'empty' : 'data');
      },
      error: (error) => {
        if (error instanceof InvalidCustomerInputError) this.loadState.set('invalid');
        else if (error instanceof CustomerSessionExpiredError) this.sessionExpired.set(true);
        else this.loadState.set('error');
      },
    });
  }

  protected setFilter(key: keyof CustomerFilters, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.page.set(1);
    this.loadCustomers();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.loadCustomers();
  }

  protected statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }
}
