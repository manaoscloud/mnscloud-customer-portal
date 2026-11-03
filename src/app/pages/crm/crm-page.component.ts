import { ChangeDetectionStrategy, Component, inject, signal, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';
import { CRM_FIELDS, CRM_PREFIX, CONVERSION_FIELDS, crmFormValues, crmFormPayload, type CrmField, type CrmRow, type CrmSection } from './crm-fields';

type Workspace = { CwsUUID: string; CwsName: string; canWrite: number };
type Page<T> = { items: T[]; total: number; limit: number; offset: number };
@Component({
  selector: 'mcp-crm-page',
  imports: [FormsModule, MatDialogModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crm-page.component.html',
  styleUrl: './crm-page.component.scss',
})
export class CrmPageComponent {
  private readonly api = inject(ApiService);
  private readonly dialogs = inject(MatDialog);
  @ViewChild('editor') editor!: TemplateRef<unknown>;
  private dialog?: MatDialogRef<unknown>;
  private generation = 0;
  private lookupGeneration = new Map<string, number>();
  readonly sections: CrmSection[] = ['leads', 'opportunities', 'activities'];
  readonly workspaces = signal<Workspace[]>([]);
  readonly workspace = signal<Workspace | null>(null);
  readonly section = signal<CrmSection>('leads');
  readonly rows = signal<CrmRow[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly lookups = signal<Record<string, CrmRow[]>>({});
  readonly lookupTotals = signal<Record<string, number>>({});
  search = '';
  form: CrmRow = {};
  fields: CrmField[] = [];
  original: CrmRow | null = null;
  conversion = false;
  attempted = false;
  lookupSearch: Record<string, string> = {};

  constructor() { void this.load(); }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.api.get<ApiEnvelope<Page<Workspace>>>('customer-portal/crm/workspaces');
      this.workspaces.set(response.data?.items ?? []);
    } catch { this.error.set('crm.error'); }
    finally { this.loading.set(false); }
  }
  async selectWorkspace(uuid: string) {
    this.workspace.set(this.workspaces().find((row) => row.CwsUUID === uuid) ?? null);
    this.search = '';
    await this.loadRecords(0);
  }
  async selectSection(section: CrmSection) {
    this.section.set(section);
    this.search = '';
    await this.loadRecords(0);
  }
  private endpoint() { return `customer-portal/crm/workspaces/${this.workspace()?.CwsUUID}`; }
  prefix() { return CRM_PREFIX[this.section()]; }
  rowName(row: CrmRow) { return row[this.prefix() + 'Name']; }
  rowState(row: CrmRow) { return row[this.prefix() + 'State'] ?? row['StageKind'] ?? ''; }
  editable(row: CrmRow) { return Number(this.workspace()?.canWrite) === 1 && !(this.section() === 'leads' && row['CleState'] === 'converted'); }
  async loadRecords(offset = 0) {
    const generation = ++this.generation;
    this.rows.set([]);
    this.total.set(0);
    this.offset.set(offset);
    this.error.set('');
    if (!this.workspace()) return;
    this.loading.set(true);
    try {
      const response = await this.api.get<ApiEnvelope<Page<CrmRow>>>(`${this.endpoint()}/${this.section()}?limit=25&offset=${offset}&search=${encodeURIComponent(this.search)}`);
      if (generation !== this.generation) return;
      this.rows.set(response.data?.items ?? []);
      this.total.set(Number(response.data?.total ?? 0));
    } catch { if (generation === this.generation) this.error.set('crm.error'); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  open(row: CrmRow | null = null, conversion = false) {
    this.original = row;
    this.conversion = conversion;
    this.fields = conversion ? CONVERSION_FIELDS : CRM_FIELDS[this.section()];
    this.form = crmFormValues(this.fields, conversion ? null : row);
    this.lookups.set({}); this.lookupTotals.set({}); this.lookupSearch = {};
    this.lookupGeneration.clear();
    this.attempted = false; this.formError.set('');
    this.dialog = this.dialogs.open(this.editor, { width: '900px', maxWidth: '95vw', maxHeight: '92dvh' });
    for (const field of this.fields) if (field.lookup) void this.loadLookup(field);
  }
  close() { if (!this.saving()) this.dialog?.close(); }
  async loadLookup(field: CrmField, more = false) {
    const version = (this.lookupGeneration.get(field.key) ?? 0) + 1;
    this.lookupGeneration.set(field.key, version);
    const offset = more ? (this.lookups()[field.key]?.length ?? 0) : 0;
    try {
      const response = await this.api.get<ApiEnvelope<Page<CrmRow>>>(`${this.endpoint()}/${field.lookup}?limit=50&offset=${offset}&search=${encodeURIComponent(this.lookupSearch[field.key] ?? '')}`);
      if (this.lookupGeneration.get(field.key) !== version) return;
      const items = response.data?.items ?? [];
      this.lookups.update((all) => ({ ...all, [field.key]: more ? [...(all[field.key] ?? []), ...items] : items }));
      this.lookupTotals.update((all) => ({ ...all, [field.key]: Number(response.data?.total ?? 0) }));
    } catch { this.formError.set('crm.error'); }
  }
  selectedMissing(field: CrmField) { return !!this.form[field.key] && !(this.lookups()[field.key] ?? []).some((row) => row[field.prefix + 'UUID'] === this.form[field.key]); }
  async save(element: HTMLFormElement) {
    this.attempted = true;
    if (!element.reportValidity() || this.saving()) return;
    this.saving.set(true); this.formError.set('');
    try {
      const body = crmFormPayload(this.section(), this.form, this.original, this.conversion);
      const base = `${this.endpoint()}/${this.section()}`;
      const id = this.original?.[this.prefix() + 'UUID'];
      if (this.conversion) await this.api.post(`${base}/${id}/conversion`, body);
      else if (this.original) await this.api.put(`${base}/${id}`, body);
      else await this.api.post(base, body);
      this.dialog?.close();
      await this.loadRecords(this.offset());
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      this.formError.set(/CONFLICT|IMMUTABLE/.test(code) ? 'crm.conflict' : /FORBIDDEN|UNAVAILABLE/.test(code) ? 'crm.accessChanged' : 'crm.saveError');
    } finally { this.saving.set(false); }
  }
}
