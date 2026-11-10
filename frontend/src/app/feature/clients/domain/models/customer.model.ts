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
