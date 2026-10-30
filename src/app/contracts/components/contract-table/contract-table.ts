import { Component } from '@angular/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-contract-table',
  imports: [MatTableModule, MatPaginatorModule],
  templateUrl: './contract-table.html',
  styleUrl: './contract-table.scss',
})
export class ContractTable {
  protected readonly columns = ['number', 'counterparty', 'amount', 'status'];
}
