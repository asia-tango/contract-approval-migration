export type ContractStatus = 'DRAFT' | 'ON_APPROVAL' | 'APPROVED' | 'REJECTED';
export type Currency = 'UAH' | 'USD' | 'EUR';
export type Route = 'STANDARD' | 'COMMITTEE';

/** Курси НБУ на дату (`GET /api/rates`). */
export type Rates = Record<Currency, number>;

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

/** Редаговані дані договору (ті самі поля, що в `data` заявки). Дати — рядки `yyyy-MM-dd`. */
export interface ContractData {
  counterparty: string;
  amount: number;
  currency: Currency;
  vatPayer: boolean;
  signDate: string;
  startDate: string;
  endDate: string;
  comment: string | null;
  /** Номер протоколу комітету: лише для маршруту COMMITTEE. GET його не повертає. */
  protocolNumber?: string;
}

/** Договір (`GET /api/contracts/{id}`). */
export interface Contract extends ContractData {
  id: number;
  number: string;
  status: ContractStatus;
  version: number;
  lastApprovalRequestId: number | null;
}

/** Значення форми картки: сума — текстом, як введено; дати — з календаря. */
export interface ContractFormValue {
  counterparty: string;
  amount: string;
  currency: Currency;
  vatPayer: boolean;
  signDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  comment: string;
  protocolNumber: string;
}

/** Помилка серверної валідації (422). `field` — поле `data` або `route`. */
export interface FieldError {
  field: string;
  message: string;
}

/** Помилки 422 разом зі значенням форми, яке було надіслано. */
export interface ServerValidation {
  errors: FieldError[];
  sent: ContractFormValue;
}

/** Тіло заявки без `requestId`: його генеруємо окремо, один раз на спробу. */
export interface ApprovalPayload {
  version: number;
  route: Route;
  data: ContractData;
}

/**
 * Заявка на надсилання: requestId і payload створюються один раз і не змінюються при повторі.
 * У такому самому вигляді зберігається в sessionStorage для відновлення після перезавантаження.
 */
export interface SubmissionAttempt {
  contractId: number;
  requestId: string;
  payload: ApprovalPayload;
}

/** `201` на `POST /api/contracts/{id}/approval-requests`. */
export interface ApprovalCreated {
  approvalRequestId: number;
  status: 'PENDING';
}

/** Заявка на погодження (`GET /api/approval-requests/{id}`). `reason` — лише для REJECTED. */
export interface ApprovalRequest {
  id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string | null;
}
