export type ContractStatus = 'DRAFT' | 'ON_APPROVAL' | 'APPROVED' | 'REJECTED';
export type Currency = 'UAH' | 'USD' | 'EUR';

export interface Me {
  login: string;
  roles: string[];
}

/** Рядок реєстру (`GET /api/contracts`). */
export interface ContractListItem {
  id: number;
  number: string;
  counterparty: string;
  amount: number;
  currency: Currency;
  status: ContractStatus;
}

export interface ContractPage {
  total: number;
  items: ContractListItem[];
}

/** Фільтри реєстру. `status: ''` — усі статуси; `page` — з 1, як в API. */
export interface ListFilters {
  status: ContractStatus | '';
  q: string;
  page: number;
}

/** Договір (`GET /api/contracts/{id}`). Дати — рядки `yyyy-MM-dd`. */
export interface Contract {
  id: number;
  number: string;
  counterparty: string;
  amount: number;
  currency: Currency;
  vatPayer: boolean;
  signDate: string;
  startDate: string;
  endDate: string;
  comment: string | null;
  status: ContractStatus;
  version: number;
  lastApprovalRequestId: number | null;
}
