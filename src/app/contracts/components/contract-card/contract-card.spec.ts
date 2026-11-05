import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MockBackend, defaultConfig, mockBackendInterceptor, setMockBackendForTests } from '../../../../mock-backend';
import { ContractCardStore } from '../../state/contract-card-store';
import { ContractListStore } from '../../state/contract-list-store';
import { SubmissionStore } from '../../state/submission-store';
import { ContractCard } from './contract-card';

/** #9 — рівно 1 000 000 UAH: курс не потрібен. */
const CONTRACT_ID = 9;
const LOAD_MS = 3000;

describe('ContractCard: поле «Номер протоколу»', () => {
  let fixture: ComponentFixture<ContractCard>;

  const field = (name: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`input[formControlName="${name}"]`);

  function typeAmount(value: string): void {
    const input = field('amount')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sessionStorage.clear();
    setMockBackendForTests(new MockBackend(defaultConfig({ chaos: 'off', seed: 1 })));
    TestBed.configureTestingModule({
      imports: [ContractCard],
      providers: [
        provideHttpClient(withInterceptors([mockBackendInterceptor])),
        provideNativeDateAdapter(),
        ContractListStore,
        ContractCardStore,
        SubmissionStore,
      ],
    });
    fixture = TestBed.createComponent(ContractCard);
    TestBed.inject(ContractCardStore).open(CONTRACT_ID);
    await vi.advanceTimersByTimeAsync(LOAD_MS);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    setMockBackendForTests(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('рівно ліміт — поля немає; сума зросла — з\'явилось; зменшилась — зникло, введене лишається', () => {
    expect(field('amount')).not.toBeNull();
    expect(field('protocolNumber')).toBeNull();

    typeAmount('1000000,01');
    const input = field('protocolNumber')!;
    expect(input).not.toBeNull();
    expect(input.classList).toContain('ng-invalid');

    input.value = 'ПЗ-2026/014';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(field('protocolNumber')!.classList).toContain('ng-valid');

    typeAmount('999999');
    expect(field('protocolNumber')).toBeNull();

    typeAmount('2000000');
    expect(field('protocolNumber')!.value).toBe('ПЗ-2026/014');
  });
});
