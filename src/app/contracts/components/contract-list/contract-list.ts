import { Component, inject } from '@angular/core';
import { ContractCardStore } from '../../state/contract-card-store';
import { ContractListStore, PAGE_SIZE } from '../../state/contract-list-store';
import { ContractFilters } from '../contract-filters/contract-filters';
import { ContractTable } from '../contract-table/contract-table';

@Component({
  selector: 'app-contract-list',
  imports: [ContractFilters, ContractTable],
  templateUrl: './contract-list.html',
  styleUrl: './contract-list.scss',
})
export class ContractList {
  protected readonly listStore = inject(ContractListStore);
  protected readonly cardStore = inject(ContractCardStore);
  protected readonly pageSize = PAGE_SIZE;
}
