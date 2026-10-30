import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

/** Клієнтський таймаут однієї спроби надсилання, як у легасі. */
export const SUBMIT_TIMEOUT_MS = 5000;

/**
 * Доля заявки невідома: таймаут, немає з'єднання (0) або 503. Повтор з тим самим requestId безпечний.
 * 500 сюди не входить: за контрактом API заявку точно не створено.
 */
export function isTransient(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status === 503);
}
