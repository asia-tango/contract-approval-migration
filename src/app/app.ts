import { Component } from '@angular/core';
import { ContractsPage } from './contracts/components/contracts-page/contracts-page';

@Component({
  selector: 'app-root',
  imports: [ContractsPage],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
