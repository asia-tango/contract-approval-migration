import { COMMITTEE_LIMIT_UAH } from '../committee-config';
import { ContractData, ContractFormValue, Rates } from '../models';
import { toApprovalPayload, toFormValue } from './contract-mapper';

const RATES: Rates = { UAH: 1, USD: 41.2, EUR: 44.9 };

const DATA: ContractData = {
  counterparty: 'ТОВ «Альфа»',
  amount: 100,
  currency: 'UAH',
  vatPayer: true,
  signDate: '2026-10-01',
  startDate: '2026-10-02',
  endDate: '2026-10-03',
  comment: null,
};

function formValue(amount: string, extra: Partial<ContractFormValue> = {}): ContractFormValue {
  return { ...toFormValue(DATA), amount, protocolNumber: ' ПЗ-2026/014 ', ...extra };
}

function dataOf(value: ContractFormValue) {
  return toApprovalPayload(value, 1, RATES, COMMITTEE_LIMIT_UAH)!.data;
}

describe('contract-mapper: номер протоколу', () => {
  it('COMMITTEE (строго більше ліміту) — обрізаний номер у data', () => {
    expect(dataOf(formValue('1000000,01')).protocolNumber).toBe('ПЗ-2026/014');
  });

  it('COMMITTEE за еквівалентом: 23 000 EUR — менше ліміту номінально, але більше у гривнях', () => {
    expect(dataOf(formValue('23000', { currency: 'EUR' })).protocolNumber).toBe('ПЗ-2026/014');
  });

  it('рівно ліміт і менше — ключа в data немає, навіть якщо у формі лишилось значення', () => {
    expect(dataOf(formValue('1000000'))).not.toHaveProperty('protocolNumber');
    expect(dataOf(formValue('999999,99'))).not.toHaveProperty('protocolNumber');
  });

  it('toFormValue: номер із даних або порожньо', () => {
    expect(toFormValue(DATA).protocolNumber).toBe('');
    expect(toFormValue({ ...DATA, protocolNumber: 'ПЗ-2026/014' }).protocolNumber).toBe('ПЗ-2026/014');
  });
});
