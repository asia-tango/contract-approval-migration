import { Component } from '@angular/core';
import { ContractCardStore } from '../../state/contract-card-store';
import { ContractListStore } from '../../state/contract-list-store';
import { ContractCard } from '../contract-card/contract-card';
import { ContractList } from '../contract-list/contract-list';

@Component({
  selector: 'app-contracts-page',
  imports: [ContractList, ContractCard],
  providers: [ContractListStore, ContractCardStore],
  templateUrl: './contracts-page.html',
  styleUrl: './contracts-page.scss',
})
export class ContractsPage {}
