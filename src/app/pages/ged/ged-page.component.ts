import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

type PublishedDocument = { RdcUUID: string; RdcTitle: string; GacName: string; GdsName: string; RdvUUID: string | null };
type DocumentPage = { items: PublishedDocument[]; total: number; limit: number; offset: number };

@Component({
  selector: 'mcp-ged-page',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header"><div><h1>{{ 'ged.title' | transloco }}</h1><p>{{ 'ged.description' | transloco }}</p></div></header>
      <form class="search" (ngSubmit)="load(0)">
        <mat-form-field><mat-label>{{ 'ged.search' | transloco }}</mat-label><input matInput name="search" [(ngModel)]="search" maxlength="200" /></mat-form-field>
        <button matButton="filled" type="submit" [disabled]="loading()">{{ 'ged.search' | transloco }}</button>
      </form>
      @if (error()) { <p class="card" role="alert">{{ 'ged.error' | transloco }}</p> }
      @if (loading()) { <p role="status">{{ 'ged.loading' | transloco }}</p> }
      @else if (!error() && documents().length === 0) { <p class="card">{{ 'ged.empty' | transloco }}</p> }
      <div class="documents">
        @for (document of documents(); track document.RdcUUID) {
          <article class="card document"><div><h2>{{ document.RdcTitle }}</h2><p>{{ document.GacName }} · {{ document.GdsName }}</p></div>
            <button matButton="outlined" type="button" (click)="download(document)" [disabled]="!document.RdvUUID || downloading() !== null">
              <mat-icon>download</mat-icon>{{ 'ged.download' | transloco }}
            </button>
          </article>
        }
      </div>
      <nav class="pagination" [attr.aria-label]="'ged.pagination' | transloco">
        <button matButton type="button" [disabled]="loading() || offset() === 0" (click)="load(offset() - 20)">{{ 'ged.previous' | transloco }}</button>
        <button matButton type="button" [disabled]="loading() || offset() + 20 >= total()" (click)="load(offset() + 20)">{{ 'ged.next' | transloco }}</button>
      </nav>
    </section>
  `,
  styles: [`
    .search, .pagination { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
    .search mat-form-field { flex: 1; min-width: 180px; }
    .documents { display: grid; gap: 16px; }
    .document { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; }
    .document > div { min-width: 0; flex: 1 1 220px; overflow-wrap: anywhere; }
    h2 { font-size: 1.1rem; margin: 0; } .pagination { justify-content: flex-end; margin-top: 16px; }
  `],
})
export class GedPageComponent {
  private readonly api = inject(ApiService);
  readonly documents = signal<PublishedDocument[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly downloading = signal<string | null>(null);
  readonly total = signal(0);
  readonly offset = signal(0);
  search = '';
  private request = 0;
  constructor() { void this.load(0); }
  async load(offset: number) {
    const request = ++this.request;
    this.loading.set(true); this.error.set(false); this.documents.set([]);
    try {
      const query = new URLSearchParams({ search: this.search, limit: '20', offset: String(offset) });
      const response = await this.api.get<ApiEnvelope<DocumentPage>>(`customer-portal/ged/documents?${query}`);
      if (request !== this.request) return;
      this.documents.set(response.data.items); this.total.set(response.data.total); this.offset.set(offset);
    } catch { if (request === this.request) { this.error.set(true); this.total.set(0); } }
    finally { if (request === this.request) this.loading.set(false); }
  }
  async download(document: PublishedDocument) {
    if (!document.RdvUUID || this.downloading()) return;
    this.downloading.set(document.RdcUUID); this.error.set(false);
    try {
      const blob = await this.api.getBlob(`customer-portal/ged/documents/${encodeURIComponent(document.RdcUUID)}/versions/${encodeURIComponent(document.RdvUUID)}/content`);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      const extension = blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg';
      link.href = url; link.download = `document.${extension}`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { this.error.set(true); }
    finally { this.downloading.set(null); }
  }
}
