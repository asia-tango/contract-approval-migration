import { HttpErrorResponse } from '@angular/common/http';
import { FieldError } from '../models';
import { isTransient } from './submit-policy';

/** `/api/rates`: 404 (дата в майбутньому) або 400 (некоректна дата) — проблема в даті, а не в сервісі. */
export function isRatesDateError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);
}

/**
 * Помилка надсилання заявки. `unknown` — доля заявки невідома (таймаут, 0, 503);
 * `server` — заявку не створено (500 та інші відповіді).
 */
export type SubmitError =
  | { kind: 'unknown' | 'forbidden' | 'conflict' | 'server' }
  | { kind: 'validation'; errors: FieldError[] };

export function submitErrorOf(error: unknown): SubmitError {
  if (isTransient(error)) return { kind: 'unknown' };
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 403:
        return { kind: 'forbidden' };
      case 409:
        return { kind: 'conflict' };
      case 422:
        return { kind: 'validation', errors: error.error?.errors ?? [] };
    }
  }
  return { kind: 'server' };
}
