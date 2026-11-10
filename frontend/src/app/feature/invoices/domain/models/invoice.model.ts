/** Cuerpo de POST /api/invoices. */
export interface NewInvoice {
  customerId: string;
  date: string;
  amount: number;
}

/** Respuesta 201 de POST /api/invoices. */
export interface CreatedInvoice {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  number: string;
  customerName: string;
}

/** Opción del select «Cliente»: id y name de GET /api/customers. */
export interface CustomerOption {
  id: string;
  name: string;
}

/** Letras mínimas escritas para buscar clientes. */
export const CUSTOMER_SEARCH_MIN_LENGTH = 2;
