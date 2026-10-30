import { Component } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-contract-filters',
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule],
  templateUrl: './contract-filters.html',
  styleUrl: './contract-filters.scss',
})
export class ContractFilters {}
