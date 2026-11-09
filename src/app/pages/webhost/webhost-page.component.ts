import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type WebhostHost = {
  HwhUUID: string;
  HwhName: string;
  Domain: string;
  HwhUsername: string;
  HwhStatus: string;
  HwhProvisionStatus: string;
  PlanName: string;
  DiskQuotaMb: number;
  BandwidthQuotaMb: number;
  EmailAccountsMax: number;
  DatabasesMax: number;
  EmailsCount: number;
  DatabasesCount: number;
  ServerIp: string | null;
  Nameservers: string[] | null;
  CanEmails: number;
  CanDatabases: number;
  CanDns: number;
  HwhRevision: string;
  CreatedAt: string;
};

export type WebhostEmail = {
  HweUUID: string;
  HweLocalPart: string;
  Email: string;
  HweQuotaMb: number | null;
  HweStatus: string;
  HweProvisionStatus: string;
  CreatedAt: string;
};

export type WebhostDatabase = {
  HwdUUID: string;
  HwdName: string;
  HwdStatus: string;
  HwdProvisionStatus: string;
  CreatedAt: string;
};

export type WebhostDatabaseUser = {
  HduUUID: string;
  HduName: string;
  HduStatus: string;
  HduProvisionStatus: string;
  CreatedAt: string;
};

export type WebhostDatabaseGrant = {
  HdgUUID: string;
  DatabaseUUID: string;
  DatabaseName: string;
  UserUUID: string;
  UserName: string;
  Privileges: string[];
  HdgStatus: string;
  HdgProvisionStatus: string;
};

export type WebhostDatabaseData = {
  databases: WebhostDatabase[];
  users: WebhostDatabaseUser[];
  grants: WebhostDatabaseGrant[];
};

export type WebhostDnsRecord = {
  HwzUUID: string;
  HwzName: string;
  HwzType: string;
  HwzValue: string;
  HwzPriority: number | null;
  HwzWeight: number | null;
  HwzPort: number | null;
  HwzTtl: number;
  HwzManaged: number;
  HwzStatus: string;
  HwzProvisionStatus: string;
  CreatedAt: string;
};

type HostsResponse = {
  items: WebhostHost[];
};

type EmailsResponse = {
  items: WebhostEmail[];
};

type DnsResponse = {
  items: WebhostDnsRecord[];
};

@Component({
  selector: 'mcp-webhost-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'webhost.title' | transloco }}</h1>
          <p>{{ 'webhost.description' | transloco }}</p>
        </div>
      </header>

      @if (actionStatus()) {
        <div class="action-banner card" [class.success]="actionStatus() === 'success'" [class.error]="actionStatus() === 'error'">
          <span>{{ actionMessage() }}</span>
        </div>
      }

      @if (error()) {
        <p class="card" role="alert">{{ 'webhost.error' | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'webhost.loading' | transloco }}</p>
      } @else if (!error() && hosts().length === 0) {
        <p class="card">{{ 'webhost.empty' | transloco }}</p>
      }

      @if (hosts().length > 0) {
        <div class="hosts-grid">
          @for (host of hosts(); track host.HwhUUID) {
            <article
              class="card host-card"
              [class.selected]="selectedHost()?.HwhUUID === host.HwhUUID"
              (click)="selectHost(host)"
            >
              <div class="host-header">
                <span class="icon-badge">
                  <mat-icon>language</mat-icon>
                </span>
                <div class="host-titles">
                  <h2>{{ host.Domain }}</h2>
                  <small>{{ host.HwhName }} · {{ host.PlanName }}</small>
                </div>
              </div>
              <div class="host-status">
                <span class="badge" [class.badge-active]="host.HwhStatus === 'active'">
                  {{ host.HwhStatus === 'active' ? ('webhost.status.active' | transloco) : host.HwhStatus }}
                </span>
              </div>
            </article>
          }
        </div>

        @if (selectedHost(); as current) {
          <section class="host-details">
            <mat-tab-group animationDuration="0ms">
              <!-- Aba: Visão Geral -->
              <mat-tab [label]="'webhost.tab.overview' | transloco">
                <div class="tab-content">
                  <div class="specs-grid">
                    <div class="spec-item">
                      <span class="spec-label">{{ 'webhost.specs.domain' | transloco }}</span>
                      <strong class="spec-value">{{ current.Domain }}</strong>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">{{ 'webhost.specs.plan' | transloco }}</span>
                      <strong class="spec-value">{{ current.PlanName }}</strong>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">{{ 'webhost.specs.disk' | transloco }}</span>
                      <strong class="spec-value">{{ current.DiskQuotaMb }} MB</strong>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">{{ 'webhost.specs.bandwidth' | transloco }}</span>
                      <strong class="spec-value">{{ current.BandwidthQuotaMb }} MB</strong>
                    </div>
                    @if (current.ServerIp) {
                      <div class="spec-item">
                        <span class="spec-label">{{ 'webhost.specs.serverIp' | transloco }}</span>
                        <strong class="spec-value">{{ current.ServerIp }}</strong>
                      </div>
                    }
                    @if (current.Nameservers && current.Nameservers.length > 0) {
                      <div class="spec-item full-width">
                        <span class="spec-label">{{ 'webhost.specs.nameservers' | transloco }}</span>
                        <strong class="spec-value">{{ current.Nameservers.join(', ') }}</strong>
                      </div>
                    }
                  </div>
                </div>
              </mat-tab>

              <!-- Aba: E-mails -->
              @if (current.CanEmails) {
                <mat-tab [label]="'webhost.tab.emails' | transloco">
                  <div class="tab-content">
                    <div class="tab-actions-bar">
                      <button mat-flat-button color="primary" (click)="toggleCreateEmail()">
                        <mat-icon>add</mat-icon> {{ 'webhost.emails.createBtn' | transloco }}
                      </button>
                    </div>

                    @if (showCreateEmail()) {
                      <div class="card inline-form">
                        <div class="form-row">
                          <div class="form-group">
                            <label>{{ 'webhost.emails.localPart' | transloco }}</label>
                            <div class="input-suffix">
                              <input [(ngModel)]="emailLocalPart" placeholder="contato" />
                              <span class="suffix-label">&#64;{{ current.Domain }}</span>
                            </div>
                          </div>
                          <div class="form-group">
                            <label>{{ 'webhost.emails.quota' | transloco }}</label>
                            <input type="number" [(ngModel)]="emailQuotaMb" placeholder="500" />
                          </div>
                          <div class="form-group">
                            <label>{{ 'webhost.emails.password' | transloco }}</label>
                            <input type="password" [(ngModel)]="emailPassword" />
                          </div>
                        </div>
                        <div class="form-actions">
                          <button mat-flat-button color="primary" [disabled]="actionLoading() || !emailLocalPart()" (click)="createEmail(current)">
                            {{ 'webhost.emails.createSubmit' | transloco }}
                          </button>
                          <button mat-button (click)="toggleCreateEmail()">{{ 'webhost.emails.cancel' | transloco }}</button>
                        </div>
                      </div>
                    }

                    @if (loadingSub()) {
                      <p role="status">{{ 'webhost.loading' | transloco }}</p>
                    } @else if (emails().length === 0) {
                      <p class="card">{{ 'webhost.emails.empty' | transloco }}</p>
                    } @else {
                      <div class="resource-list">
                        @for (mail of emails(); track mail.HweUUID) {
                          <div class="card resource-item">
                            <div class="resource-main">
                              <mat-icon class="resource-icon">mail</mat-icon>
                              <div>
                                <strong>{{ mail.Email }}</strong>
                                <small>Quota: {{ mail.HweQuotaMb ? mail.HweQuotaMb + ' MB' : ('webhost.quotaUnlimited' | transloco) }}</small>
                              </div>
                            </div>
                            <div class="resource-actions">
                              <span class="badge" [class.badge-active]="mail.HweStatus === 'active'">
                                {{ mail.HweStatus === 'active' ? ('webhost.status.active' | transloco) : mail.HweStatus }}
                              </span>
                              <button mat-icon-button (click)="openQuotaModal(mail)" [title]="'webhost.emails.updateQuota' | transloco">
                                <mat-icon>data_usage</mat-icon>
                              </button>
                              <button mat-icon-button (click)="openPasswordModal(mail)" [title]="'webhost.emails.resetPassword' | transloco">
                                <mat-icon>vpn_key</mat-icon>
                              </button>
                              <button mat-icon-button color="warn" (click)="deleteEmail(current, mail)" [title]="'webhost.emails.delete' | transloco">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </div>
                          </div>

                          @if (editingQuotaEmailUUID() === mail.HweUUID) {
                            <div class="card inline-form edit-subcard">
                              <div class="form-row">
                                <div class="form-group">
                                  <label>{{ 'webhost.emails.newQuota' | transloco }}</label>
                                  <input type="number" [(ngModel)]="editQuotaValue" />
                                </div>
                              </div>
                              <div class="form-actions">
                                <button mat-flat-button color="primary" [disabled]="actionLoading()" (click)="saveEmailQuota(current, mail.HweUUID)">
                                  {{ 'webhost.emails.saveQuota' | transloco }}
                                </button>
                                <button mat-button (click)="cancelEditQuota()">{{ 'webhost.emails.cancel' | transloco }}</button>
                              </div>
                            </div>
                          }

                          @if (resettingPasswordEmailUUID() === mail.HweUUID) {
                            <div class="card inline-form edit-subcard">
                              <div class="form-row">
                                <div class="form-group">
                                  <label>{{ 'webhost.emails.newPassword' | transloco }}</label>
                                  <input type="password" [(ngModel)]="resetPasswordValue" />
                                </div>
                              </div>
                              <div class="form-actions">
                                <button mat-flat-button color="primary" [disabled]="actionLoading() || !resetPasswordValue()" (click)="saveEmailPassword(current, mail.HweUUID)">
                                  {{ 'webhost.emails.savePassword' | transloco }}
                                </button>
                                <button mat-button (click)="cancelResetPassword()">{{ 'webhost.emails.cancel' | transloco }}</button>
                              </div>
                            </div>
                          }
                        }
                      </div>
                    }
                  </div>
                </mat-tab>
              }

              <!-- Aba: Bancos de Dados -->
              @if (current.CanDatabases) {
                <mat-tab [label]="'webhost.tab.databases' | transloco">
                  <div class="tab-content">
                    <div class="db-section">
                      <div class="section-header">
                        <h4>{{ 'webhost.databases.title' | transloco }}</h4>
                        <button mat-stroked-button (click)="toggleCreateDb()">
                          <mat-icon>add</mat-icon> {{ 'webhost.databases.createDbBtn' | transloco }}
                        </button>
                      </div>

                      @if (showCreateDb()) {
                        <div class="card inline-form">
                          <div class="form-row">
                            <div class="form-group">
                              <label>{{ 'webhost.databases.dbName' | transloco }}</label>
                              <div class="input-prefix">
                                <span class="prefix-label">{{ current.HwhUsername }}_</span>
                                <input [(ngModel)]="dbName" placeholder="db" />
                              </div>
                            </div>
                          </div>
                          <div class="form-actions">
                            <button mat-flat-button color="primary" [disabled]="actionLoading() || !dbName()" (click)="createDatabase(current)">
                              {{ 'webhost.databases.createDbSubmit' | transloco }}
                            </button>
                            <button mat-button (click)="toggleCreateDb()">{{ 'webhost.emails.cancel' | transloco }}</button>
                          </div>
                        </div>
                      }

                      <div class="resource-list">
                        @for (db of databases()?.databases; track db.HwdUUID) {
                          <div class="card resource-item">
                            <div class="resource-main">
                              <mat-icon class="resource-icon">storage</mat-icon>
                              <strong>{{ db.HwdName }}</strong>
                            </div>
                            <div class="resource-actions">
                              <span class="badge" [class.badge-active]="db.HwdStatus === 'active'">{{ db.HwdStatus }}</span>
                              <button mat-icon-button color="warn" (click)="deleteDatabase(current, db)" [title]="'webhost.databases.delete' | transloco">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </div>
                          </div>
                        }
                      </div>

                      <div class="section-header mt-4">
                        <h4>{{ 'webhost.databases.users' | transloco }}</h4>
                        <button mat-stroked-button (click)="toggleCreateUser()">
                          <mat-icon>add</mat-icon> {{ 'webhost.databases.createUserBtn' | transloco }}
                        </button>
                      </div>

                      @if (showCreateUser()) {
                        <div class="card inline-form">
                          <div class="form-row">
                            <div class="form-group">
                              <label>{{ 'webhost.databases.username' | transloco }}</label>
                              <div class="input-prefix">
                                <span class="prefix-label">{{ current.HwhUsername }}_</span>
                                <input [(ngModel)]="dbUsername" placeholder="user" />
                              </div>
                            </div>
                            <div class="form-group">
                              <label>{{ 'webhost.databases.password' | transloco }}</label>
                              <input type="password" [(ngModel)]="dbUserPassword" />
                            </div>
                          </div>
                          <div class="form-actions">
                            <button mat-flat-button color="primary" [disabled]="actionLoading() || !dbUsername()" (click)="createDatabaseUser(current)">
                              {{ 'webhost.databases.createUserSubmit' | transloco }}
                            </button>
                            <button mat-button (click)="toggleCreateUser()">{{ 'webhost.emails.cancel' | transloco }}</button>
                          </div>
                        </div>
                      }

                      <div class="resource-list">
                        @for (user of databases()?.users; track user.HduUUID) {
                          <div class="card resource-item">
                            <div class="resource-main">
                              <mat-icon class="resource-icon">person</mat-icon>
                              <strong>{{ user.HduName }}</strong>
                            </div>
                            <div class="resource-actions">
                              <span class="badge" [class.badge-active]="user.HduStatus === 'active'">{{ user.HduStatus }}</span>
                              <button mat-icon-button color="warn" (click)="deleteDatabaseUser(current, user)" [title]="'webhost.databases.delete' | transloco">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </div>
                          </div>
                        }
                      </div>

                      <div class="section-header mt-4">
                        <h4>{{ 'webhost.databases.grants' | transloco }}</h4>
                        @if ((databases()?.databases?.length ?? 0) > 0 && (databases()?.users?.length ?? 0) > 0) {
                          <button mat-stroked-button (click)="toggleCreateGrant()">
                            <mat-icon>add</mat-icon> {{ 'webhost.databases.createGrantBtn' | transloco }}
                          </button>
                        }
                      </div>

                      @if (showCreateGrant()) {
                        <div class="card inline-form">
                          <div class="form-row">
                            <div class="form-group">
                              <label>{{ 'webhost.databases.selectDb' | transloco }}</label>
                              <select [(ngModel)]="grantDbUUID">
                                <option value="">-- {{ 'webhost.databases.selectDb' | transloco }} --</option>
                                @for (db of databases()?.databases; track db.HwdUUID) {
                                  <option [value]="db.HwdUUID">{{ db.HwdName }}</option>
                                }
                              </select>
                            </div>
                            <div class="form-group">
                              <label>{{ 'webhost.databases.selectUser' | transloco }}</label>
                              <select [(ngModel)]="grantUserUUID">
                                <option value="">-- {{ 'webhost.databases.selectUser' | transloco }} --</option>
                                @for (usr of databases()?.users; track usr.HduUUID) {
                                  <option [value]="usr.HduUUID">{{ usr.HduName }}</option>
                                }
                              </select>
                            </div>
                          </div>
                          <div class="form-actions">
                            <button mat-flat-button color="primary" [disabled]="actionLoading() || !grantDbUUID() || !grantUserUUID()" (click)="createDatabaseGrant(current)">
                              {{ 'webhost.databases.createGrantSubmit' | transloco }}
                            </button>
                            <button mat-button (click)="toggleCreateGrant()">{{ 'webhost.emails.cancel' | transloco }}</button>
                          </div>
                        </div>
                      }

                      @if ((databases()?.grants?.length ?? 0) === 0) {
                        <p class="card">{{ 'webhost.databases.grantsEmpty' | transloco }}</p>
                      } @else {
                        <div class="resource-list">
                          @for (grant of databases()?.grants; track grant.HdgUUID) {
                            <div class="card resource-item">
                              <div class="resource-main">
                                <mat-icon class="resource-icon">lock_open</mat-icon>
                                <div>
                                  <strong>{{ grant.DatabaseName }} &larr; {{ grant.UserName }}</strong>
                                  <small>Privileges: ALL</small>
                                </div>
                              </div>
                              <div class="resource-actions">
                                <span class="badge" [class.badge-active]="grant.HdgStatus === 'active'">{{ grant.HdgStatus }}</span>
                                <button mat-icon-button color="warn" (click)="deleteDatabaseGrant(current, grant)" [title]="'webhost.databases.delete' | transloco">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </mat-tab>
              }

              <!-- Aba: DNS -->
              @if (current.CanDns) {
                <mat-tab [label]="'webhost.tab.dns' | transloco">
                  <div class="tab-content">
                    <div class="tab-actions-bar">
                      <button mat-flat-button color="primary" (click)="toggleCreateDns()">
                        <mat-icon>add</mat-icon> {{ 'webhost.dns.createBtn' | transloco }}
                      </button>
                    </div>

                    @if (showCreateDns()) {
                      <div class="card inline-form">
                        <div class="form-row">
                          <div class="form-group">
                            <label>{{ 'webhost.dns.name' | transloco }}</label>
                            <input [(ngModel)]="dnsName" placeholder="sub.dominio.com." />
                          </div>
                          <div class="form-group">
                            <label>{{ 'webhost.dns.type' | transloco }}</label>
                            <select [(ngModel)]="dnsType">
                              <option value="A">A</option>
                              <option value="AAAA">AAAA</option>
                              <option value="CNAME">CNAME</option>
                              <option value="MX">MX</option>
                              <option value="TXT">TXT</option>
                              <option value="SRV">SRV</option>
                            </select>
                          </div>
                          <div class="form-group">
                            <label>{{ 'webhost.dns.value' | transloco }}</label>
                            <input [(ngModel)]="dnsValue" placeholder="192.0.2.1" />
                          </div>
                          <div class="form-group">
                            <label>{{ 'webhost.dns.ttl' | transloco }}</label>
                            <input type="number" [(ngModel)]="dnsTtl" placeholder="3600" />
                          </div>
                          @if (dnsType() === 'MX' || dnsType() === 'SRV') {
                            <div class="form-group">
                              <label>{{ 'webhost.dns.priority' | transloco }}</label>
                              <input type="number" [(ngModel)]="dnsPriority" placeholder="10" />
                            </div>
                          }
                        </div>
                        <div class="form-actions">
                          <button mat-flat-button color="primary" [disabled]="actionLoading() || !dnsName() || !dnsValue()" (click)="createDnsRecord(current)">
                            {{ 'webhost.dns.createSubmit' | transloco }}
                          </button>
                          <button mat-button (click)="toggleCreateDns()">{{ 'webhost.emails.cancel' | transloco }}</button>
                        </div>
                      </div>
                    }

                    @if (loadingSub()) {
                      <p role="status">{{ 'webhost.loading' | transloco }}</p>
                    } @else if (dnsRecords().length === 0) {
                      <p class="card">{{ 'webhost.dns.empty' | transloco }}</p>
                    } @else {
                      <div class="resource-list">
                        @for (rec of dnsRecords(); track rec.HwzUUID) {
                          <div class="card resource-item">
                            <div class="resource-main">
                              <span class="dns-type-tag">{{ rec.HwzType }}</span>
                              <div>
                                <strong>{{ rec.HwzName }}</strong>
                                <small>{{ rec.HwzValue }} (TTL: {{ rec.HwzTtl }})</small>
                              </div>
                            </div>
                            <div class="resource-actions">
                              <span class="badge" [class.badge-active]="rec.HwzStatus === 'active'">{{ rec.HwzStatus }}</span>
                              @if (!rec.HwzManaged) {
                                <button mat-icon-button color="warn" (click)="deleteDnsRecord(current, rec)" [title]="'webhost.dns.delete' | transloco">
                                  <mat-icon>delete</mat-icon>
                                </button>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </mat-tab>
              }

              <!-- Aba: Suporte -->
              <mat-tab [label]="'webhost.tab.support' | transloco">
                <div class="tab-content">
                  <div class="card support-box">
                    <mat-icon class="support-icon">support_agent</mat-icon>
                    <div>
                      <h3>{{ 'webhost.support.title' | transloco }}</h3>
                      <p>{{ 'webhost.support.text' | transloco }}</p>
                    </div>
                  </div>
                </div>
              </mat-tab>
            </mat-tab-group>
          </section>
        }
      }
    </section>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { margin: 0 0 4px 0; font-size: 1.75rem; }
    .page-header p { margin: 0; color: var(--mat-sys-on-surface-variant, #666); }
    .action-banner {
      padding: 12px 16px;
      margin-bottom: 16px;
      border-radius: 6px;
      font-weight: 500;
    }
    .action-banner.success { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
    .action-banner.error { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
    .hosts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .host-card {
      padding: 16px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      border: 1px solid var(--mat-sys-outline-variant, #e0e0e0);
    }
    .host-card.selected {
      border-color: var(--mat-sys-primary, #1976d2);
      box-shadow: 0 0 0 1px var(--mat-sys-primary, #1976d2);
    }
    .host-header { display: flex; align-items: center; gap: 12px; }
    .icon-badge {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container, #f5f5f5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-primary, #1976d2);
    }
    .host-titles h2 { margin: 0; font-size: 1rem; font-weight: 600; }
    .host-titles small { color: var(--mat-sys-on-surface-variant, #666); }
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      background: var(--mat-sys-surface-container, #eee);
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .badge.badge-active { background: #e8f5e9; color: #2e7d32; }
    .host-details { margin-top: 16px; }
    .tab-content { padding: 24px 0; }
    .tab-actions-bar { margin-bottom: 16px; }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .section-header h4 { margin: 0; font-size: 1.1rem; }
    .inline-form {
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid var(--mat-sys-primary, #1976d2);
      border-radius: 8px;
      background: var(--mat-sys-surface-container-low, #fafafa);
    }
    .edit-subcard {
      margin-top: 8px;
      border-color: var(--mat-sys-secondary, #455a64);
    }
    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 180px;
    }
    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .form-group input, .form-group select {
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid var(--mat-sys-outline, #ccc);
      font-size: 0.95rem;
      background: #fff;
    }
    .input-suffix, .input-prefix {
      display: flex;
      align-items: center;
      border: 1px solid var(--mat-sys-outline, #ccc);
      border-radius: 4px;
      background: #fff;
      overflow: hidden;
    }
    .input-suffix input, .input-prefix input {
      border: none;
      flex: 1;
      outline: none;
    }
    .suffix-label, .prefix-label {
      padding: 0 10px;
      background: var(--mat-sys-surface-container, #eee);
      color: var(--mat-sys-on-surface-variant, #666);
      font-size: 0.85rem;
      white-space: nowrap;
    }
    .form-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }
    .spec-item {
      padding: 16px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-low, #fafafa);
      border: 1px solid var(--mat-sys-outline-variant, #eee);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .spec-item.full-width { grid-column: 1 / -1; }
    .spec-label { font-size: 0.75rem; color: var(--mat-sys-on-surface-variant, #666); }
    .spec-value { font-size: 1rem; }
    .resource-list { display: flex; flex-direction: column; gap: 8px; }
    .resource-item {
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid var(--mat-sys-outline-variant, #eee);
    }
    .resource-main { display: flex; align-items: center; gap: 12px; }
    .resource-actions { display: flex; align-items: center; gap: 8px; }
    .resource-icon { color: var(--mat-sys-primary, #1976d2); }
    .resource-main div { display: flex; flex-direction: column; }
    .resource-main small { color: var(--mat-sys-on-surface-variant, #666); }
    .dns-type-tag {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--mat-sys-secondary-container, #e3f2fd);
      color: var(--mat-sys-on-secondary-container, #1565c0);
      min-width: 44px;
      text-align: center;
    }
    .mt-4 { margin-top: 24px; margin-bottom: 8px; }
    .support-box {
      padding: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      background: var(--mat-sys-surface-container-low, #fafafa);
      border: 1px solid var(--mat-sys-outline-variant, #eee);
    }
    .support-icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-primary, #1976d2); }
    .support-box h3 { margin: 0 0 8px 0; }
    .support-box p { margin: 0; color: var(--mat-sys-on-surface-variant, #666); }
  `],
})
export class WebhostPageComponent {
  private readonly api = inject(ApiService);

  readonly hosts = signal<WebhostHost[]>([]);
  readonly selectedHost = signal<WebhostHost | null>(null);
  readonly emails = signal<WebhostEmail[]>([]);
  readonly databases = signal<WebhostDatabaseData | null>(null);
  readonly dnsRecords = signal<WebhostDnsRecord[]>([]);

  readonly loading = signal(false);
  readonly loadingSub = signal(false);
  readonly error = signal(false);

  // Action status banner
  readonly actionLoading = signal(false);
  readonly actionStatus = signal<'success' | 'error' | null>(null);
  readonly actionMessage = signal<string>('');

  // Email form state
  readonly showCreateEmail = signal(false);
  readonly emailLocalPart = signal('');
  readonly emailQuotaMb = signal<number | null>(500);
  readonly emailPassword = signal('');
  readonly editingQuotaEmailUUID = signal<string | null>(null);
  readonly editQuotaValue = signal<number>(500);
  readonly resettingPasswordEmailUUID = signal<string | null>(null);
  readonly resetPasswordValue = signal('');

  // Database form state
  readonly showCreateDb = signal(false);
  readonly dbName = signal('');
  readonly showCreateUser = signal(false);
  readonly dbUsername = signal('');
  readonly dbUserPassword = signal('');
  readonly showCreateGrant = signal(false);
  readonly grantDbUUID = signal('');
  readonly grantUserUUID = signal('');

  // DNS form state
  readonly showCreateDns = signal(false);
  readonly dnsName = signal('');
  readonly dnsType = signal('A');
  readonly dnsValue = signal('');
  readonly dnsTtl = signal<number>(3600);
  readonly dnsPriority = signal<number | null>(null);

  constructor() {
    void this.loadHosts();
  }

  async loadHosts(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.get<ApiEnvelope<HostsResponse>>('customer-portal/webhost/hosts');
      const items = response.data?.items ?? [];
      this.hosts.set(items);
      if (items.length > 0) {
        await this.selectHost(items[0]);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  selectHost(host: WebhostHost): Promise<void> {
    this.selectedHost.set(host);
    return this.loadHostDetails(host);
  }

  async loadHostDetails(host: WebhostHost): Promise<void> {
    this.loadingSub.set(true);
    try {
      if (host.CanEmails) {
        const res = await this.api.get<ApiEnvelope<EmailsResponse>>(
          `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/emails`,
        );
        this.emails.set(res.data?.items ?? []);
      } else {
        this.emails.set([]);
      }

      if (host.CanDatabases) {
        const res = await this.api.get<ApiEnvelope<WebhostDatabaseData>>(
          `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/databases`,
        );
        this.databases.set(res.data ?? { databases: [], users: [], grants: [] });
      } else {
        this.databases.set(null);
      }

      if (host.CanDns) {
        const res = await this.api.get<ApiEnvelope<DnsResponse>>(
          `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/dns`,
        );
        this.dnsRecords.set(res.data?.items ?? []);
      } else {
        this.dnsRecords.set([]);
      }
    } catch {
      // Sub-resource failure does not fail the whole page
    } finally {
      this.loadingSub.set(false);
    }
  }

  // --- Emails Actions ---
  toggleCreateEmail(): void {
    this.showCreateEmail.set(!this.showCreateEmail());
  }

  async createEmail(host: WebhostHost): Promise<void> {
    const localPart = this.emailLocalPart().trim();
    if (!localPart) return;

    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.post(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/emails`,
        {
          localPart,
          quotaMb: this.emailQuotaMb() ?? undefined,
          password: this.emailPassword().trim() || undefined,
        },
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Conta de e-mail criada com sucesso.');
      this.showCreateEmail.set(false);
      this.emailLocalPart.set('');
      this.emailPassword.set('');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao criar conta de e-mail.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  openQuotaModal(mail: WebhostEmail): void {
    this.editingQuotaEmailUUID.set(mail.HweUUID);
    this.editQuotaValue.set(mail.HweQuotaMb ?? 500);
  }

  cancelEditQuota(): void {
    this.editingQuotaEmailUUID.set(null);
  }

  async saveEmailQuota(host: WebhostHost, emailUUID: string): Promise<void> {
    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.put(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/emails/${encodeURIComponent(emailUUID)}/quota`,
        { quotaMb: this.editQuotaValue() },
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Cota de e-mail atualizada.');
      this.editingQuotaEmailUUID.set(null);
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao atualizar cota.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  openPasswordModal(mail: WebhostEmail): void {
    this.resettingPasswordEmailUUID.set(mail.HweUUID);
    this.resetPasswordValue.set('');
  }

  cancelResetPassword(): void {
    this.resettingPasswordEmailUUID.set(null);
  }

  async saveEmailPassword(host: WebhostHost, emailUUID: string): Promise<void> {
    const pwd = this.resetPasswordValue().trim();
    if (!pwd) return;

    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.put(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/emails/${encodeURIComponent(emailUUID)}/password`,
        { password: pwd },
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Senha de e-mail redefinida com sucesso.');
      this.resettingPasswordEmailUUID.set(null);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao redefinir senha.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async deleteEmail(host: WebhostHost, mail: WebhostEmail): Promise<void> {
    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.delete(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/emails/${encodeURIComponent(mail.HweUUID)}`,
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Conta de e-mail removida.');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao remover e-mail.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  // --- Database Actions ---
  toggleCreateDb(): void {
    this.showCreateDb.set(!this.showCreateDb());
  }

  async createDatabase(host: WebhostHost): Promise<void> {
    const name = this.dbName().trim();
    if (!name) return;

    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.post(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/databases`,
        { name },
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Banco de dados criado com sucesso.');
      this.showCreateDb.set(false);
      this.dbName.set('');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao criar banco de dados.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async deleteDatabase(host: WebhostHost, db: WebhostDatabase): Promise<void> {
    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.delete(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/databases/${encodeURIComponent(db.HwdUUID)}`,
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Banco de dados removido.');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao remover banco de dados.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  toggleCreateUser(): void {
    this.showCreateUser.set(!this.showCreateUser());
  }

  async createDatabaseUser(host: WebhostHost): Promise<void> {
    const username = this.dbUsername().trim();
    if (!username) return;

    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.post(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/databases/users`,
        {
          username,
          password: this.dbUserPassword().trim() || undefined,
        },
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Usuário de banco de dados criado.');
      this.showCreateUser.set(false);
      this.dbUsername.set('');
      this.dbUserPassword.set('');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao criar usuário.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async deleteDatabaseUser(host: WebhostHost, user: WebhostDatabaseUser): Promise<void> {
    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.delete(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/databases/users/${encodeURIComponent(user.HduUUID)}`,
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Usuário de banco de dados removido.');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao remover usuário.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  toggleCreateGrant(): void {
    this.showCreateGrant.set(!this.showCreateGrant());
  }

  async createDatabaseGrant(host: WebhostHost): Promise<void> {
    const databaseUUID = this.grantDbUUID();
    const userUUID = this.grantUserUUID();
    if (!databaseUUID || !userUUID) return;

    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.post(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/databases/grants`,
        { databaseUUID, userUUID },
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Acesso concedido com sucesso.');
      this.showCreateGrant.set(false);
      this.grantDbUUID.set('');
      this.grantUserUUID.set('');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao conceder acesso ao banco.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async deleteDatabaseGrant(host: WebhostHost, grant: WebhostDatabaseGrant): Promise<void> {
    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.delete(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/databases/grants/${encodeURIComponent(grant.HdgUUID)}`,
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Acesso ao banco revogado.');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao revogar acesso ao banco.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  // --- DNS Actions ---
  toggleCreateDns(): void {
    this.showCreateDns.set(!this.showCreateDns());
  }

  async createDnsRecord(host: WebhostHost): Promise<void> {
    const name = this.dnsName().trim();
    const value = this.dnsValue().trim();
    if (!name || !value) return;

    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.post(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/dns`,
        {
          name,
          type: this.dnsType(),
          value,
          ttl: this.dnsTtl() || 3600,
          priority: this.dnsPriority() ?? undefined,
        },
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Registro DNS criado com sucesso.');
      this.showCreateDns.set(false);
      this.dnsName.set('');
      this.dnsValue.set('');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao criar registro DNS.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async deleteDnsRecord(host: WebhostHost, rec: WebhostDnsRecord): Promise<void> {
    this.actionLoading.set(true);
    this.actionStatus.set(null);
    try {
      await this.api.delete(
        `customer-portal/webhost/hosts/${encodeURIComponent(host.HwhUUID)}/dns/${encodeURIComponent(rec.HwzUUID)}`,
      );
      this.actionStatus.set('success');
      this.actionMessage.set('Registro DNS removido.');
      await this.loadHostDetails(host);
    } catch (err) {
      this.actionStatus.set('error');
      this.actionMessage.set(err instanceof Error ? err.message : 'Falha ao remover registro DNS.');
    } finally {
      this.actionLoading.set(false);
    }
  }
}
