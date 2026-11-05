import { COMMITTEE_LIMIT_UAH } from '../committee-config';
import { VALIDATION_MESSAGES } from '../helpers/validation';
import { Rates } from '../models';
import { ContractForm, createContractForm } from './contract-form';

const RATES: Rates = { UAH: 1, USD: 41.2, EUR: 44.9 };

describe('createContractForm: номер протоколу', () => {
  let rates: Rates | null;
  let form: ContractForm;

  /** Те, що робить компонент: при зміні значення або курсу перезапускає правило. */
  function protocolError(): unknown {
    const { protocolNumber } = form.controls;
    protocolNumber.updateValueAndValidity();
    return protocolNumber.errors?.['message'] ?? null;
  }

  beforeEach(() => {
    rates = RATES;
    form = createContractForm(
      () => rates,
      COMMITTEE_LIMIT_UAH,
      () => false,
      () => null,
    );
  });

  it('обов\'язковий лише понад ліміт; рівно ліміт — ні', () => {
    form.controls.amount.setValue('1000000,01');
    expect(protocolError()).toBe(VALIDATION_MESSAGES.protocolRequired);
    form.controls.amount.setValue('1000000');
    expect(protocolError()).toBeNull();
  });

  it('значення лишається у формі, коли правило не діє, і не блокує її', () => {
    form.controls.protocolNumber.setValue('неправильний');
    form.controls.amount.setValue('2000000');
    expect(protocolError()).toBe(VALIDATION_MESSAGES.protocolFormat);
    form.controls.amount.setValue('100');
    expect(protocolError()).toBeNull();
    expect(form.controls.protocolNumber.value).toBe('неправильний');
  });

  it('курс невідомий — правило не діє; курс прийшов — діє', () => {
    form.controls.currency.setValue('EUR');
    form.controls.amount.setValue('23000');
    rates = null;
    expect(protocolError()).toBeNull();
    rates = RATES;
    expect(protocolError()).toBe(VALIDATION_MESSAGES.protocolRequired);
  });
});
