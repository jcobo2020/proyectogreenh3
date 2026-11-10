import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { loginUrl } from '../../../../@core/guards/auth.guard';
import { lacksPermission } from '../../../../@core/guards/permissions';
import { ListCustomerOptionsUseCase, ListOrdersUseCase } from '../../application/order.use-cases';
import {
  ForbiddenOrderError,
  InvalidOrderInputError,
  OrderSessionExpiredError,
} from '../../domain/errors/order.errors';
import {
  CustomerOption,
  ORDERS_PAGE_SIZE,
  ORDERS_VIEW_PERMISSION,
  ORDER_STATUSES,
  OrderFilters,
  OrderListItem,
} from '../../domain/models/order.model';

export type ListState = 'loading' | 'data' | 'empty' | 'error' | 'invalid' | 'session' | 'forbidden' | 'noAccess';

@Component({
  selector: 'app-order-list',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.css',
})
export class OrderListComponent implements OnInit {
  private readonly listOrders = inject(ListOrdersUseCase);
  private readonly listCustomers = inject(ListCustomerOptionsUseCase);

  private readonly loadState = signal<ListState>('loading');
  private readonly sessionExpired = signal(false);
  /** Un 401 en cualquiera de las dos cargas manda sobre el resto de estados. */
  protected readonly state = computed<ListState>(() => (this.sessionExpired() ? 'session' : this.loadState()));
  protected readonly orders = signal<OrderListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly customers = signal<CustomerOption[]>([]);
  protected readonly customersFailed = signal(false);
  protected readonly filters = signal<OrderFilters>({ customerId: '', status: '' });

  protected readonly statuses = ORDER_STATUSES;
  protected readonly pageSize = ORDERS_PAGE_SIZE;
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  protected readonly loginHref = loginUrl('/pedidos');

  ngOnInit(): void {
    // Sin el permiso en la sesión, el botón que llama a la API no se ofrece: no se llama.
    if (lacksPermission(ORDERS_VIEW_PERMISSION)) {
      this.loadState.set('noAccess');
      return;
    }
    // Una vez, al entrar: las dos cargas a la vez.
    this.loadCustomers();
    this.loadOrders();
  }

  protected loadCustomers(): void {
    this.customersFailed.set(false);
    this.listCustomers.execute().subscribe({
      next: (customers) => this.customers.set(customers),
      error: (error) => {
        this.customersFailed.set(true);
        if (error instanceof OrderSessionExpiredError) this.sessionExpired.set(true);
      },
    });
  }

  protected loadOrders(): void {
    this.loadState.set('loading');
    this.listOrders.execute(this.filters(), this.page(), this.pageSize).subscribe({
      next: (result) => {
        this.orders.set(result.items);
        this.total.set(result.total);
        this.loadState.set(result.items.length === 0 ? 'empty' : 'data');
      },
      error: (error) => {
        if (error instanceof InvalidOrderInputError) this.loadState.set('invalid');
        else if (error instanceof OrderSessionExpiredError) this.sessionExpired.set(true);
        else if (error instanceof ForbiddenOrderError) this.loadState.set('forbidden');
        else this.loadState.set('error');
      },
    });
  }

  protected setFilter(key: keyof OrderFilters, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.page.set(1);
    this.loadOrders();
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    this.loadOrders();
  }

  protected statusLabel(status: string): string {
    return this.statuses.find((s) => s.value === status)?.label ?? status;
  }
}
