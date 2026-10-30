import { parseApiDate } from '../../shared/helpers/dates';
import { ContractData, ContractFormValue } from '../models';

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
