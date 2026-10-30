import { Component, input, output } from '@angular/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MoneyPipe } from '../../../shared/pipes/money-pipe';
import { ContractListItem } from '../../models';
import { StatusLabelPipe } from '../../pipes/status-label-pipe';

@Component({
  selector: 'app-contract-table',
  imports: [MatTableModule, MatPaginatorModule, MoneyPipe, StatusLabelPipe],
  templateUrl: './contract-table.html',
  styleUrl: './contract-table.scss',
})
export class ContractTable {
  readonly items = input.required<ContractListItem[]>();
  readonly total = input.required<number>();
  readonly pageIndex = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly selectedId = input<number | null>(null);

  readonly open = output<number>();
  /** Індекс сторінки mat-paginator (з 0). */
  readonly pageChange = output<number>();

  protected readonly columns = ['number', 'counterparty', 'amount', 'status'];
}
