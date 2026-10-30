import { Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ContractStatus } from '../../models';
import { StatusLabelPipe } from '../../pipes/status-label-pipe';

@Component({
  selector: 'app-contract-filters',
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule, StatusLabelPipe],
  templateUrl: './contract-filters.html',
  styleUrl: './contract-filters.scss',
})
export class ContractFilters {
  readonly status = input.required<ContractStatus | ''>();
  readonly query = input.required<string>();

  readonly statusChange = output<ContractStatus | ''>();
  readonly queryChange = output<string>();

  protected readonly statuses: ContractStatus[] = ['DRAFT', 'ON_APPROVAL', 'APPROVED', 'REJECTED'];
}
