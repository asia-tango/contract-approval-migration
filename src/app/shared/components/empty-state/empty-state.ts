import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  imports: [MatButtonModule],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  readonly text = input.required<string>();
  readonly actionLabel = input<string>();

  readonly action = output<void>();
}
