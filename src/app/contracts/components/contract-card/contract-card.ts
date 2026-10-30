import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { parseApiDate } from '../../../shared/helpers/dates';
import { StatusLabelPipe } from '../../pipes/status-label-pipe';
import { ContractCardStore } from '../../state/contract-card-store';
import { ContractCalc } from '../contract-calc/contract-calc';

@Component({
  selector: 'app-contract-card',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatButtonModule,
    MatProgressBarModule,
    EmptyState,
    StatusLabelPipe,
    ContractCalc,
  ],
  templateUrl: './contract-card.html',
  styleUrl: './contract-card.scss',
})
export class ContractCard {
  protected readonly store = inject(ContractCardStore);

  protected readonly dates = computed(() => {
    const contract = this.store.contract();
    return contract
      ? {
          sign: parseApiDate(contract.signDate),
          start: parseApiDate(contract.startDate),
          end: parseApiDate(contract.endDate),
        }
      : null;
  });
}
