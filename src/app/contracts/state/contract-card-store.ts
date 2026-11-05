import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concat,
  concatMap,
  defer,
  distinctUntilChanged,
  exhaustMap,
  finalize,
  ignoreElements,
  map,
  merge,
  of,
  startWith,
  switchMap,
  takeWhile,
  tap,
  timer,
} from 'rxjs';
import { ExchangeRateService } from '../../../mock-backend';
import { ApprovalApi } from '../data-access/approval-api';
import { ContractsApi } from '../data-access/contracts-api';
import { isNotFound, isRatesDateError } from '../helpers/api-error';
import { toFormValue } from '../helpers/contract-mapper';
import { ApprovalRequest, Contract, ContractFormValue, ContractStatus, Me, Rates } from '../models';
import { ContractListStore } from './contract-list-store';

const EDITOR_ROLE = 'CONTRACT_EDITOR';
const POLL_INTERVAL_MS = 5000;

/** Опитування заявки. `pending` — договір уже чекає рішення (ON_APPROVAL або щойно 201). */
interface PollStart {
  requestId: number;
  pending: boolean;
}

/** Курси для пари (договір, дата підписання); `date: null` — дати немає, запиту немає. */
interface RatesKey {
  contractId: number;
  date: string | null;
}

/** `date` — дата підписання, для якої цей стан. `error.kind: 'date'` — 404 / 400, `unavailable` — решта (503). */
export type RatesState =
  | { status: 'idle' }
  | { status: 'loading'; date: string }
  | { status: 'ok'; date: string; rates: Rates }
  | { status: 'error'; date: string; kind: 'date' | 'unavailable' };

@Injectable()
export class ContractCardStore {
  private readonly api = inject(ContractsApi);
  private readonly approvalApi = inject(ApprovalApi);
  private readonly rateService = inject(ExchangeRateService);
  private readonly listStore = inject(ContractListStore);

  private readonly open$ = new Subject<number>();
  /** null — зупинити опитування. */
  private readonly poll$ = new Subject<PollStart | null>();
  private readonly meRetry$ = new Subject<void>();
  private readonly ratesKey$ = new Subject<RatesKey>();
  private readonly ratesRetry$ = new Subject<RatesKey>();
  private readonly selectedContract$ = new Subject<number>();
  private readonly openedContract$ = new Subject<Contract>();

  /** Обрано інший договір — синхронно, до запиту договору. */
  readonly selected$ = this.selectedContract$.asObservable();
  /** Договір завантажено при виборі (або «Повторити»); не при перечитуванні того самого договору. */
  readonly opened$ = this.openedContract$.asObservable();

  private readonly me = signal<Me | null>(null);
  private readonly selected = signal<number | null>(null);
  private readonly loaded = signal<Contract | null>(null);

  readonly selectedId = this.selected.asReadonly();
  /** Договір лише якщо це обраний: поки вантажиться інший — null, дані попереднього не показуємо. */
  readonly contract = computed(() => {
    const contract = this.loaded();
    return contract?.id === this.selected() ? contract : null;
  });
  readonly loading = signal(false);
  /** Перечитування того самого договору (після 409). */
  readonly reloading = signal(false);
  readonly loadError = signal(false);
  readonly meError = signal(false);
  private readonly formValue = signal<ContractFormValue | null>(null);
  /** Дані для заповнення форми: змінюються, лише коли завантажено договір або відновлюється надсилання. */
  readonly formData = this.formValue.asReadonly();

  /** Поки /api/me не завантажено — лише читання. */
  readonly canEdit = computed(() => this.me()?.roles.includes(EDITOR_ROLE) ?? false);
  readonly meLoaded = computed(() => this.me() !== null);
  readonly statusEditable = computed(() => {
    const status = this.contract()?.status;
    return status === 'DRAFT' || status === 'REJECTED';
  });
  readonly editable = computed(() => this.canEdit() && this.statusEditable());

  private readonly ratesResult = signal<RatesState>({ status: 'idle' });
  readonly ratesState = this.ratesResult.asReadonly();
  /** Усі курси на дату підписання або null (вантажиться / помилка / немає дати). */
  readonly rates = computed(() => {
    const state = this.ratesState();
    return state.status === 'ok' ? state.rates : null;
  });

  private readonly approvalResult = signal<ApprovalRequest | null>(null);
  /** Заявка з опитування; null — для відкритого договору опитування не було. */
  readonly approval = this.approvalResult.asReadonly();

  constructor() {
    this.meRetry$
      .pipe(
        startWith(undefined),
        switchMap(() => this.api.me().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((me) => {
        this.meError.set(me === null);
        if (me) this.me.set(me);
      });

    this.open$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.loadError.set(false);
        }),
        switchMap((id) => this.api.get(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((contract) => {
        this.loading.set(false);
        if (!contract) {
          this.loadError.set(true);
          return;
        }
        this.loaded.set(contract);
        this.formValue.set(toFormValue(contract));
        this.ratesKey$.next({ contractId: contract.id, date: contract.signDate });
        // Умова старту — лише при виборі договору (і «Повторити»), не при перечитуванні після рішення.
        const { status, lastApprovalRequestId: requestId } = contract;
        if (requestId !== null && (status === 'ON_APPROVAL' || status === 'REJECTED')) {
          this.poll$.next({ requestId, pending: status === 'ON_APPROVAL' });
        }
        this.openedContract$.next(contract);
      });

    this.poll$
      .pipe(
        switchMap((start) => (start ? this.poll(start) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((approval) => this.approvalResult.set(approval));

    merge(
      this.ratesKey$.pipe(
        distinctUntilChanged((a, b) => a.contractId === b.contractId && a.date === b.date),
      ),
      this.ratesRetry$,
    )
      .pipe(
        switchMap(({ date }) =>
          date === null
            ? of<RatesState>({ status: 'idle' })
            : this.rateService.getRates(date).pipe(
                map((rates): RatesState => ({ status: 'ok', date, rates })),
                catchError((error) =>
                  of<RatesState>({ status: 'error', date, kind: isRatesDateError(error) ? 'date' : 'unavailable' }),
                ),
                startWith<RatesState>({ status: 'loading', date }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.ratesResult.set(state));
  }

  open(id: number): void {
    if (id === this.selected()) return;
    this.selected.set(id);
    this.selectedContract$.next(id);
    // Курси й опитування попереднього договору більше не потрібні: запити скасовуються, стан — порожній.
    this.ratesKey$.next({ contractId: id, date: null });
    this.poll$.next(null);
    this.open$.next(id);
  }

  /**
   * Перечитати відкритий договір після 409: форму не скидаємо (formData не змінюється) —
   * оновлюються лише версія і знімок. Дані на екрані лишаються, поверх — індикатор.
   */
  reloadKeepingForm(): Observable<Contract> {
    return defer(() => {
      this.reloading.set(true);
      return this.api.get(this.selected()!);
    }).pipe(
      tap((contract) => {
        if (contract.id === this.selected()) this.loaded.set(contract);
      }),
      finalize(() => this.reloading.set(false)),
    );
  }

  /**
   * Заявку створено (201): договір на погодженні локально, без перечитування — сервер міг її ще не застосувати.
   * Далі — опитування статусу заявки.
   */
  setOnApproval(approvalRequestId: number): void {
    this.loaded.update((contract) =>
      contract && { ...contract, status: 'ON_APPROVAL', lastApprovalRequestId: approvalRequestId },
    );
    this.poll$.next({ requestId: approvalRequestId, pending: true });
  }

  /** Заповнити форму іншими даними — при відновленні: тим, що реально надіслано. */
  setFormData(value: ContractFormValue): void {
    this.formValue.set(value);
  }

  /** «Повторити» після помилки завантаження — як повторний вибір договору. */
  retryLoad(): void {
    const id = this.selected();
    if (id !== null) this.open$.next(id);
  }

  retryMe(): void {
    this.meRetry$.next();
  }

  /** Дата підписання з форми (`yyyy-MM-dd` або null). Новий запит — лише якщо змінилась пара (договір, дата). */
  setSignDate(date: string | null): void {
    const contract = this.contract();
    if (contract) this.ratesKey$.next({ contractId: contract.id, date });
  }

  /** Повторити запит курсу для поточної пари — в обхід відсіювання дублів. */
  retryRates(): void {
    const contract = this.contract();
    const state = this.ratesState();
    if (contract && state.status === 'error') {
      this.ratesRetry$.next({ contractId: contract.id, date: state.date });
    }
  }

  /**
   * Опитування до фінального статусу. Зупиняється також при виборі іншого договору (switchMap) і знищенні екрана.
   * Після переходу pending → фінальний у цьому ж потоці — перечитати картку і реєстр (один раз).
   * Для REJECTED перша ж відповідь фінальна: лише причина, без перечитування.
   */
  private poll({ requestId, pending }: PollStart): Observable<ApprovalRequest | null> {
    const waiting: ApprovalRequest = { id: requestId, status: 'PENDING', reason: null };
    let wasPending = pending;
    return timer(0, POLL_INTERVAL_MS).pipe(
      // Запити не накладаються. Помилка окремого запиту не показується: наступний тік повторить запит.
      exhaustMap(() =>
        this.approvalApi.get(requestId).pipe(catchError((error) => (isNotFound(error) ? of(waiting) : EMPTY))),
      ),
      takeWhile((approval) => approval.status === 'PENDING', true),
      concatMap((approval) => {
        const decided = wasPending && approval.status !== 'PENDING';
        wasPending = approval.status === 'PENDING';
        if (!decided) return of(approval);
        // Статус — одразу з відповіді: мітка й редагованість правильні, навіть якщо перечитати не вдасться.
        this.loaded.update((contract) => contract && { ...contract, status: approval.status as ContractStatus });
        return concat(of(approval), this.reloadDecided());
      }),
      startWith(pending ? waiting : null),
    );
  }

  /**
   * Після рішення: реєстр і договір перечитуються, форма — свіжими даними; опитування заново не запускається.
   * Дані на екрані лишаються, поверх — індикатор. Помилку не показуємо: статус уже поставлено з відповіді опитування.
   */
  private reloadDecided(): Observable<never> {
    return defer(() => {
      this.listStore.reload();
      this.reloading.set(true);
      return this.api.get(this.selected()!);
    }).pipe(
      tap((contract) => {
        this.loaded.set(contract);
        this.formValue.set(toFormValue(contract));
      }),
      catchError(() => EMPTY),
      finalize(() => this.reloading.set(false)),
      ignoreElements(),
    );
  }
}
