import { Component } from '@angular/core';
import { ContractFilters } from '../contract-filters/contract-filters';
import { ContractTable } from '../contract-table/contract-table';

@Component({
  selector: 'app-contract-list',
  imports: [ContractFilters, ContractTable],
  templateUrl: './contract-list.html',
  styleUrl: './contract-list.scss',
})
export class ContractList {}
