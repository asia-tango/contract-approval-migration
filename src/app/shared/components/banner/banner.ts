import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

export type BannerType = 'info' | 'success' | 'warn' | 'error';

@Component({
  selector: 'app-banner',
  imports: [MatButtonModule],
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

  readonly action = output<void>();
}
