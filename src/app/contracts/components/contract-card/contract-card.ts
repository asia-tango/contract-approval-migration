import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ContractCalc } from '../contract-calc/contract-calc';

@Component({
  selector: 'app-contract-card',
  imports: [MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatButtonModule, ContractCalc],
  templateUrl: './contract-card.html',
  styleUrl: './contract-card.scss',
})
export class ContractCard {}
