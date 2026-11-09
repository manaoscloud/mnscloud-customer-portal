import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContractsService } from './contracts.service';
import type {
  ContractAccount,
  ContractDocument,
  ContractEnvelope,
  ContractObligation,
  ContractTemplate,
  SignPendingItem,
} from './contracts.model';

export type ContractTab = 'myContracts' | 'envelopes' | 'reseller';

@Component({
  selector: 'mcp-contracts-page',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contracts-page.component.html',
  styleUrl: './contracts-page.component.scss',
})
export class ContractsPageComponent implements OnInit {
  private readonly contractsService = inject(ContractsService);

  readonly loading = signal(false);
  readonly signing = signal(false);
  readonly downloading = signal<string | null>(null);
  readonly error = signal('');
  readonly successMessage = signal('');
  readonly activeTab = signal<ContractTab>('myContracts');

  readonly signPending = signal<SignPendingItem[]>([]);
  readonly documents = signal<ContractDocument[]>([]);
  readonly documentsTotal = signal(0);
  readonly documentsOffset = signal(0);

  readonly envelopes = signal<ContractEnvelope[]>([]);
  readonly envelopesTotal = signal(0);
  readonly envelopesOffset = signal(0);

  readonly accounts = signal<ContractAccount[]>([]);
  readonly selectedAccount = signal<ContractAccount | null>(null);
  readonly templates = signal<ContractTemplate[]>([]);
  readonly obligations = signal<ContractObligation[]>([]);

  readonly selectedPendingToSign = signal<SignPendingItem | null>(null);

  searchDocs = '';
  searchEnvelopes = '';
  envelopeStatusFilter = '';
  searchTemplates = '';
  searchObligations = '';
  obligationStatusFilter = '';

  ngOnInit(): void {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [pending, acts] = await Promise.all([
        this.contractsService.listSignPending().catch(() => []),
        this.contractsService.listAccounts().catch(() => []),
      ]);
      this.signPending.set(pending);
      this.accounts.set(acts);
      if (acts.length > 0 && !this.selectedAccount()) {
        this.selectedAccount.set(acts[0]);
      }
      await Promise.all([this.loadDocuments(0), this.loadEnvelopes(0), this.loadResellerData()]);
    } catch {
      this.error.set('contracts.error');
    } finally {
      this.loading.set(false);
    }
  }

  async selectTab(tab: ContractTab): Promise<void> {
    this.activeTab.set(tab);
    this.error.set('');
    if (tab === 'reseller' && this.selectedAccount()) {
      await this.loadResellerData();
    }
  }

  async loadDocuments(offset = 0): Promise<void> {
    try {
      const res = await this.contractsService.listDocuments(this.searchDocs, 20, offset);
      this.documents.set(res.items);
      this.documentsTotal.set(res.total);
      this.documentsOffset.set(offset);
    } catch {
      this.error.set('contracts.error');
    }
  }

  async loadEnvelopes(offset = 0): Promise<void> {
    try {
      const res = await this.contractsService.listEnvelopes(
        this.searchEnvelopes,
        this.envelopeStatusFilter,
        20,
        offset,
      );
      this.envelopes.set(res.items);
      this.envelopesTotal.set(res.total);
      this.envelopesOffset.set(offset);
    } catch {
      this.error.set('contracts.error');
    }
  }

  async selectAccount(accountUuid: string): Promise<void> {
    const act = this.accounts().find((a) => a.CtaUUID === accountUuid) ?? null;
    this.selectedAccount.set(act);
    await this.loadResellerData();
  }

  async loadResellerData(): Promise<void> {
    const act = this.selectedAccount();
    if (!act) return;
    try {
      const [tpls, obls] = await Promise.all([
        this.contractsService.listTemplates(act.CtaUUID, this.searchTemplates, 50, 0),
        this.contractsService.listObligations(
          act.CtaUUID,
          this.searchObligations,
          this.obligationStatusFilter,
          50,
          0,
        ),
      ]);
      this.templates.set(tpls.items);
      this.obligations.set(obls.items);
    } catch {
      this.error.set('contracts.error');
    }
  }

  async downloadEnvelope(envelope: ContractEnvelope): Promise<void> {
    if (this.downloading()) return;
    this.downloading.set(envelope.CteUUID);
    this.error.set('');
    try {
      const blob = await this.contractsService.downloadEnvelope(envelope.CteUUID);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${envelope.CteTitle || 'contrato'}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.error.set('contracts.error');
    } finally {
      this.downloading.set(null);
    }
  }

  openSignModal(item: SignPendingItem): void {
    this.selectedPendingToSign.set(item);
  }

  closeSignModal(): void {
    this.selectedPendingToSign.set(null);
  }

  async confirmSign(): Promise<void> {
    const item = this.selectedPendingToSign();
    if (!item || this.signing()) return;
    this.signing.set(true);
    this.error.set('');
    try {
      const res = await this.contractsService.signEnvelope(item.CteUUID, item.CtsUUID, 'clickwrap');
      if (res.ok) {
        this.successMessage.set('contracts.signPending.success');
        this.closeSignModal();
        await this.loadAll();
      } else {
        this.error.set('contracts.error');
      }
    } catch {
      this.error.set('contracts.error');
    } finally {
      this.signing.set(false);
    }
  }
}
