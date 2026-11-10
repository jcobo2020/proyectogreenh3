export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  provinceId: string;
  provinceName: string;
  townId: string;
  townName: string;
  status: string;
}

/** Cliente completo, como lo devuelve GET /api/customers/:id. */
export interface CustomerDetail extends CustomerListItem {
  streetAddress: string;
  version: number;
}

export interface CustomerFilters {
  name: string;
  provinceId: string;
  status: string;
}

export interface CustomerPage {
  items: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Province {
  id: string;
  code: string;
  name: string;
}

export const CUSTOMERS_PAGE_SIZE = 20;

export interface Town {
  id: string;
  provinceId: string;
  name: string;
}

/** Cuerpo de POST /api/customers. */
export interface NewCustomer {
  name: string;
  email: string;
  provinceId: string;
  townId: string;
  status: string;
  streetAddress: string;
}
