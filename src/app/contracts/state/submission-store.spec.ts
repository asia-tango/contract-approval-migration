import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MockBackend, defaultConfig, mockBackendInterceptor, setMockBackendForTests } from '../../../mock-backend';
import { ApprovalApi } from '../data-access/approval-api';
import { PendingSubmissionStorage } from '../data-access/pending-submission-storage';
import { ContractCardStore } from './contract-card-store';
import { ContractListStore } from './contract-list-store';
import { SubmissionStore } from './submission-store';

/** #9 — UAH: курс не потрібен, тож випадкові 503 курсів на надсилання не впливають. */
const CONTRACT_ID = 9;
/** Із запасом: /api/me і договір — до 1,2 с, повтор POST при відновленні — до 0,9 с. */
const LOAD_MS = 3000;

/** Стори екрана, як у providers `contracts-page`. Повторний виклик після resetTestingModule — імітація F5. */
function createStores() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([mockBackendInterceptor])),
      ContractListStore,
      ContractCardStore,
      SubmissionStore,
    ],
  });
  return { card: TestBed.inject(ContractCardStore), submission: TestBed.inject(SubmissionStore) };
}

describe('SubmissionStore з MockBackend (chaos: timeout)', () => {
  let backend: MockBackend;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sessionStorage.clear();
    // POST відповідає через 8 с (заявку створено через 5,5 с), клієнтський таймаут — 5 с.
    backend = new MockBackend(defaultConfig({ chaos: 'timeout', seed: 1 }));
    setMockBackendForTests(backend);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    setMockBackendForTests(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('таймаут → unknown → «Надіслати» ще раз → 201, одна заявка', async () => {
    const { card, submission } = createStores();
    card.open(CONTRACT_ID);
    await vi.advanceTimersByTimeAsync(LOAD_MS);

    submission.submit(card.formData()!);
    expect(submission.state().status).toBe('sending');

    await vi.advanceTimersByTimeAsync(5000);
    expect(submission.state().status).toBe('unknown');
    expect(submission.cardView().canSubmit).toBe(true);

    submission.submit(card.formData()!);
    await vi.advanceTimersByTimeAsync(1000);
    expect(submission.state().status).toBe('idle');
    expect(card.contract()?.status).toBe('ON_APPROVAL');

    const stats = backend.stats();
    expect(stats.approvalRequestsByContract).toEqual({ [CONTRACT_ID]: 1 });
    expect(stats.requestIdReusedWithDifferentPayload).toBe(0);
  });

  it('таймаут → F5 → відкрити той самий договір → відновлення без дубля', async () => {
    const first = createStores();
    first.card.open(CONTRACT_ID);
    await vi.advanceTimersByTimeAsync(LOAD_MS);
    first.submission.submit(first.card.formData()!);
    await vi.advanceTimersByTimeAsync(5000);
    expect(first.submission.state().status).toBe('unknown');

    const storage = TestBed.inject(PendingSubmissionStorage);
    const saved = storage.read(CONTRACT_ID);
    expect(saved).not.toBeNull();

    // F5: стори знищено, «сервер» і sessionStorage лишились. Сервер ще не застосував заявку (до 5,5 с) — договір DRAFT.
    TestBed.resetTestingModule();
    const second = createStores();
    const create = vi.spyOn(TestBed.inject(ApprovalApi), 'create');
    second.card.open(CONTRACT_ID);
    await vi.advanceTimersByTimeAsync(LOAD_MS);

    // Відновлення — те саме надсилання: той самий requestId і payload.
    expect(create).toHaveBeenCalledExactlyOnceWith(CONTRACT_ID, saved!.requestId, saved!.payload);
    expect(second.submission.state().status).toBe('idle');
    expect(second.card.contract()?.status).toBe('ON_APPROVAL');
    expect(storage.read(CONTRACT_ID)).toBeNull();

    const stats = backend.stats();
    expect(stats.approvalRequestsByContract).toEqual({ [CONTRACT_ID]: 1 });
    expect(stats.requests[0].requestId).toBe(saved!.requestId);
    expect(stats.requestIdReusedWithDifferentPayload).toBe(0);
  });
});
