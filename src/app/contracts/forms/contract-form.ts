import { AbstractControl, FormControl, FormGroup, ValidatorFn } from '@angular/forms';
import { businessToday, toApiDate } from '../../shared/helpers/dates';
import { calculate } from '../helpers/calc';
import {
  amountError,
  commentError,
  counterpartyError,
  endDateError,
  FIELDS_WITH_SERVER_ERROR,
  requiredDateError,
  serverFieldError,
  signDateError,
} from '../helpers/validation';
import { ContractFormValue, Currency, Rates, ServerValidation } from '../models';

export type ContractForm = FormGroup<{
  counterparty: FormControl<string>;
  amount: FormControl<string>;
  currency: FormControl<Currency>;
  vatPayer: FormControl<boolean>;
  signDate: FormControl<Date | null>;
  startDate: FormControl<Date | null>;
  endDate: FormControl<Date | null>;
  comment: FormControl<string>;
}>;

/** Помилка поля — `{ message }`: текст показує `mat-error` під полем. */
function rule<T>(check: (value: T, form: ContractFormValue | null) => string | null): ValidatorFn {
  return (control: AbstractControl) => {
    const form = (control.parent?.getRawValue() as ContractFormValue | undefined) ?? null;
    const message = check(control.value as T, form);
    return message ? { message } : null;
  };
}

/** Помилка сервера (422) для поля, поки його значення таке саме, як надіслане. */
function serverRule(field: keyof ContractFormValue, server: () => ServerValidation | null): ValidatorFn {
  return (control: AbstractControl) => {
    const validation = server();
    const message = validation && serverFieldError(validation.errors, field, validation.sent[field], control.value);
    return message ? { message } : null;
  };
}

function apiDate(date: Date | null | undefined): string | null {
  return date ? toApiDate(date) : null;
}

/**
 * Форма картки. Правила — на самих контролах; ті, що залежать від інших полів (`endDate`, `comment`),
 * компонент перезапускає при зміні форми, а `comment` і `signDate` — ще й при зміні курсу.
 * @param rates курси на дату підписання або null (вантажиться / помилка — правило коментаря не застосовується)
 * @param noRatesForDate сервер курсів відповів 404 / 400 на дату підписання
 * @param serverValidation помилки 422 останнього надсилання або null. Окремо не перезапускаються: під час
 *   надсилання форма вимкнена, а `enable()` після відповіді перевіряє всі поля заново.
 */
export function createContractForm(
  rates: () => Rates | null,
  limit: number,
  noRatesForDate: () => boolean,
  serverValidation: () => ServerValidation | null,
): ContractForm {
  const form: ContractForm = new FormGroup({
    counterparty: new FormControl('', { nonNullable: true, validators: rule(counterpartyError) }),
    amount: new FormControl('', { nonNullable: true, validators: rule(amountError) }),
    currency: new FormControl<Currency>('UAH', { nonNullable: true }),
    vatPayer: new FormControl(false, { nonNullable: true }),
    signDate: new FormControl<Date | null>(null, {
      validators: rule<Date | null>((date) => signDateError(apiDate(date), businessToday(), noRatesForDate())),
    }),
    startDate: new FormControl<Date | null>(null, {
      validators: rule<Date | null>((date) => requiredDateError(apiDate(date))),
    }),
    endDate: new FormControl<Date | null>(null, {
      validators: rule<Date | null>((date, form) => endDateError(apiDate(form?.startDate), apiDate(date))),
    }),
    comment: new FormControl('', {
      nonNullable: true,
      validators: rule<string>((comment, form) =>
        commentError(comment, form ? calculate(form, rates(), limit).route : null),
      ),
    }),
  });
  for (const field of FIELDS_WITH_SERVER_ERROR) {
    form.controls[field].addValidators(serverRule(field, serverValidation));
  }
  return form;
}
