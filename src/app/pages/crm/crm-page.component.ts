import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

type PublishedWorkspace = {
  CwsUUID: string;
  CwsName: string;
  CwsKind: string;
  CwsStatus: number;
};

type WorkspaceResponse = {
  items: PublishedWorkspace[];
};

@Component({
  selector: 'mcp-crm-page',
  imports: [MatCardModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'crm.title' | transloco }}</h1>
          <p>{{ 'crm.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ 'crm.error' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'crm.loading' | transloco }}</p>
      } @else if (!error() && workspaces().length === 0) {
        <p class="card">{{ 'crm.empty' | transloco }}</p>
      }

      <div class="workspaces">
        @for (workspace of workspaces(); track workspace.CwsUUID) {
          <article class="card workspace">
            <span class="icon-badge">
              <mat-icon>workspaces</mat-icon>
            </span>
            <div class="workspace-details">
              <h2>{{ workspace.CwsName }}</h2>
            </div>
            <div class="workspace-status">
              <span class="badge">{{ 'crm.active' | transloco }}</span>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: [`
    .workspaces {
      display: grid;
      gap: 16px;
    }
    .workspace {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding: 20px;
    }
    .workspace-details {
      min-width: 0;
      flex: 1 1 220px;
      overflow-wrap: anywhere;
    }
    h2 {
      font-size: 1.1rem;
      margin: 0 0 4px;
    }
    .workspace-status {
      display: flex;
      align-items: center;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
      background: var(--surface-container, rgba(0, 0, 0, 0.05));
    }
  `],
})
export class CrmPageComponent {
  private readonly api = inject(ApiService);
  readonly workspaces = signal<PublishedWorkspace[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<WorkspaceResponse>>('customer-portal/crm/workspaces');
      this.workspaces.set(response.data?.items ?? []);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
