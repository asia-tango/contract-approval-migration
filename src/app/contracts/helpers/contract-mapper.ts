import { parseApiDate, toApiDate } from '../../shared/helpers/dates';
import { ApprovalPayload, ContractData, ContractFormValue, Rates } from '../models';
import { calculate } from './calc';

/** Дані договору → значення форми. */
export function toFormValue(data: ContractData): ContractFormValue {
  return {
    counterparty: data.counterparty,
    amount: String(data.amount),
    currency: data.currency,
    vatPayer: data.vatPayer,
    signDate: parseApiDate(data.signDate),
    startDate: parseApiDate(data.startDate),
    endDate: parseApiDate(data.endDate),
    comment: data.comment ?? '',
  };
}

/** Значення форми + курси на дату підписання → payload заявки з маршрутом. null — бракує суми, дат або курсу. */
export function toApprovalPayload(
  value: ContractFormValue,
  version: number,
  rates: Rates | null,
  limit: number,
): ApprovalPayload | null {
  const { amount, route } = calculate(value, rates, limit);
  const { signDate, startDate, endDate } = value;
  if (amount === null || route === null || !signDate || !startDate || !endDate) return null;
  return {
    version,
    route,
    data: {
      counterparty: value.counterparty,
      amount,
      currency: value.currency,
      vatPayer: value.vatPayer,
      signDate: toApiDate(signDate),
      startDate: toApiDate(startDate),
      endDate: toApiDate(endDate),
      comment: value.comment,
    },
  };
}
