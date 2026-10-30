import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, exhaustMap, map, merge, of, startWith, switchMap, tap, timeout } from 'rxjs';
import { BannerType } from '../../shared/components/banner/banner';
import { COMMITTEE_LIMIT_UAH } from '../committee-config';
import { ApprovalApi } from '../data-access/approval-api';
import { SubmitError, submitErrorOf } from '../helpers/api-error';
import { toApprovalPayload } from '../helpers/contract-mapper';
import { SUBMIT_TIMEOUT_MS } from '../helpers/submit-policy';
import { errorsWithoutField } from '../helpers/validation';
import { CARD_MESSAGES, SUBMIT_MESSAGES } from '../messages';
import { ApprovalPayload, ContractFormValue, FieldError, ServerValidation } from '../models';
import { ContractCardStore } from './contract-card-store';
import { ContractListStore } from './contract-list-store';

/** Одна заявка: requestId і payload створюються один раз і не змінюються при повторі. */
interface Attempt {
  contractId: number;
  requestId: string;
  payload: ApprovalPayload;
}

/** Заявка і значення форми, з якого її побудовано (для помилок 422 біля полів). */
interface SubmitRequest {
  attempt: Attempt;
  value: ContractFormValue;
}

/** `reloadFailed` — 409, але перечитати договір не вдалося: надсилання заблоковане до успішного перечитування. */
export type SubmissionState =
  | { status: 'idle' }
  | { status: 'sending'; attempt: Attempt }
  | { status: 'unknown'; attempt: Attempt }
  | { status: 'failed'; kind: 'forbidden' | 'server' | 'conflict' | 'versionStuck' | 'reloadFailed' }
  | { status: 'failed'; kind: 'validation'; errors: FieldError[]; sent: ContractFormValue };

export interface SubmitBanner {
  type: BannerType;
  text: string;
  /** Кнопка «Повторити» — перечитати договір після 409. */
  retry: boolean;
}

/** Що показати в картці: поля, кнопку, банер над кнопкою. */
export interface CardView {
  editable: boolean;
  /** Кнопка видима лише для DRAFT / REJECTED. */
  showSubmit: boolean;
  /** Курс компонент перевіряє окремо: блокує лише для валюти, відмінної від UAH, а валюта — у формі. */
  canSubmit: boolean;
  sending: boolean;
  banner: SubmitBanner | null;
}

const IDLE: SubmissionState = { status: 'idle' };

function bannerFor(state: SubmissionState): SubmitBanner | null {
  const banner = (type: BannerType, text: string, retry = false): SubmitBanner => ({ type, text, retry });
  if (state.status === 'unknown') return banner('warn', SUBMIT_MESSAGES.unknown);
  if (state.status !== 'failed') return null;
  switch (state.kind) {
    case 'forbidden':
      return banner('error', SUBMIT_MESSAGES.forbidden);
    case 'server':
      return banner('error', SUBMIT_MESSAGES.server);
    case 'conflict':
      return banner('warn', SUBMIT_MESSAGES.conflict);
    case 'versionStuck':
      return banner('error', SUBMIT_MESSAGES.versionStuck);
    case 'reloadFailed':
      return banner('error', CARD_MESSAGES.loadError, true);
    case 'validation': {
      const rest = errorsWithoutField(state.errors);
      return rest.length ? banner('error', rest.map((e) => e.message).join('. ')) : null;
    }
  }
}

@Injectable()
export class SubmissionStore {
  private readonly api = inject(ApprovalApi);
  private readonly cardStore = inject(ContractCardStore);
  private readonly listStore = inject(ContractListStore);

  private readonly submit$ = new Subject<SubmitRequest>();
  private readonly reloadRetry$ = new Subject<number>();

  private readonly current = signal<SubmissionState>(IDLE);
  readonly state = this.current.asReadonly();

  /** Помилки 422 для валідаторів форми. */
  readonly serverValidation = computed((): ServerValidation | null => {
    const state = this.state();
    return state.status === 'failed' && state.kind === 'validation' ? { errors: state.errors, sent: state.sent } : null;
  });

  readonly cardView = computed((): CardView => {
    const state = this.state();
    const editable = this.cardStore.editable();
    const failed = state.status === 'failed' ? state.kind : null;
    // Поки доля заявки невідома (або прав немає), дані змінювати не можна.
    const locked = state.status === 'sending' || state.status === 'unknown' || failed === 'forbidden';
    const blocked =
      state.status === 'sending' || failed === 'forbidden' || failed === 'versionStuck' || failed === 'reloadFailed';
    return {
      editable: editable && !locked,
      showSubmit: this.cardStore.statusEditable(),
      canSubmit: editable && !blocked,
      sending: state.status === 'sending',
      banner: bannerFor(state),
    };
  });

  constructor() {
    // Усе надсилання — в межах обраного договору: при зміні договору спроба відписується, стан — idle.
    toObservable(this.cardStore.selectedId)
      .pipe(
        switchMap(() =>
          merge(
            this.submit$.pipe(exhaustMap((request) => this.send(request))),
            this.reloadRetry$.pipe(exhaustMap((version) => this.resolveConflict(version))),
          ).pipe(startWith(IDLE)),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.current.set(state));
  }

  /** У стані unknown — та сама заявка (requestId і payload), інакше — нова. */
  submit(value: ContractFormValue): void {
    if (!this.cardView().canSubmit) return;
    const state = this.state();
    const attempt = state.status === 'unknown' ? state.attempt : this.newAttempt(value);
    if (attempt) this.submit$.next({ attempt, value });
  }

  /** «Повторити» після невдалого перечитування договору при 409. */
  retryConflictReload(): void {
    const contract = this.cardStore.contract();
    const state = this.state();
    if (contract && state.status === 'failed' && state.kind === 'reloadFailed') {
      this.reloadRetry$.next(contract.version);
    }
  }

  private newAttempt(value: ContractFormValue): Attempt | null {
    const contract = this.cardStore.contract();
    if (!contract) return null;
    const payload = toApprovalPayload(value, contract.version, this.cardStore.rates(), COMMITTEE_LIMIT_UAH);
    return payload && { contractId: contract.id, requestId: crypto.randomUUID(), payload };
  }

  private send(request: SubmitRequest): Observable<SubmissionState> {
    const { contractId, requestId, payload } = request.attempt;
    // Одна спроба — окремий потік; таймаут — на спробу, а не на все надсилання.
    const try$ = this.api.create(contractId, requestId, payload).pipe(timeout(SUBMIT_TIMEOUT_MS));
    return try$.pipe(
      tap((created) => {
        this.cardStore.setOnApproval(created.approvalRequestId);
        this.listStore.reload();
      }),
      map(() => IDLE),
      catchError((error) => this.failure(submitErrorOf(error), request)),
      startWith<SubmissionState>({ status: 'sending', attempt: request.attempt }),
    );
  }

  private failure(error: SubmitError, { attempt, value }: SubmitRequest): Observable<SubmissionState> {
    switch (error.kind) {
      case 'unknown':
        return of({ status: 'unknown', attempt });
      case 'conflict':
        return this.resolveConflict(attempt.payload.version);
      case 'validation':
        return of({ status: 'failed', kind: 'validation', errors: error.errors, sent: value });
      default:
        return of({ status: 'failed', kind: error.kind });
    }
  }

  /** 409: перечитати договір (форму не скидаємо). Версія не змінилась — надіслати вже не вийде. */
  private resolveConflict(sentVersion: number): Observable<SubmissionState> {
    return this.cardStore.reloadKeepingForm().pipe(
      map((contract): SubmissionState => ({
        status: 'failed',
        kind: contract.version === sentVersion ? 'versionStuck' : 'conflict',
      })),
      catchError(() => of<SubmissionState>({ status: 'failed', kind: 'reloadFailed' })),
    );
  }
}
