import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import { ContractsApi } from '../data-access/contracts-api';
import { Contract, Me } from '../models';

const EDITOR_ROLE = 'CONTRACT_EDITOR';

@Injectable()
export class ContractCardStore {
  private readonly api = inject(ContractsApi);

  private readonly open$ = new Subject<number>();
  private readonly me = signal<Me | null>(null);
  private readonly selected = signal<number | null>(null);
  private readonly loaded = signal<Contract | null>(null);

  readonly selectedId = this.selected.asReadonly();
  /** Договір лише якщо це обраний: поки вантажиться інший — null, дані попереднього не показуємо. */
  readonly contract = computed(() => {
    const contract = this.loaded();
    return contract?.id === this.selected() ? contract : null;
  });
  /** Поки /api/me не завантажено — лише читання. */
  readonly canEdit = computed(() => this.me()?.roles.includes(EDITOR_ROLE) ?? false);
  readonly statusEditable = computed(() => {
    const status = this.contract()?.status;
    return status === 'DRAFT' || status === 'REJECTED';
  });

  constructor() {
    this.api
      .me()
      .pipe(takeUntilDestroyed())
      .subscribe((me) => this.me.set(me));

    this.open$
      .pipe(
        switchMap((id) => this.api.get(id)),
        takeUntilDestroyed(),
      )
      .subscribe((contract) => this.loaded.set(contract));
  }

  open(id: number): void {
    if (id === this.selected()) return;
    this.selected.set(id);
    this.open$.next(id);
  }
}
