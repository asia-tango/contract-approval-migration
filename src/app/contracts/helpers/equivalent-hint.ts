import { formatApiDate } from '../../shared/helpers/dates';
import { formatMoney } from '../../shared/helpers/money-format';
import { ContractCalculation } from './calc';

/**
 * Пояснення еквівалента для ⓘ:
 * «23 000,00 EUR × 44,90 (курс НБУ на 01.10.2026) = 1 032 700,00 грн. Поріг тендерного комітету — 1 000 000 грн».
 * Для UAH — лише поріг. Еквівалент невідомий — null (іконку не показуємо).
 */
export function equivalentHint(calc: ContractCalculation, rateDate: string | null, limit: number): string | null {
  if (calc.amount === null || calc.rate === null || calc.amountUah === null) return null;
  const threshold = `Поріг тендерного комітету — ${formatMoney(limit, 0)} грн`;
  if (calc.currency === 'UAH' || rateDate === null) return threshold;
  return (
    `${formatMoney(calc.amount)} ${calc.currency} × ${formatMoney(calc.rate)} ` +
    `(курс НБУ на ${formatApiDate(rateDate)}) = ${formatMoney(calc.amountUah)} грн. ${threshold}`
  );
}
