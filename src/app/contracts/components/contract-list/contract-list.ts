import { Component, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Banner } from '../../../shared/components/banner/banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { LIST_MESSAGES } from '../../messages';
import { ContractCardStore } from '../../state/contract-card-store';
import { ContractListStore, PAGE_SIZE } from '../../state/contract-list-store';
import { ContractFilters } from '../contract-filters/contract-filters';
import { ContractTable } from '../contract-table/contract-table';

@Component({
  selector: 'app-contract-list',
  imports: [ContractFilters, ContractTable, Banner, EmptyState, MatProgressBarModule],
  templateUrl: './contract-list.html',
  styleUrl: './contract-list.scss',
})
export class ContractList {
  protected readonly listStore = inject(ContractListStore);
  protected readonly cardStore = inject(ContractCardStore);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly messages = LIST_MESSAGES;
}
