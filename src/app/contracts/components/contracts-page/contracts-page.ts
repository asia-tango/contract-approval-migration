import { Component } from '@angular/core';
import { ContractCard } from '../contract-card/contract-card';
import { ContractList } from '../contract-list/contract-list';

@Component({
  selector: 'app-contracts-page',
  imports: [ContractList, ContractCard],
  templateUrl: './contracts-page.html',
  styleUrl: './contracts-page.scss',
})
export class ContractsPage {}
