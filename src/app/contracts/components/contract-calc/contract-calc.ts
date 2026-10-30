import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Banner } from '../../../shared/components/banner/banner';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { ContractCalculation } from '../../helpers/calc';
import { CARD_MESSAGES } from '../../messages';

@Component({
  selector: 'app-contract-calc',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, Banner, MoneyPipe],
  templateUrl: './contract-calc.html',
  styleUrl: './contract-calc.scss',
})
export class ContractCalc {
  readonly calc = input.required<ContractCalculation>();
  /** Пояснення еквівалента для ⓘ; null — іконку не показуємо. */
  readonly hint = input<string | null>(null);
  readonly ratesLoading = input(false);

  protected readonly messages = CARD_MESSAGES;
}
