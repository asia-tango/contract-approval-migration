import { Route } from '../models';
import { parseAmount } from './calc';

/** Тексти — як у сервера (мок), крім порожньої дати. */
export const VALIDATION_MESSAGES = {
  counterparty: 'Вкажіть контрагента',
  amountPositive: 'Сума має бути більшою за 0',
  amountFormat: 'Не більше 2 знаків після коми',
  dateRequired: 'Оберіть дату',
  signDateFuture: 'Дата підписання не може бути в майбутньому',
  signDateNoRates: 'Немає курсу НБУ на цю дату',
  endBeforeStart: 'Дата закінчення раніше дати початку',
  commentForCommittee: 'Для комітету потрібне обґрунтування (від 20 символів)',
};

export const COMMITTEE_COMMENT_MIN_LENGTH = 20;
const AMOUNT_PATTERN = /^\d+([.,]\d{1,2})?$/;

export function counterpartyError(counterparty: string): string | null {
  return counterparty.trim() ? null : VALIDATION_MESSAGES.counterparty;
}

export function amountError(raw: string): string | null {
  const value = parseAmount(raw);
  if (value === null || value <= 0) {
    return VALIDATION_MESSAGES.amountPositive;
  }
  return AMOUNT_PATTERN.test(raw.trim()) ? null : VALIDATION_MESSAGES.amountFormat;
}

/** Дати — рядки `yyyy-MM-dd`, порівняння рядками. */
export function requiredDateError(date: string | null): string | null {
  return date ? null : VALIDATION_MESSAGES.dateRequired;
}

/** `noRatesForDate` — сервер курсів відповів 404 / 400 на цю дату. */
export function signDateError(signDate: string | null, today: string, noRatesForDate: boolean): string | null {
  if (!signDate) return VALIDATION_MESSAGES.dateRequired;
  if (signDate > today) return VALIDATION_MESSAGES.signDateFuture;
  return noRatesForDate ? VALIDATION_MESSAGES.signDateNoRates : null;
}

export function endDateError(startDate: string | null, endDate: string | null): string | null {
  if (!endDate) return VALIDATION_MESSAGES.dateRequired;
  return startDate && endDate < startDate ? VALIDATION_MESSAGES.endBeforeStart : null;
}

/** Маршрут невідомий (немає суми або курсу) — правило не застосовується. */
export function commentError(comment: string, route: Route | null): string | null {
  return route === 'COMMITTEE' && comment.trim().length < COMMITTEE_COMMENT_MIN_LENGTH
    ? VALIDATION_MESSAGES.commentForCommittee
    : null;
}
