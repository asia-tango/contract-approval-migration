import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, filter, map, merge, of, switchMap, tap } from 'rxjs';
import { ContractsApi } from '../data-access/contracts-api';
import { ContractPage, ContractStatus, ListFilters } from '../models';

export const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

@Injectable()
export class ContractListStore {
  private readonly api = inject(ContractsApi);

  private readonly filters = signal<ListFilters>({ status: 'DRAFT', q: '', page: 1 });
  /** null — список ще жодного разу не завантажено. */
  private readonly page = signal<ContractPage | null>(null);
  private readonly query$ = new Subject<string>();
  private readonly reload$ = new Subject<void>();

  readonly status = computed(() => this.filters().status);
  readonly query = computed(() => this.filters().q);
  readonly items = computed(() => this.page()?.items ?? []);
  readonly total = computed(() => this.page()?.total ?? 0);
  /** mat-paginator рахує з 0, API — з 1. */
  readonly pageIndex = computed(() => this.filters().page - 1);
  readonly loading = signal(false);
  /** Останнє оновлення не вдалося; на екрані — попередні дані. */
  readonly error = signal(false);
  readonly empty = computed(() => this.page()?.total === 0);

  constructor() {
    this.query$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        filter((q) => q !== this.filters().q),
        takeUntilDestroyed(),
      )
      .subscribe((q) => this.filters.update((f) => ({ ...f, q, page: 1 })));

    merge(toObservable(this.filters), this.reload$.pipe(map(() => this.filters())))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((filters) =>
          this.api.list(filters, PAGE_SIZE).pipe(
            map((page) => ({ filters, page })),
            catchError(() => of({ filters, page: null })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ filters, page }) => {
        if (page === null) {
          this.error.set(true);
          this.loading.set(false);
          return;
        }
        const lastPage = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
        if (filters.page > lastPage) {
          // Сторінки вже немає (напр. договори випали з фільтра) — переходимо на останню; loading лишається.
          this.filters.update((f) => ({ ...f, page: lastPage }));
          return;
        }
        this.error.set(false);
        this.loading.set(false);
        this.page.set(page);
      });
  }

  setStatus(status: ContractStatus | ''): void {
    this.filters.update((f) => ({ ...f, status, page: 1 }));
  }

  /** Пошук застосовується після паузи у введенні. */
  setQuery(q: string): void {
    this.query$.next(q);
  }

  setPage(pageIndex: number): void {
    this.filters.update((f) => ({ ...f, page: pageIndex + 1 }));
  }

  /** Перечитати поточну сторінку з тими самими фільтрами. */
  reload(): void {
    this.reload$.next();
  }
}
