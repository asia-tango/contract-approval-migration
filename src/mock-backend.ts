/**
 * Мок бекенду для тестового завдання «Погодження договорів» + сервіс курсів валют «іншої команди».
 *
 * НЕ ЗМІНЮЙТЕ цей файл. Покладіть його в src/mock-backend.ts і підключіть інтерцептор
 * в src/app/app.config.ts (див. TASK.md, «Підготовка»).
 *
 * Поведінка бекенду описана в TASK.md, розділ «API бекенду». Важливо: серверна обробка запиту
 * НЕ залежить від того, чекає клієнт на відповідь чи вже відписався (таймаут, switchMap тощо),
 * як і в реальному житті. Стан «сервера» зберігається в sessionStorage вкладки і переживає
 * перезавантаження сторінки.
 *
 * Запити не потрапляють у вкладку Network, тому кожен запит логується в консоль:
 *   [mock] → GET /api/contracts?status=DRAFT        запит пішов
 *   [mock] ← 200 GET /api/contracts (734 ms)        відповідь отримано
 *   [mock] ✕ GET /api/contracts (клієнт відписався) клієнт перестав чекати; сервер запит обробив
 *
 * У консолі браузера доступно:
 *   mockBackend.stats()  — заявки на погодження, реально створені на сервері
 *   mockBackend.reset()  — повернути дані до початкового стану
 *
 * Режими (query-параметри сторінки):
 *   ?chaos=off      — без випадкових помилок і з мінімальними затримками
 *   ?chaos=timeout  — кожне надсилання на погодження відповідає через 8 с
 *   ?role=viewer    — користувач без ролі CONTRACT_EDITOR
 */
import {
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

// ============================================================================
// Сервіс курсів валют. Належить команді «Казначейство», ним користуються кілька екранів.
// Використовувати його у своєму рішенні чи ні — на ваш розсуд (імпорт із src/mock-backend.ts).
// ============================================================================

export type Currency = 'UAH' | 'USD' | 'EUR';

export type Rates = Record<Currency, number>;

interface RatesResponse {
  date: string;
  rates: Rates;
}

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private readonly http = inject(HttpClient);

  /** Останні завантажені курси (кеш для старих екранів) */
  lastRates: Rates | null = null;

  /** Офіційні курси на дату у форматі YYYY-MM-DD */
  getRates(date: string): Observable<Rates> {
    return this.http.get<RatesResponse>('/api/rates', { params: { date } }).pipe(
      map((r) => r.rates),
      tap((rates) => (this.lastRates = rates)),
    );
  }

  /** Синхронний доступ до курсу з останнього завантаження */
  rateSync(currency: Currency): number | null {
    return currency === 'UAH' ? 1 : (this.lastRates?.[currency] ?? null);
  }
}

// ============================================================================
// HTTP-інтерцептор (підключається в app.config.ts)
// ============================================================================

let instance: MockBackend | null = null;

export function mockBackend(): MockBackend {
  if (!instance) {
    const search = typeof location !== 'undefined' ? location.search : '';
    const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    instance = new MockBackend(configFromLocation(search), undefined, storage);
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>)['mockBackend'] = {
        stats: () => instance!.stats(),
        reset: () => instance!.reset(),
        config: instance.config,
      };
      console.info(
        `[mock] бекенд запущено (дані збережено у вкладці, скинути: mockBackend.reset()): chaos=${instance.config.chaos}, role=${instance.config.role}. ` +
          'Діагностика: mockBackend.stats()',
      );
    }
  }
  return instance;
}

/** Для тестів: підмінити екземпляр бекенду (напр. з chaos: 'off' і фіксованим seed) */
export function setMockBackendForTests(backend: MockBackend | null): void {
  instance = backend;
}

export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  const url = new URL(req.urlWithParams, 'http://mock.local');
  if (!url.pathname.startsWith('/api/')) {
    return next(req);
  }

  return new Observable<HttpEvent<unknown>>((subscriber) => {
    const label = `${req.method} ${url.pathname}`;
    const params: Record<string, string | null> = {};
    url.searchParams.forEach((value, key) => (params[key] = value));

    const startedAt = performance.now();
    console.debug(`[mock] → ${req.method} ${url.pathname}${url.search}`);

    // Сервер обробляє запит одразу і незалежно від того, чи дочекається клієнт відповіді
    const { response, delayMs } = mockBackend().handle({
      method: req.method,
      path: url.pathname,
      params,
      body: req.body,
    });

    let delivered = false;
    const timer = setTimeout(() => {
      delivered = true;
      const ms = Math.round(performance.now() - startedAt);
      if (response.status < 400) {
        console.debug(`[mock] ← ${response.status} ${label} (${ms} ms)`);
        subscriber.next(
          new HttpResponse({ status: response.status, body: response.body, url: req.urlWithParams }),
        );
        subscriber.complete();
      } else {
        console.warn(`[mock] ← ${response.status} ${label} (${ms} ms)`, response.body);
        subscriber.error(
          new HttpErrorResponse({
            status: response.status,
            statusText: statusText(response.status),
            error: response.body,
            url: req.urlWithParams,
          }),
        );
      }
    }, delayMs);

    return () => {
      if (!delivered) {
        clearTimeout(timer);
        console.debug(`[mock] ✕ ${label} (клієнт відписався)`);
      }
    };
  });
};

function statusText(status: number): string {
  return (
    {
      400: 'Bad Request',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    }[status] ?? 'Error'
  );
}

// ============================================================================
// Далі — внутрішня реалізація моку. Читати не обов'язково.
// ============================================================================

// ---- Налаштування

export type ChaosMode = 'on' | 'off' | 'timeout';

export interface MockConfig {
  chaos: ChaosMode;
  role: 'editor' | 'viewer';
  /** Частка відповідей 503 на /api/rates */
  ratesFailureRate: number;
  /** Частка відповідей 500 на POST approval-requests (заявку НЕ створено) */
  approvalFailureRate: number;
  /** Частка «повільних» POST approval-requests */
  approvalSlowRate: number;
  /** Через скільки мс повільний POST реально зберігає заявку на сервері */
  approvalSlowPersistMs: number;
  /** Через скільки мс повільний POST повертає відповідь */
  approvalSlowResponseMs: number;
  /** Частка відповідей 500 на /api/settings */
  settingsFailureRate: number;
  /** Діапазон часу (мс), через який заявку погоджують/відхиляють */
  decisionDelayMs: [number, number];
  /** Сід генератора випадкових чисел (для відтворюваності тестів) */
  seed?: number;
}

export function defaultConfig(overrides: Partial<MockConfig> = {}): MockConfig {
  return {
    chaos: 'on',
    role: 'editor',
    ratesFailureRate: 0.1,
    approvalFailureRate: 0.1,
    approvalSlowRate: 0.25,
    approvalSlowPersistMs: 5500,
    approvalSlowResponseMs: 8000,
    settingsFailureRate: 0.1,
    decisionDelayMs: [10_000, 20_000],
    ...overrides,
  };
}

export function configFromLocation(search: string): MockConfig {
  const params = new URLSearchParams(search);
  const chaos = params.get('chaos');
  return defaultConfig({
    chaos: chaos === 'off' || chaos === 'timeout' ? chaos : 'on',
    role: params.get('role') === 'viewer' ? 'viewer' : 'editor',
  });
}

// ---- Початкові дані

export type MockCurrency = 'UAH' | 'USD' | 'EUR';
export type MockStatus = 'DRAFT' | 'ON_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface MockContract {
  id: number;
  number: string;
  counterparty: string;
  amount: number;
  currency: MockCurrency;
  vatPayer: boolean;
  signDate: string;
  startDate: string;
  endDate: string;
  comment: string | null;
  status: MockStatus;
  version: number;
  lastApprovalRequestId: number | null;
}

/** Внутрішні прапорці сценаріїв, назовні не віддаються */
export interface MockContractRecord extends MockContract {
  /** Версія, яку «бачить» сервер: якщо відрізняється — 409 на будь-який POST */
  serverVersion: number;
}

export interface SeedApprovalRequest {
  id: number;
  contractId: number;
  /** null — рішення ніколи не буде ухвалене */
  decideAfterMs: number | null;
  outcome: 'APPROVED' | 'REJECTED';
  reason: string | null;
}

const COUNTERPARTIES = [
  'ТОВ «Альфа-Постач»',
  'ПП «Будівельні Рішення»',
  'ТОВ «Офіс-Сервіс Україна»',
  'ФОП Коваленко І. М.',
  'ТОВ «ІТ-Інтегратор»',
  'АТ «Енергозбут»',
  'ТОВ «Кейтеринг Плюс»',
  'ТОВ «Безпека-Груп»',
  'ПрАТ «Поліграф-Друк»',
  'ТОВ «Логістик Трейд»',
  'ТОВ «Клінінг Сервіс»',
  'ТОВ «Меблі-Офіс»',
  'ФОП Шевчук О. В.',
  'ТОВ «Телеком Лайн»',
  'ТОВ «Аудит-Консалт»',
];

/** Простий детермінований ГПВЧ (mulberry32) */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const STATUS_BY_ID: Record<number, MockStatus> = {
  3: 'ON_APPROVAL', 14: 'ON_APPROVAL', 22: 'ON_APPROVAL', 30: 'ON_APPROVAL', 38: 'ON_APPROVAL', 45: 'ON_APPROVAL',
  15: 'APPROVED', 17: 'APPROVED', 19: 'APPROVED', 25: 'APPROVED', 27: 'APPROVED',
  33: 'APPROVED', 36: 'APPROVED', 41: 'APPROVED', 44: 'APPROVED',
  13: 'REJECTED', 21: 'REJECTED', 29: 'REJECTED', 34: 'REJECTED', 40: 'REJECTED', 47: 'REJECTED',
};

export function seedContracts(): MockContractRecord[] {
  const rnd = prng(20261026);
  const list: MockContractRecord[] = [];

  for (let id = 1; id <= 47; id++) {
    const currency: MockCurrency = rnd() < 0.7 ? 'UAH' : rnd() < 0.5 ? 'USD' : 'EUR';
    const amount =
      currency === 'UAH' ? round2(50_000 + rnd() * 2_500_000) : round2(1_000 + rnd() * 60_000);
    const signDate = addDays('2026-01-12', Math.floor(rnd() * 270));
    const startDate = addDays(signDate, 1 + Math.floor(rnd() * 20));
    const endDate = addDays(startDate, 30 + Math.floor(rnd() * 330));
    const status = STATUS_BY_ID[id] ?? 'DRAFT';

    list.push({
      id,
      number: `ДГ-2026/${String(id).padStart(4, '0')}`,
      counterparty: COUNTERPARTIES[Math.floor(rnd() * COUNTERPARTIES.length)],
      amount,
      currency,
      vatPayer: rnd() < 0.8,
      signDate,
      startDate,
      endDate,
      comment: rnd() < 0.3 ? 'Річна потреба підрозділу' : null,
      status,
      version: 1 + Math.floor(rnd() * 4),
      lastApprovalRequestId: null,
      serverVersion: 0,
    });
  }

  const patch = (id: number, data: Partial<MockContractRecord>) =>
    Object.assign(list[id - 1], data);

  patch(7, {
    counterparty: 'ТОВ «Альфа-Постач»', amount: 23_000, currency: 'EUR', vatPayer: true,
    signDate: '2026-10-01', startDate: '2026-12-15', endDate: '2027-01-10', comment: null, version: 3,
  });
  patch(8, {
    counterparty: 'ТОВ «ІТ-Інтегратор»', amount: 24_000, currency: 'USD', vatPayer: true,
    signDate: '2026-10-01', startDate: '2026-10-05', endDate: '2027-10-04', comment: null, version: 2,
  });
  patch(9, {
    counterparty: 'АТ «Енергозбут»', amount: 1_000_000, currency: 'UAH', vatPayer: true,
    signDate: '2026-09-20', startDate: '2026-10-01', endDate: '2026-12-31', comment: null, version: 1,
  });
  patch(10, {
    counterparty: 'ТОВ «Безпека-Груп»', amount: 30_000, currency: 'EUR', vatPayer: true,
    signDate: '2026-09-14', startDate: '2026-09-20', endDate: '2027-09-19', comment: null, version: 4,
  });
  patch(11, {
    counterparty: 'ТОВ «Логістик Трейд»', amount: 412_500, currency: 'UAH', vatPayer: false,
    signDate: '2026-09-02', startDate: '2026-09-10', endDate: '2027-03-10', comment: null, version: 5,
  });
  patch(12, { counterparty: 'ТОВ "Ромашка <i>Плюс</i>"', currency: 'UAH', amount: 87_340.5 });

  for (const c of list) {
    c.serverVersion = c.version;
  }
  // Договір #11 тим часом відредагували в іншій системі
  list[10].serverVersion = list[10].version + 1;

  return list;
}

export function seedApprovalRequests(contracts: MockContractRecord[]): SeedApprovalRequest[] {
  const reasons = [
    'Не погоджено бюджетом підрозділу',
    'Потрібен висновок юридичного департаменту',
    'Контрагент не пройшов перевірку безпеки',
  ];
  const result: SeedApprovalRequest[] = [];
  let nextId = 800;
  for (const c of contracts.filter((x) => x.status === 'ON_APPROVAL')) {
    const id = nextId++;
    c.lastApprovalRequestId = id;
    result.push({
      id,
      contractId: c.id,
      // #3 «завис» на погодженні; решта вирішуються протягом 25–90 с після старту
      decideAfterMs: c.id === 3 ? null : 25_000 + ((c.id * 7919) % 65_000),
      outcome: c.id % 2 === 0 ? 'APPROVED' : 'REJECTED',
      reason: c.id % 2 === 0 ? null : reasons[c.id % reasons.length],
    });
  }
  return result;
}

/** Дати, на які сервіс курсів недоступний (інцидент у джерелі даних) */
export const RATES_OUTAGE_DATES = new Set(['2026-09-14']);

const RATE_OVERRIDES: Record<string, { USD: number; EUR: number }> = {
  '2026-10-01': { USD: 41.2, EUR: 44.9 },
};

/** Офіційні курси на дату (детерміновано) */
export function ratesFor(date: string): Record<MockCurrency, number> {
  const override = RATE_OVERRIDES[date];
  if (override) {
    return { UAH: 1, ...override };
  }
  const day = Math.round(
    (Date.parse(date + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 86_400_000,
  );
  return {
    UAH: 1,
    USD: round2(40.9 + 0.5 * Math.sin(day / 17)),
    EUR: round2(42.6 + 0.6 * Math.sin(day / 13)),
  };
}

// ---- «Сервер»

export interface MockRequest {
  method: string;
  /** Шлях без query, напр. /api/contracts/7 */
  path: string;
  params: Record<string, string | null>;
  body: unknown;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

interface ApprovalRequestRecord {
  id: number;
  contractId: number;
  requestId: string | null;
  route: string;
  payload: string;
  amountUah: number;
  createdAt: number;
  /** Коли заявка стає видимою (статус договору змінюється) */
  persistAt: number;
  /** null — рішення не буде ніколи */
  decideAt: number | null;
  outcome: 'APPROVED' | 'REJECTED';
  reason: string | null;
  applied: boolean;
  decided: boolean;
}

export interface MockStats {
  approvalRequestsByContract: Record<string, number>;
  requests: Array<{
    id: number;
    contractId: number;
    requestId: string | null;
    route: string;
    amountUah: number;
    createdAt: string;
  }>;
  requestIdReusedWithDifferentPayload: number;
}

const CURRENCIES: MockCurrency[] = ['UAH', 'USD', 'EUR'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const STORAGE_KEY = 'mock-backend-state-v1';

export class MockBackend {
  private contracts: MockContractRecord[] = [];
  private approvals: ApprovalRequestRecord[] = [];
  private byRequestId = new Map<string, { response: MockResponse; payload: string }>();
  private keyReuseWithDifferentPayload = 0;
  private nextApprovalId = 900;
  private readonly rnd: () => number;

  constructor(
    readonly config: MockConfig,
    private readonly now: () => number = () => Date.now(),
    /** Якщо передано — стан «сервера» переживає перезавантаження сторінки */
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = null,
  ) {
    this.rnd = prng(config.seed ?? Math.floor(Math.random() * 2 ** 31));
    if (!this.restore()) {
      this.reset();
    }
  }

  reset(): void {
    this.seed();
    this.persist();
  }

  private seed(): void {
    this.contracts = seedContracts();
    const startedAt = this.now();
    this.approvals = seedApprovalRequests(this.contracts).map((s) => ({
      id: s.id,
      contractId: s.contractId,
      requestId: null,
      route: 'STANDARD',
      payload: '',
      amountUah: 0,
      createdAt: startedAt,
      persistAt: startedAt,
      decideAt: s.decideAfterMs === null ? null : startedAt + s.decideAfterMs,
      outcome: s.outcome,
      reason: s.reason,
      applied: true,
      decided: false,
    }));
    this.byRequestId.clear();
    this.keyReuseWithDifferentPayload = 0;
    this.nextApprovalId = 900;
  }

  stats(): MockStats {
    const created = this.approvals.filter((a) => a.id >= 900);
    const byContract: Record<string, number> = {};
    for (const a of created) {
      byContract[String(a.contractId)] = (byContract[String(a.contractId)] ?? 0) + 1;
    }
    return {
      approvalRequestsByContract: byContract,
      requests: created.map((a) => ({
        id: a.id,
        contractId: a.contractId,
        requestId: a.requestId,
        route: a.route,
        amountUah: a.amountUah,
        createdAt: new Date(a.createdAt).toISOString(),
      })),
      requestIdReusedWithDifferentPayload: this.keyReuseWithDifferentPayload,
    };
  }

  /**
   * Обробляє запит. Повертає відповідь і момент (мс від зараз), коли її віддати клієнту.
   * Побічні ефекти виконуються одразу або за внутрішнім розкладом — незалежно від клієнта.
   */
  handle(req: MockRequest): { response: MockResponse; delayMs: number } {
    const result = this.route(req);
    this.persist();
    return result;
  }

  private route(req: MockRequest): { response: MockResponse; delayMs: number } {
    this.tick();
    const { method, path } = req;
    let m: RegExpMatchArray | null;

    if (method === 'GET' && path === '/api/me') {
      return this.ok(this.me(), this.latency(100, 300));
    }
    if (method === 'GET' && path === '/api/contracts') {
      return this.ok(this.list(req.params), this.latency(200, 1500));
    }
    if (method === 'GET' && (m = path.match(/^\/api\/contracts\/(\d+)$/))) {
      const c = this.find(+m[1]);
      return c
        ? this.ok(this.publicContract(c), this.latency(150, 1200))
        : this.fail(404, { code: 'NOT_FOUND' }, this.latency(100, 300));
    }
    if (method === 'GET' && path === '/api/rates') {
      return this.rates(req.params['date'] ?? null);
    }
    if (method === 'GET' && path === '/api/settings') {
      if (this.chaosOn && this.rnd() < this.config.settingsFailureRate) {
        return this.fail(500, { code: 'INTERNAL_ERROR' }, this.latency(200, 600));
      }
      return this.ok({ committeeLimitUah: 1_000_000, committeeBase: 'NET' }, this.latency(200, 600));
    }
    if (method === 'POST' && (m = path.match(/^\/api\/contracts\/(\d+)\/approval-requests$/))) {
      return this.createApproval(+m[1], req.body);
    }
    if (method === 'GET' && (m = path.match(/^\/api\/approval-requests\/(\d+)$/))) {
      const a = this.approvals.find((x) => x.id === +m![1] && x.applied);
      if (!a) {
        return this.fail(404, { code: 'NOT_FOUND' }, this.latency(100, 300));
      }
      return this.ok(
        { id: a.id, status: a.decided ? a.outcome : 'PENDING', reason: a.decided ? a.reason : null },
        this.latency(100, 400),
      );
    }
    if (method === 'GET' && path === '/api/_debug/stats') {
      return this.ok(this.stats(), 0);
    }
    return this.fail(404, { code: 'NO_SUCH_ENDPOINT' }, 50);
  }

  // ---------------------------------------------------------------- handlers

  private me() {
    return this.config.role === 'viewer'
      ? { login: 'v.ivanenko', roles: [] as string[] }
      : { login: 'o.petrenko', roles: ['CONTRACT_EDITOR'] };
  }

  private list(params: Record<string, string | null>) {
    const status = (params['status'] ?? '') as MockStatus | '';
    const q = (params['q'] ?? '').trim().toLowerCase();
    const page = Math.max(1, parseInt(params['page'] ?? '1', 10) || 1);
    const size = Math.min(100, Math.max(1, parseInt(params['size'] ?? '20', 10) || 20));

    const filtered = this.contracts.filter(
      (c) =>
        (!status || c.status === status) &&
        (!q || c.number.toLowerCase().includes(q) || c.counterparty.toLowerCase().includes(q)),
    );
    return {
      total: filtered.length,
      items: filtered.slice((page - 1) * size, page * size).map((c) => ({
        id: c.id,
        number: c.number,
        counterparty: c.counterparty,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
      })),
    };
  }

  private rates(date: string | null): { response: MockResponse; delayMs: number } {
    const delay = this.latency(100, 800);
    if (!date || !ISO_DATE.test(date) || isNaN(Date.parse(date + 'T00:00:00Z'))) {
      return this.fail(400, { code: 'BAD_DATE' }, delay);
    }
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (date > today) {
      return this.fail(404, { code: 'NO_RATES_FOR_DATE' }, delay);
    }
    if (RATES_OUTAGE_DATES.has(date) || (this.chaosOn && this.rnd() < this.config.ratesFailureRate)) {
      return this.fail(503, { code: 'RATES_UNAVAILABLE' }, delay);
    }
    return this.ok({ date, rates: ratesFor(date) }, delay);
  }

  private createApproval(contractId: number, rawBody: unknown): { response: MockResponse; delayMs: number } {
    const body = (rawBody ?? {}) as Record<string, unknown>;
    const requestId = typeof body['requestId'] === 'string' && body['requestId'] ? (body['requestId'] as string) : null;
    const payload = JSON.stringify({ version: body['version'], route: body['route'], data: body['data'] });

    // Ідемпотентність: той самий requestId → та сама відповідь, нічого не створюється
    if (requestId && this.byRequestId.has(requestId)) {
      const prev = this.byRequestId.get(requestId)!;
      if (prev.payload !== payload) {
        this.keyReuseWithDifferentPayload++;
      }
      return { response: prev.response, delayMs: this.latency(300, 900) };
    }

    const normalDelay = this.latency(300, 1200);
    if (this.config.role === 'viewer') {
      return this.fail(403, { code: 'FORBIDDEN' }, normalDelay);
    }
    const contract = this.find(contractId);
    if (!contract) {
      return this.fail(404, { code: 'NOT_FOUND' }, normalDelay);
    }
    if (body['version'] !== contract.serverVersion) {
      return this.fail(409, { code: 'VERSION_CONFLICT' }, normalDelay);
    }
    const errors = this.validate(body);
    if (errors.length) {
      return this.fail(422, { errors }, normalDelay);
    }
    // У режимі timeout надсилання завжди повільне і ніколи не падає з 500 — так його легше відтворювати
    if (this.config.chaos === 'on' && this.rnd() < this.config.approvalFailureRate) {
      return this.fail(500, { code: 'INTERNAL_ERROR' }, normalDelay);
    }

    const slow =
      this.config.chaos === 'timeout' || (this.chaosOn && this.rnd() < this.config.approvalSlowRate);
    const now = this.now();
    const data = body['data'] as Record<string, unknown>;
    const id = this.nextApprovalId++;
    const [dMin, dMax] = this.config.decisionDelayMs;
    const persistAt = slow ? now + this.config.approvalSlowPersistMs : now;
    const approved = this.rnd() < 0.7;

    this.approvals.push({
      id,
      contractId,
      requestId,
      route: String(body['route']),
      payload,
      amountUah: round2((data['amount'] as number) * ratesFor(data['signDate'] as string)[data['currency'] as MockCurrency]),
      createdAt: now,
      persistAt,
      decideAt: persistAt + dMin + this.rnd() * (dMax - dMin),
      outcome: approved ? 'APPROVED' : 'REJECTED',
      reason: approved ? null : 'Не погоджено бюджетом підрозділу',
      applied: false,
      decided: false,
    });

    const response: MockResponse = { status: 201, body: { approvalRequestId: id, status: 'PENDING' } };
    if (requestId) {
      this.byRequestId.set(requestId, { response, payload });
    }
    if (!slow) {
      this.tick();
    }
    return { response, delayMs: slow ? this.config.approvalSlowResponseMs : normalDelay };
  }

  private validate(body: Record<string, unknown>): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];
    const data = (body['data'] ?? {}) as Record<string, unknown>;
    const push = (field: string, message: string) => errors.push({ field, message });

    if (body['route'] !== 'STANDARD' && body['route'] !== 'COMMITTEE') {
      push('route', 'Невідомий маршрут погодження');
    }
    if (typeof data['counterparty'] !== 'string' || !data['counterparty'].trim()) {
      push('counterparty', 'Вкажіть контрагента');
    }
    const amount = data['amount'];
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      push('amount', 'Сума має бути більшою за 0');
    } else if (Math.abs(round2(amount) - amount) > 1e-9) {
      push('amount', 'Не більше 2 знаків після коми');
    }
    if (!CURRENCIES.includes(data['currency'] as MockCurrency)) {
      push('currency', 'Невідома валюта');
    }
    if (typeof data['vatPayer'] !== 'boolean') {
      push('vatPayer', 'Не вказано ознаку платника ПДВ');
    }
    for (const f of ['signDate', 'startDate', 'endDate']) {
      const v = data[f];
      if (typeof v !== 'string' || !ISO_DATE.test(v) || isNaN(Date.parse(v + 'T00:00:00Z'))) {
        push(f, 'Некоректна дата');
      }
    }
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (typeof data['signDate'] === 'string' && data['signDate'] > today) {
      push('signDate', 'Дата підписання не може бути в майбутньому');
    }
    if (
      typeof data['startDate'] === 'string' && typeof data['endDate'] === 'string' &&
      ISO_DATE.test(data['startDate']) && ISO_DATE.test(data['endDate']) &&
      data['endDate'] < data['startDate']
    ) {
      push('endDate', 'Дата закінчення раніше дати початку');
    }
    const comment = typeof data['comment'] === 'string' ? data['comment'].trim() : '';
    if (body['route'] === 'COMMITTEE' && comment.length < 20) {
      push('comment', 'Для комітету потрібне обґрунтування (від 20 символів)');
    }
    return errors;
  }

  // ---------------------------------------------------------------- internals

  private persist(): void {
    this.storage?.setItem(
      STORAGE_KEY,
      JSON.stringify({
        contracts: this.contracts,
        approvals: this.approvals,
        byRequestId: [...this.byRequestId.entries()],
        keyReuseWithDifferentPayload: this.keyReuseWithDifferentPayload,
        nextApprovalId: this.nextApprovalId,
      }),
    );
  }

  private restore(): boolean {
    const raw = this.storage?.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }
    try {
      const st = JSON.parse(raw);
      this.contracts = st.contracts;
      this.approvals = st.approvals;
      this.byRequestId = new Map(st.byRequestId);
      this.keyReuseWithDifferentPayload = st.keyReuseWithDifferentPayload;
      this.nextApprovalId = st.nextApprovalId;
      return Array.isArray(this.contracts) && this.contracts.length > 0;
    } catch {
      return false;
    }
  }

  /** Застосовує відкладені зміни стану (збереження заявок, рішення комітету) */
  private tick(): void {
    const now = this.now();
    for (const a of this.approvals) {
      if (!a.applied && a.persistAt <= now) {
        a.applied = true;
        const c = this.find(a.contractId);
        if (c) {
          const data = (JSON.parse(a.payload) as { data: Partial<MockContract> }).data;
          Object.assign(c, {
            counterparty: data.counterparty,
            amount: data.amount,
            currency: data.currency,
            vatPayer: data.vatPayer,
            signDate: data.signDate,
            startDate: data.startDate,
            endDate: data.endDate,
            comment: data.comment ?? null,
            status: 'ON_APPROVAL',
            lastApprovalRequestId: a.id,
          });
        }
      }
      if (a.applied && !a.decided && a.decideAt !== null && a.decideAt <= now) {
        a.decided = true;
        const c = this.find(a.contractId);
        if (c && c.lastApprovalRequestId === a.id) {
          c.status = a.outcome;
        }
      }
    }
  }

  private find(id: number): MockContractRecord | undefined {
    return this.contracts.find((c) => c.id === id);
  }

  private publicContract(c: MockContractRecord): MockContract {
    const { serverVersion: _hidden, ...pub } = c;
    return { ...pub };
  }

  private get chaosOn(): boolean {
    return this.config.chaos !== 'off';
  }

  private latency(min: number, max: number): number {
    if (!this.chaosOn) {
      return 50 + Math.floor(this.rnd() * 100);
    }
    return Math.floor(min + this.rnd() * (max - min));
  }

  private ok(body: unknown, delayMs: number) {
    return { response: { status: 200, body: structuredClone(body) }, delayMs };
  }

  private fail(status: number, body: unknown, delayMs: number) {
    return { response: { status, body }, delayMs };
  }
}
