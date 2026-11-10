/** Fila de GET /api/orders. */
export interface OrderListItem {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  status: string;
}

export interface OrderFilters {
  customerId: string;
  status: string;
}

export interface OrderPage {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Cuerpo de POST /api/orders. */
export interface NewOrder {
  customerId: string;
  date: string;
  amount: number;
}

/** Respuesta 201 de POST /api/orders. */
export interface CreatedOrder {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  status: string;
}

/** Opción del select «Cliente»: id y name de GET /api/customers. */
export interface CustomerOption {
  id: string;
  name: string;
}

export const ORDERS_PAGE_SIZE = 20;
/** Máximo que admite pageSize en GET /api/customers. */
export const CUSTOMER_OPTIONS_PAGE_SIZE = 100;

export const ORDER_STATUSES: readonly { value: string; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'cancelled', label: 'Cancelado' },
];

/** Permiso que exige POST /api/orders. */
export const ORDERS_MANAGE_PERMISSION = 'pedidos.gestionar';

/** Permiso que exige GET /api/orders. */
export const ORDERS_VIEW_PERMISSION = 'pedidos.consultar';
