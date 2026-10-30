import { Injectable } from '@angular/core';
import { SubmissionAttempt } from '../models';

const KEY_PREFIX = 'contract-approval:pending-submission:';

/**
 * Незавершене надсилання в sessionStorage: окремий запис на кожен договір,
 * щоб спроба одного договору не затерла спробу іншого.
 */
@Injectable({ providedIn: 'root' })
export class PendingSubmissionStorage {
  save(attempt: SubmissionAttempt): void {
    sessionStorage.setItem(KEY_PREFIX + attempt.contractId, JSON.stringify(attempt));
  }

  /** null — запису немає або його не вдалося прочитати. */
  read(contractId: number): SubmissionAttempt | null {
    const raw = sessionStorage.getItem(KEY_PREFIX + contractId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SubmissionAttempt;
    } catch {
      return null;
    }
  }

  remove(contractId: number): void {
    sessionStorage.removeItem(KEY_PREFIX + contractId);
  }
}
