import { HttpErrorResponse } from '@angular/common/http';

/** `/api/rates`: 404 (дата в майбутньому) або 400 (некоректна дата) — проблема в даті, а не в сервісі. */
export function isRatesDateError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);
}
