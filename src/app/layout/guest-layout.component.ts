import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'mcp-guest-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <main class="guest-shell">
      <router-outlet />
    </main>
  `,
})
export class GuestLayoutComponent {}
