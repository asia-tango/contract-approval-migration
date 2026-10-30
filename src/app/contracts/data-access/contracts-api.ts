import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Contract, ContractPage, ListFilters, Me } from '../models';

@Injectable({ providedIn: 'root' })
export class ContractsApi {
  private readonly http = inject(HttpClient);

  me(): Observable<Me> {
    return this.http.get<Me>('/api/me');
  }

  list(filters: ListFilters, size: number): Observable<ContractPage> {
    return this.http.get<ContractPage>('/api/contracts', {
      params: { status: filters.status, q: filters.q, page: filters.page, size },
    });
  }

  get(id: number): Observable<Contract> {
    return this.http.get<Contract>(`/api/contracts/${id}`);
  }
}
