import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

export type BannerType = 'info' | 'success' | 'warn' | 'error';

@Component({
  selector: 'app-banner',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './banner.html',
  styleUrl: './banner.scss',
  host: {
    '[class]': "'banner-' + type()",
    '[attr.role]': "type() === 'error' ? 'alert' : 'status'",
  },
})
export class Banner {
  readonly type = input.required<BannerType>();
  readonly text = input.required<string>();
  readonly actionLabel = input<string>();
  /** Спінер перед текстом — процес триває. */
  readonly spinner = input(false);
  /** Пояснення в підказці ⓘ після тексту. */
  readonly hint = input<string | null>(null);

  readonly action = output<void>();
}
