import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ContractsApi } from '../data-access/contracts-api';
import { ContractPage, ListFilters } from '../models';

export const PAGE_SIZE = 20;

@Injectable()
export class ContractListStore {
  private readonly api = inject(ContractsApi);

  private readonly filters = signal<ListFilters>({ status: 'DRAFT', q: '', page: 1 });
  private readonly page = signal<ContractPage>({ total: 0, items: [] });

  readonly items = computed(() => this.page().items);
  readonly total = computed(() => this.page().total);
  /** mat-paginator рахує з 0, API — з 1. */
  readonly pageIndex = computed(() => this.filters().page - 1);

  constructor() {
    toObservable(this.filters)
      .pipe(
        switchMap((filters) => this.api.list(filters, PAGE_SIZE)),
        takeUntilDestroyed(),
      )
      .subscribe((page) => this.page.set(page));
  }
}
