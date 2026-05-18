import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

@Component({
  selector: 'mcp-profile-page',
  imports: [MatIconModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Account</span>
          <h1>Profile</h1>
        </div>
      </header>

      <article class="profile-panel">
        <mat-icon>business</mat-icon>
        <div>
          <h2>{{ profile()?.['CustomerName'] || profile()?.['Name'] || 'Customer' }}</h2>
          <p>{{ profile()?.['CustomerEmail'] || profile()?.['Email'] }}</p>
          <p>{{ profile()?.['CustomerDocument'] }}</p>
        </div>
      </article>
    </section>
  `,
})
export class ProfilePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly profile = signal<Record<string, string | number | null> | null>(null);

  async ngOnInit(): Promise<void> {
    const response = await this.api.get<ApiEnvelope<{ item: Record<string, string | number | null> }>>(
      'customer-portal/auth/me',
    );
    this.profile.set(response.data.item);
  }
}
