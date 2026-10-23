import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

@Component({
  selector: 'mcp-profile-page',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">{{ 'profile.eyebrow' | transloco }}</span>
          <h1>{{ 'profile.title' | transloco }}</h1>
        </div>
      </header>

      <article class="profile-panel card">
        <span class="icon-badge"><mat-icon>business</mat-icon></span>
        <div>
          <h2>{{ profile()?.['CustomerName'] || profile()?.['Name'] || ('app.customer' | transloco) }}</h2>
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
