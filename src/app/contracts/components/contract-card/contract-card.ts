import { Component, ElementRef, computed, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { map } from 'rxjs';
import { Banner } from '../../../shared/components/banner/banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { businessToday, parseApiDate, toApiDate } from '../../../shared/helpers/dates';
import { COMMITTEE_LIMIT_UAH } from '../../committee-config';
import { createContractForm } from '../../forms/contract-form';
import { calculate } from '../../helpers/calc';
import { equivalentHint } from '../../helpers/equivalent-hint';
import { CARD_MESSAGES } from '../../messages';
import { StatusLabelPipe } from '../../pipes/status-label-pipe';
import { ContractCardStore } from '../../state/contract-card-store';
import { ContractCalc } from '../contract-calc/contract-calc';

@Component({
  selector: 'app-contract-card',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatButtonModule,
    MatProgressBarModule,
    Banner,
    EmptyState,
    StatusLabelPipe,
    ContractCalc,
  ],
  templateUrl: './contract-card.html',
  styleUrl: './contract-card.scss',
})
export class ContractCard {
  protected readonly store = inject(ContractCardStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly messages = CARD_MESSAGES;

  protected readonly form = createContractForm(
    () => this.store.rates(),
    COMMITTEE_LIMIT_UAH,
    () => {
      const rates = this.store.ratesState();
      return rates.status === 'error' && rates.kind === 'date';
    },
  );
  /** Значення разом з вимкненими полями: у режимі перегляду розрахунок теж потрібен. */
  protected readonly value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  protected readonly today = parseApiDate(businessToday());
  protected readonly calc = computed(() => calculate(this.value(), this.store.rates(), COMMITTEE_LIMIT_UAH));
  protected readonly hint = computed(() => {
    const rates = this.store.ratesState();
    return equivalentHint(this.calc(), rates.status === 'ok' ? rates.date : null, COMMITTEE_LIMIT_UAH);
  });
  /** Курс потрібен лише для валюти, відмінної від UAH. */
  protected readonly rateNeeded = computed(() => this.value().currency !== 'UAH');
  protected readonly ratesLoading = computed(
    () => this.rateNeeded() && this.store.ratesState().status === 'loading',
  );
  protected readonly ratesUnavailable = computed(() => {
    const rates = this.store.ratesState();
    return this.rateNeeded() && rates.status === 'error' && rates.kind === 'unavailable';
  });
  /** Надсилання недоступне, поки курс вантажиться або недоступний (не виправити у формі). */
  protected readonly ratesBlocked = computed(() => this.ratesLoading() || this.ratesUnavailable());

  constructor() {
    const { endDate, comment, signDate } = this.form.controls;

    // Синхронізація стор → форма. Кожен effect стежить рівно за одним signal, решта — в untracked.
    effect(() => {
      const data = this.store.formData();
      untracked(() => {
        if (data) this.form.reset(data);
      });
    });
    effect(() => {
      this.store.ratesState();
      untracked(() => {
        comment.updateValueAndValidity({ emitEvent: false });
        signDate.updateValueAndValidity({ emitEvent: false });
      });
    });
    effect(() => {
      const editable = this.store.editable();
      untracked(() => (editable ? this.form.enable() : this.form.disable()));
    });

    // Правила, що залежать від інших полів, перезапускаємо явно; emitEvent: false — щоб не зациклити.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      endDate.updateValueAndValidity({ emitEvent: false });
      comment.updateValueAndValidity({ emitEvent: false });
      const date = signDate.value;
      this.store.setSignDate(date ? toApiDate(date) : null);
    });
  }

  /** Клік «Надіслати»: поки що лише перевірка форми (надсилання — крок 5). */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('.ng-invalid[formControlName]')?.focus();
    }
  }
}
