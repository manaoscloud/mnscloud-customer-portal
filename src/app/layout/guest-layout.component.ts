import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'mcp-guest-layout',
  imports: [RouterOutlet],
  template: `
    <main class="guest-shell">
      <router-outlet />
    </main>
  `,
})
export class GuestLayoutComponent {}
