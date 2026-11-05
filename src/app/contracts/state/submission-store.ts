import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  exhaustMap,
  filter,
  map,
  merge,
  mergeMap,
  of,
  startWith,
  switchMap,
  tap,
  timeout,
} from 'rxjs';
import { BannerType } from '../../shared/components/banner/banner';
import { COMMITTEE_LIMIT_UAH } from '../committee-config';
import { ApprovalApi } from '../data-access/approval-api';
import { PendingSubmissionStorage } from '../data-access/pending-submission-storage';
import { SubmitError, submitErrorOf } from '../helpers/api-error';
import { toApprovalPayload, toFormValue } from '../helpers/contract-mapper';
import { SUBMIT_TIMEOUT_MS } from '../helpers/submit-policy';
import { errorsWithoutField } from '../helpers/validation';
import { APPROVAL_MESSAGES, CARD_MESSAGES, SUBMIT_MESSAGES } from '../messages';
import {
  ApprovalRequest,
  Contract,
  ContractFormValue,
  FieldError,
  ServerValidation,
  SubmissionAttempt,
} from '../models';
import { ContractCardStore } from './contract-card-store';
import { ContractListStore } from './contract-list-store';

/**
 * Заявка і значення форми, з якого її побудовано (для помилок 422 біля полів).
 * `recovery` — те саме надсилання, відновлене із запису (після перезавантаження або повернення до договору).
 */
interface SubmitRequest {
  attempt: SubmissionAttempt;
  value: ContractFormValue;
  recovery: boolean;
}

/** `reloadFailed` — 409, але перечитати договір не вдалося: надсилання заблоковане до успішного перечитування. */
export type SubmissionState =
  | { status: 'idle' }
  | { status: 'sending'; attempt: SubmissionAttempt; recovery: boolean }
  | { status: 'unknown'; attempt: SubmissionAttempt }
  | { status: 'failed'; kind: 'forbidden' | 'server' | 'conflict' | 'versionStuck' | 'reloadFailed' }
  | { status: 'failed'; kind: 'validation'; errors: FieldError[]; sent: ContractFormValue };

export interface SubmitBanner {
  type: BannerType;
  text: string;
  /** Кнопка «Повторити» — перечитати договір після 409. */
  retry: boolean;
}

/** Статус погодження під кнопкою: «Очікує рішення» — зі спінером і поясненням в ⓘ. */
export interface ApprovalBanner {
  type: BannerType;
  text: string;
  spinner: boolean;
  hint: string | null;
}

/** Що показати в картці: поля, кнопку, банери над кнопкою і статус погодження під нею. */
export interface CardView {
  editable: boolean;
  /** Кнопка видима лише для DRAFT / REJECTED. */
  showSubmit: boolean;
  /** Курс компонент перевіряє окремо: блокує лише для валюти, відмінної від UAH, а валюта — у формі. */
  canSubmit: boolean;
  sending: boolean;
  banner: SubmitBanner | null;
  /** Причина відмови — над кнопкою: форма знову редагована, договір можна виправити й надіслати. */
  rejection: SubmitBanner | null;
  approval: ApprovalBanner | null;
}

const IDLE: SubmissionState = { status: 'idle' };

function bannerFor(state: SubmissionState): SubmitBanner | null {
  const banner = (type: BannerType, text: string, retry = false): SubmitBanner => ({ type, text, retry });
  if (state.status === 'sending') return state.recovery ? banner('info', SUBMIT_MESSAGES.recovery) : null;
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

function approvalBannerFor(approval: ApprovalRequest | null): ApprovalBanner | null {
  switch (approval?.status) {
    case 'PENDING':
      return { type: 'info', text: APPROVAL_MESSAGES.pending, spinner: true, hint: APPROVAL_MESSAGES.pendingHint };
    case 'APPROVED':
      return { type: 'success', text: APPROVAL_MESSAGES.approved, spinner: false, hint: null };
    default:
      return null;
  }
}

function rejectionBannerFor(approval: ApprovalRequest | null): SubmitBanner | null {
  return approval?.status === 'REJECTED' && approval.reason
    ? { type: 'error', text: APPROVAL_MESSAGES.rejected(approval.reason), retry: false }
    : null;
}

@Injectable()
export class SubmissionStore {
  private readonly api = inject(ApprovalApi);
  private readonly cardStore = inject(ContractCardStore);
  private readonly listStore = inject(ContractListStore);
  private readonly storage = inject(PendingSubmissionStorage);

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
      // Під час sending / unknown / failed причина стосується попередньої заявки — не показуємо.
      rejection: state.status === 'idle' ? rejectionBannerFor(this.cardStore.approval()) : null,
      approval: approvalBannerFor(this.cardStore.approval()),
    };
  });

  constructor() {
    // Усе надсилання — в межах обраного договору: при зміні договору спроба відписується, стан — idle.
    // Запис у сховищі при цьому лишається: при поверненні до договору надсилання відновиться.
    // Подія вибору синхронна, тож підписка на opened$ гарантовано є до відповіді на запит договору.
    this.cardStore.selected$
      .pipe(
        switchMap((id) => {
          const recover$ = this.cardStore.opened$.pipe(
            filter((contract) => contract.id === id),
            mergeMap((contract) => this.recover(contract)),
          );
          return merge(
            merge(this.submit$, recover$).pipe(exhaustMap((request) => this.send(request))),
            this.reloadRetry$.pipe(exhaustMap((version) => this.resolveConflict(version))),
          ).pipe(startWith(IDLE));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.current.set(state));
  }

  /** У стані unknown — та сама заявка (requestId і payload), інакше — нова. */
  submit(value: ContractFormValue): void {
    if (!this.cardView().canSubmit) return;
    const state = this.state();
    const attempt = state.status === 'unknown' ? state.attempt : this.newAttempt(value);
    if (attempt) this.submit$.next({ attempt, value, recovery: false });
  }

  /** «Повторити» після невдалого перечитування договору при 409. */
  retryConflictReload(): void {
    const contract = this.cardStore.contract();
    const state = this.state();
    if (contract && state.status === 'failed' && state.kind === 'reloadFailed') {
      this.reloadRetry$.next(contract.version);
    }
  }

  private newAttempt(value: ContractFormValue): SubmissionAttempt | null {
    const contract = this.cardStore.contract();
    if (!contract) return null;
    const payload = toApprovalPayload(value, contract.version, this.cardStore.rates(), COMMITTEE_LIMIT_UAH);
    return payload && { contractId: contract.id, requestId: crypto.randomUUID(), payload };
  }

  /**
   * Договір відкрито, і для нього є запис незавершеного надсилання. DRAFT / REJECTED — форма заповнюється даними
   * із запису і йде те саме надсилання (той самий requestId і payload). Інший статус — заявку вже створено, запис зайвий.
   */
  private recover(contract: Contract): Observable<SubmitRequest> {
    const attempt = this.storage.read(contract.id);
    if (!attempt) return EMPTY;
    if (contract.status !== 'DRAFT' && contract.status !== 'REJECTED') {
      this.storage.remove(contract.id);
      return EMPTY;
    }
    const value = toFormValue(attempt.payload.data);
    this.cardStore.setFormData(value);
    return of({ attempt, value, recovery: true });
  }

  private send(request: SubmitRequest): Observable<SubmissionState> {
    const { attempt, recovery } = request;
    const { contractId, requestId, payload } = attempt;
    // Запис — до POST: якщо відповіді не дочекаємось (таймаут, перезавантаження, інший договір), відновимо з нього.
    // Одна спроба — окремий потік; таймаут — на спробу, а не на все надсилання.
    const try$ = defer(() => {
      this.storage.save(attempt);
      return this.api.create(contractId, requestId, payload);
    }).pipe(timeout(SUBMIT_TIMEOUT_MS));
    return try$.pipe(
      tap((created) => {
        this.storage.remove(contractId);
        this.cardStore.setOnApproval(created.approvalRequestId);
        this.listStore.reload();
      }),
      map(() => IDLE),
      catchError((error) => this.failure(submitErrorOf(error), request)),
      startWith<SubmissionState>({ status: 'sending', attempt, recovery }),
    );
  }

  /** Доля заявки невідома — запис лишається. Відповідь остаточна — запис видаляємо: далі буде новий requestId. */
  private failure(error: SubmitError, { attempt, value }: SubmitRequest): Observable<SubmissionState> {
    if (error.kind === 'unknown') return of({ status: 'unknown', attempt });
    this.storage.remove(attempt.contractId);
    switch (error.kind) {
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
