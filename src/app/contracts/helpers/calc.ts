import { Currency, Rates, Route } from '../models';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Сума з поля форми («1234,5» або «1234.5») → число; порожньо або не число → null. */
export function parseAmount(raw: string): number | null {
  const value = Number(raw.trim().replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) ? value : null;
}

/** Курс валюти; для UAH завжди 1, для інших — null, поки курсів немає. */
export function rateFor(currency: Currency, rates: Rates | null): number | null {
  return currency === 'UAH' ? 1 : (rates?.[currency] ?? null);
}

/** ПДВ, що міститься в сумі з ПДВ (20%): сума / 6. */
export function vatFor(amount: number): number {
  return round2(amount / 6);
}

export function amountUahFor(amount: number, rate: number): number {
  return round2(amount * rate);
}

/** Комітет — лише якщо еквівалент строго більший за ліміт. */
export function routeFor(amountUah: number, limit: number): Route {
  return amountUah > limit ? 'COMMITTEE' : 'STANDARD';
}

export interface ContractCalculation {
  /** null — сума не введена або не число. */
  amount: number | null;
  currency: Currency;
  /** null — договір без ПДВ або сума невідома. */
  vat: number | null;
  rate: number | null;
  /** null — немає суми або курсу. */
  amountUah: number | null;
  route: Route | null;
}

export function calculate(
  value: { amount: string; currency: Currency; vatPayer: boolean },
  rates: Rates | null,
  limit: number,
): ContractCalculation {
  const amount = parseAmount(value.amount);
  const rate = rateFor(value.currency, rates);
  const amountUah = amount !== null && rate !== null ? amountUahFor(amount, rate) : null;
  return {
    amount,
    currency: value.currency,
    vat: amount !== null && value.vatPayer ? vatFor(amount) : null,
    rate,
    amountUah,
    route: amountUah !== null ? routeFor(amountUah, limit) : null,
  };
}
