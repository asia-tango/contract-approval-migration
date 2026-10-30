import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApprovalCreated, ApprovalPayload } from '../models';

@Injectable({ providedIn: 'root' })
export class ApprovalApi {
  private readonly http = inject(HttpClient);

  create(contractId: number, requestId: string, payload: ApprovalPayload): Observable<ApprovalCreated> {
    return this.http.post<ApprovalCreated>(`/api/contracts/${contractId}/approval-requests`, {
      requestId,
      ...payload,
    });
  }
}
