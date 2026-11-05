import { Injectable } from '@angular/core';

const KEY_PREFIX = 'contract-approval:protocol-number:';

interface SavedProtocolNumber {
  approvalRequestId: number;
  protocolNumber: string;
}

/**
 * Надісланий номер протоколу в sessionStorage: бекенд його не повертає, а картка має показати його після надсилання.
 * Окремий запис на кожен договір. Номер належить заявці: для іншої заявки договору (або після скидання мока) його немає.
 */
@Injectable({ providedIn: 'root' })
export class ProtocolNumberStorage {
  save(contractId: number, approvalRequestId: number, protocolNumber: string): void {
    const saved: SavedProtocolNumber = { approvalRequestId, protocolNumber };
    sessionStorage.setItem(KEY_PREFIX + contractId, JSON.stringify(saved));
  }

  /** null — запису немає, він іншої заявки або його не вдалося прочитати. */
  read(contractId: number, approvalRequestId: number | null): string | null {
    const raw = sessionStorage.getItem(KEY_PREFIX + contractId);
    if (!raw) return null;
    try {
      const saved = JSON.parse(raw) as SavedProtocolNumber;
      return saved.approvalRequestId === approvalRequestId ? saved.protocolNumber : null;
    } catch {
      return null;
    }
  }
}
