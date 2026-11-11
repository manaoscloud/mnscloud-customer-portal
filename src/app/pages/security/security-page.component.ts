import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import type { ApiEnvelope } from '../../models/session.model';

export type SecurityAccount = {
  CyaUUID: string;
  CyaName: string;
  ServersCount: number;
  VaultsCount: number;
  Dashboard: number;
  Servers: number;
  Threats: number;
  AlertAck: number;
  Unblock: number;
  Secrets: number;
  SecretReveal: number;
  Vulnerabilities?: number;
  VulnAccept?: number;
};
type Dashboard = Record<string, number>;
type Server = {
  uuid: string;
  name: string;
  publicIP: string | null;
  osName: string | null;
  osVersion: string | null;
  firewallStatus: string;
  crowdsecStatus: string;
  bouncerStatus: string;
  protectionStatus: string;
  mode: string;
  lastSyncAt: string | null;
};
type Alert = {
  uuid: string;
  level: string;
  status: string;
  scenario: string | null;
  sourceIP: string | null;
  message: string;
  detectedAt: string | null;
  serverName: string | null;
};
type Block = {
  uuid: string;
  value: string;
  action: string;
  scenario: string | null;
  expiresAt: string | null;
  serverName: string | null;
  requestStatus: string | null;
};
type UnblockRequest = {
  uuid: string;
  value: string;
  reason: string | null;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
  requestedBy: string;
  blockExpiresAt: string | null;
};
type Vault = { uuid: string; name: string; secretsCount: number };
type Secret = {
  uuid: string;
  name: string;
  description: string | null;
  type: string;
  stored: number;
  expiresAt: string | null;
};
type Remediation = {
  action?: string;
  command?: string | null;
  restart?: string;
  advisory?: string | null;
  advisoryUrl?: string | null;
  links?: { kind: string; url: string }[];
};
export type Finding = {
  findingUUID: string;
  code: string;
  summary: string | null;
  cvssScore: number | null;
  kev: boolean;
  priority: string;
  status: string;
  serverName: string | null;
  package: string;
  installedVersion: string;
  fixedVersion: string | null;
  dueAt: string | null;
  overdue: boolean;
  riskAcceptedUntil: string | null;
  riskReason: string | null;
  riskAcceptedVia: string | null;
  remediation?: Remediation;
};
type ReportRow = Record<string, string | number | null>;
export type VulnerabilityReport = {
  month: string;
  generatedAt: string;
  accountName: string;
  servers: number;
  assessedServers: number;
  period: Record<string, number | null>;
  current: Record<string, number | null>;
  serversDetail: ReportRow[];
  topOpen: ReportRow[];
  acceptedItems: ReportRow[];
  /** Text the provider reviewed and published for the month (V5); null when none. */
  narrative?: string | null;
};
/** Hardening check of a server (V12); the portal translates the title and advice by code. */
export type HardeningCheck = {
  code: string;
  severity: string;
  status: string;
  evidence: string | null;
  failingSince: string | null;
};
export type HardeningServer = {
  uuid: string;
  name: string;
  platform: string | null;
  score: number | null;
  checksTotal: number;
  checksFailed: number;
  checksHighFailed: number;
  lastCheckedAt: string | null;
  antivirusEngine: string | null;
  antivirusInstalled: number | null;
  antivirusRealtime: number | null;
  activeThreats: number | null;
  checks: HardeningCheck[];
};
type NetworkDevice = {
  uuid: string;
  name: string;
  vendor: string | null;
  model: string | null;
  firmwareVersion: string | null;
  lastCollectedAt: string | null;
  openFindings: number;
  urgentFindings: number;
  kevFindings: number;
};
type NetworkFinding = {
  findingUUID: string;
  deviceName: string;
  code: string;
  summary: string | null;
  cvssScore: number | null;
  kev: boolean | number;
  priority: string;
  firmwareVersion: string | null;
  fixedVersion: string | null;
};
export type SecurityTab =
  | 'dashboard'
  | 'servers'
  | 'hardening'
  | 'threats'
  | 'vulnerabilities'
  | 'network'
  | 'report'
  | 'secrets';

const TABS: readonly [SecurityTab, keyof SecurityAccount, string][] = [
  ['dashboard', 'Dashboard', 'space_dashboard'],
  ['servers', 'Servers', 'dns'],
  ['hardening', 'Servers', 'rule'],
  ['threats', 'Threats', 'gpp_maybe'],
  ['vulnerabilities', 'Vulnerabilities', 'bug_report'],
  ['network', 'Vulnerabilities', 'router'],
  ['report', 'Vulnerabilities', 'summarize'],
  ['secrets', 'Secrets', 'key'],
];

/** Check codes the portal knows (same catalog as the App); others show the raw code. */
export const CHECK_CODES: readonly string[] = [
  'accounts.empty_password',
  'accounts.pass_max_days',
  'accounts.uid0',
  'audit.auditd',
  'files.passwd_permissions',
  'files.shadow_permissions',
  'firewall.active',
  'mac.auto_install',
  'mac.auto_login',
  'mac.filevault',
  'mac.firewall',
  'mac.firewall_stealth',
  'mac.gatekeeper',
  'mac.guest_account',
  'mac.screen_sharing',
  'mac.security_updates',
  'mac.sip',
  'mac.ssh_password_auth',
  'mac.update_check',
  'mac.updates_pending',
  'ssh.empty_passwords',
  'ssh.max_auth_tries',
  'ssh.password_auth',
  'ssh.root_login',
  'ssh.x11_forwarding',
  'sysctl.accept_redirects',
  'sysctl.aslr',
  'sysctl.dmesg_restrict',
  'sysctl.rp_filter',
  'sysctl.send_redirects',
  'sysctl.source_route',
  'sysctl.suid_dumpable',
  'sysctl.syncookies',
  'time.sync',
  'win.autorun_disabled',
  'win.firewall_profiles',
  'win.guest_disabled',
  'win.llmnr_disabled',
  'win.lockout_threshold',
  'win.lsa_protection',
  'win.password_complexity',
  'win.password_length',
  'win.rdp_nla',
  'win.smb1_disabled',
  'win.smb_signing',
  'win.tls10_disabled',
  'win.uac_enabled',
  'win.update_service',
  'win.wdigest_disabled',
];

/** Translation key of a check title, or null for a code this portal does not know yet. */
export function checkKey(kind: 'checkTitle' | 'checkAdvice', code: string): string | null {
  return CHECK_CODES.includes(code) ? `security.${kind}.${code}` : null;
}

/** Failed checks first (high before medium before low), then the rest by code. */
export function sortChecks(checks: HardeningCheck[]): HardeningCheck[] {
  const severity: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const status: Record<string, number> = { fail: 0, error: 1, pass: 2, not_applicable: 3 };
  return [...checks].sort((a, b) =>
    (status[a.status] ?? 4) - (status[b.status] ?? 4) ||
    (severity[a.severity] ?? 3) - (severity[b.severity] ?? 3) ||
    a.code.localeCompare(b.code)
  );
}

const ANTIVIRUS_NAMES: Record<string, string> = { defender: 'Microsoft Defender', clamav: 'ClamAV', xprotect: 'XProtect' };

/** Antivirus name of a server (null when there is none). */
export function antivirusName(server: HardeningServer): string | null {
  return server.antivirusEngine && Number(server.antivirusInstalled) === 1
    ? (ANTIVIRUS_NAMES[server.antivirusEngine] ?? server.antivirusEngine)
    : null;
}
const FINDING_STATUSES = ['open', 'accepted_risk', 'fixed', 'all'] as const;
const PERIOD_METRICS = ['opened', 'openedP0', 'fixed', 'fixedOnTime', 'fixedLate', 'accepted', 'riskExpired'];
const CURRENT_METRICS = ['open', 'p0', 'p1', 'p2', 'p3', 'overdue', 'kev', 'acceptedRisks'];

/** The last 13 months (YYYY-MM), newest first, as the report accepts them. */
/** Paragraphs of the report text published by the provider (blank lines split them). */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '').split(/\n\s*\n|\r\n\s*\r\n/).map((part) => part.trim()).filter(Boolean);
}

export function reportMonths(now = new Date()): string[] {
  return Array.from({ length: 13 }, (_, back) => {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

/** Latest valid day of a risk acceptance (one year ahead) and the earliest (today), as YYYY-MM-DD. */
export function acceptanceBounds(now = new Date()): { min: string; max: string } {
  const day = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 365);
  return { min: day(now), max: day(max) };
}

/** Whether the customer may accept the risk of this finding now. */
export function canAcceptRisk(account: SecurityAccount | null, finding: Finding): boolean {
  return Number(account?.VulnAccept) === 1 && finding.status === 'open';
}
const PAGE = 50;
const METRICS = [
  'servers', 'protectedServers', 'attentionServers', 'openAlerts', 'alerts24h',
  'activeDecisions', 'pendingUnblockRequests', 'vaults', 'secrets',
];
const KNOWN = {
  protection: ['unprotected', 'pending', 'protected', 'partial', 'error'],
  service: ['unknown', 'missing', 'running', 'stopped', 'error'],
  alert: ['open', 'acknowledged', 'resolved', 'ignored'],
  level: ['info', 'warning', 'error', 'critical'],
  request: ['pending', 'approved', 'rejected'],
  priority: ['P0', 'P1', 'P2', 'P3', 'info'],
  finding: ['open', 'accepted_risk', 'fixed', 'false_positive'],
  severity: ['high', 'medium', 'low'],
  check: ['pass', 'fail', 'not_applicable', 'error'],
  secret: ['generic', 'runtime_env', 'api_token', 'password', 'certificate', 'ssh_key', 'database'],
} as const;
/** A revealed value disappears from the screen after this many milliseconds. */
export const REVEAL_VISIBLE_MS = 60_000;

/** Translation key of a server-provided state; unknown values fall back to a neutral label. */
export function stateKey(kind: keyof typeof KNOWN, value: string | null | undefined): string {
  const known = KNOWN[kind] as readonly string[];
  return `security.states.${kind}.${value && known.includes(value) ? value : 'other'}`;
}

/** Whether the customer may ask to lift this block now. */
export function canRequestUnblock(account: SecurityAccount | null, block: Block): boolean {
  return Number(account?.Unblock) === 1 && block.requestStatus !== 'pending';
}

/** Security of the Cyber Security accounts the provider published to this customer, by grant. */
@Component({
  selector: 'mcp-security-page',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <h1>{{ 'security.title' | transloco }}</h1>
          <p>{{ 'security.description' | transloco }}</p>
        </div>
      </header>

      @if (error()) {
        <p class="card" role="alert">{{ error()! | transloco }}</p>
      }
      @if (loading()) {
        <p role="status">{{ 'security.loading' | transloco }}</p>
      } @else if (!error() && accounts().length === 0) {
        <p class="card">{{ 'security.empty' | transloco }}</p>
      }

      @if (accounts().length > 1) {
        <mat-form-field class="account-select">
          <mat-label>{{ 'security.account' | transloco }}</mat-label>
          <mat-select [value]="account()?.CyaUUID" (valueChange)="selectAccount($event)">
            @for (item of accounts(); track item.CyaUUID) {
              <mat-option [value]="item.CyaUUID">{{ item.CyaName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      } @else if (account()) {
        <p class="account-name">{{ account()!.CyaName }}</p>
      }

      @if (account()) {
        <nav class="tabs" [attr.aria-label]="'security.sections' | transloco">
          @for (item of tabs(); track item[0]) {
            <button
              matButton
              type="button"
              [class.active]="tab() === item[0]"
              [attr.aria-pressed]="tab() === item[0]"
              (click)="openTab(item[0])"
            >
              <mat-icon>{{ item[2] }}</mat-icon>{{ 'security.tabs.' + item[0] | transloco }}
            </button>
          }
        </nav>

        @if (notice()) {
          <p class="card notice" role="status">{{ notice()! | transloco }}</p>
        }
        @if (busy()) {
          <p role="status">{{ 'security.loading' | transloco }}</p>
        } @else {
          @switch (tab()) {
            @case ('dashboard') {
              @if (dashboard(); as data) {
                <div class="metrics">
                  @for (metric of metrics; track metric) {
                    <article class="card metric">
                      <span class="metric-value">{{ data[metric] ?? 0 }}</span>
                      <span>{{ 'security.metrics.' + metric | transloco }}</span>
                    </article>
                  }
                </div>
              }
            }
            @case ('servers') {
              @if (servers().length === 0) {
                <p class="card">{{ 'security.emptyServers' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.server' | transloco }}</th>
                        <th scope="col">{{ 'security.protection' | transloco }}</th>
                        <th scope="col">{{ 'security.mode' | transloco }}</th>
                        <th scope="col">{{ 'security.firewall' | transloco }}</th>
                        <th scope="col">{{ 'security.crowdsec' | transloco }}</th>
                        <th scope="col">{{ 'security.bouncer' | transloco }}</th>
                        <th scope="col">{{ 'security.lastSync' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of servers(); track item.uuid) {
                        <tr>
                          <td>
                            {{ item.name }}
                            @if (item.publicIP) { <span class="hint">{{ item.publicIP }}</span> }
                          </td>
                          <td><span class="badge">{{ stateKey('protection', item.protectionStatus) | transloco }}</span></td>
                          <td>{{ (item.mode === 'enforce' ? 'security.modeEnforce' : 'security.modeMonitor') | transloco }}</td>
                          <td>{{ stateKey('service', item.firewallStatus) | transloco }}</td>
                          <td>{{ stateKey('service', item.crowdsecStatus) | transloco }}</td>
                          <td>{{ stateKey('service', item.bouncerStatus) | transloco }}</td>
                          <td>{{ when(item.lastSyncAt) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
            @case ('threats') {
              <h2>{{ 'security.alerts' | transloco }}</h2>
              <div class="toolbar">
                <mat-form-field>
                  <mat-label>{{ 'security.alertStatus' | transloco }}</mat-label>
                  <mat-select [value]="alertStatus()" (valueChange)="alertStatus.set($event); loadAlerts(0)">
                    <mat-option value="">{{ 'security.all' | transloco }}</mat-option>
                    @for (status of alertStatuses; track status) {
                      <mat-option [value]="status">{{ stateKey('alert', status) | transloco }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              @if (alerts().length === 0) {
                <p class="card">{{ 'security.emptyAlerts' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.detectedAt' | transloco }}</th>
                        <th scope="col">{{ 'security.level' | transloco }}</th>
                        <th scope="col">{{ 'security.server' | transloco }}</th>
                        <th scope="col">{{ 'security.sourceIP' | transloco }}</th>
                        <th scope="col">{{ 'security.message' | transloco }}</th>
                        <th scope="col">{{ 'security.alertStatus' | transloco }}</th>
                        @if (canAck()) { <th scope="col"><span class="visually-hidden">{{ 'security.actions' | transloco }}</span></th> }
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of alerts(); track item.uuid) {
                        <tr>
                          <td>{{ when(item.detectedAt) }}</td>
                          <td>{{ stateKey('level', item.level) | transloco }}</td>
                          <td>{{ item.serverName ?? '—' }}</td>
                          <td>{{ item.sourceIP ?? '—' }}</td>
                          <td class="wrap">{{ item.message }}</td>
                          <td><span class="badge">{{ stateKey('alert', item.status) | transloco }}</span></td>
                          @if (canAck()) {
                            <td>
                              @if (item.status === 'open') {
                                <button matButton type="button" (click)="acknowledge(item)">{{ 'security.acknowledge' | transloco }}</button>
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <nav class="pagination" [attr.aria-label]="'security.pagination' | transloco">
                  <button matButton type="button" [disabled]="alertOffset() === 0" (click)="loadAlerts(alertOffset() - page)">
                    {{ 'security.previous' | transloco }}
                  </button>
                  <button matButton type="button" [disabled]="alertOffset() + page >= alertTotal()" (click)="loadAlerts(alertOffset() + page)">
                    {{ 'security.next' | transloco }}
                  </button>
                </nav>
              }

              <h2>{{ 'security.blocks' | transloco }}</h2>
              @if (blocks().length === 0) {
                <p class="card">{{ 'security.emptyBlocks' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.blockedIP' | transloco }}</th>
                        <th scope="col">{{ 'security.server' | transloco }}</th>
                        <th scope="col">{{ 'security.scenario' | transloco }}</th>
                        <th scope="col">{{ 'security.expiresAt' | transloco }}</th>
                        <th scope="col">{{ 'security.request' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of blocks(); track item.uuid) {
                        <tr>
                          <td>{{ item.value }}</td>
                          <td>{{ item.serverName ?? '—' }}</td>
                          <td>{{ item.scenario ?? '—' }}</td>
                          <td>{{ item.expiresAt ? when(item.expiresAt) : ('security.noExpiry' | transloco) }}</td>
                          <td>
                            @if (item.requestStatus) {
                              <span class="badge">{{ stateKey('request', item.requestStatus) | transloco }}</span>
                            }
                            @if (canRequestUnblock(account(), item)) {
                              <button matButton type="button" (click)="startRequest(item)">{{ 'security.requestUnblock' | transloco }}</button>
                            }
                          </td>
                        </tr>
                        @if (requesting() === item.uuid) {
                          <tr>
                            <td colspan="5">
                              <form class="request-form" (ngSubmit)="sendRequest(item)">
                                <mat-form-field>
                                  <mat-label>{{ 'security.reason' | transloco }}</mat-label>
                                  <textarea matInput name="reason" rows="3" maxlength="500" [(ngModel)]="reason"></textarea>
                                </mat-form-field>
                                <div class="actions">
                                  <button matButton type="button" (click)="requesting.set(null)">{{ 'security.cancel' | transloco }}</button>
                                  <button matButton="filled" type="submit">{{ 'security.send' | transloco }}</button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
              }

              <h2>{{ 'security.requests' | transloco }}</h2>
              @if (requests().length === 0) {
                <p class="card">{{ 'security.emptyRequests' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.requestedAt' | transloco }}</th>
                        <th scope="col">{{ 'security.blockedIP' | transloco }}</th>
                        <th scope="col">{{ 'security.requestedBy' | transloco }}</th>
                        <th scope="col">{{ 'security.request' | transloco }}</th>
                        <th scope="col">{{ 'security.answer' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of requests(); track item.uuid) {
                        <tr>
                          <td>{{ when(item.createdAt) }}</td>
                          <td>{{ item.value }}</td>
                          <td>{{ item.requestedBy }}</td>
                          <td><span class="badge">{{ stateKey('request', item.status) | transloco }}</span></td>
                          <td class="wrap">{{ item.resolutionNote ?? '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }
            @case ('vulnerabilities') {
              <div class="toolbar">
                <mat-form-field>
                  <mat-label>{{ 'security.findingStatus' | transloco }}</mat-label>
                  <mat-select [value]="findingStatus()" (valueChange)="findingStatus.set($event); loadFindings(0)">
                    @for (status of findingStatuses; track status) {
                      <mat-option [value]="status">{{ (status === 'all' ? 'security.all' : stateKey('finding', status)) | transloco }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              <p class="hint">{{ 'security.vulnerabilitiesHint' | transloco }}</p>
              @if (findings().length === 0) {
                <p class="card">{{ 'security.emptyFindings' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.priority' | transloco }}</th>
                        <th scope="col">{{ 'security.vulnerability' | transloco }}</th>
                        <th scope="col">{{ 'security.server' | transloco }}</th>
                        <th scope="col">{{ 'security.package' | transloco }}</th>
                        <th scope="col">{{ 'security.due' | transloco }}</th>
                        <th scope="col">{{ 'security.findingStatus' | transloco }}</th>
                        <th scope="col"><span class="visually-hidden">{{ 'security.actions' | transloco }}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of findings(); track item.findingUUID) {
                        <tr>
                          <td><span class="badge" [class.urgent]="item.priority === 'P0'">{{ stateKey('priority', item.priority) | transloco }}</span></td>
                          <td class="wrap">
                            {{ item.code }}
                            @if (item.kev) { <span class="badge urgent">KEV</span> }
                            @if (item.summary) { <span class="hint">{{ item.summary }}</span> }
                          </td>
                          <td>{{ item.serverName ?? '—' }}</td>
                          <td>
                            {{ item.package }}
                            <span class="hint">{{ item.installedVersion }} → {{ item.fixedVersion ?? ('security.noFix' | transloco) }}</span>
                          </td>
                          <td>
                            {{ when(item.dueAt) }}
                            @if (item.overdue) { <span class="badge urgent">{{ 'security.overdue' | transloco }}</span> }
                          </td>
                          <td>
                            <span class="badge">{{ stateKey('finding', item.status) | transloco }}</span>
                            @if (item.status === 'accepted_risk') {
                              <span class="hint">{{ 'security.acceptedUntil' | transloco }} {{ when(item.riskAcceptedUntil) }}</span>
                            }
                          </td>
                          <td>
                            <button matButton type="button" (click)="toggleFix(item)">{{ 'security.howToFix' | transloco }}</button>
                            @if (canAcceptRisk(account(), item)) {
                              <button matButton type="button" (click)="startAccept(item)">{{ 'security.acceptRisk' | transloco }}</button>
                            }
                          </td>
                        </tr>
                        @if (fixing() === item.findingUUID) {
                          <tr>
                            <td colspan="7" class="wrap detail">
                              @if (item.remediation?.action === 'update' && item.remediation?.command) {
                                <strong>{{ 'security.updateCommand' | transloco }}</strong>
                                <code class="command">{{ item.remediation!.command }}</code>
                                <button matButton type="button" (click)="copy(item.remediation!.command!)">{{ 'security.copy' | transloco }}</button>
                              } @else {
                                <strong>{{ 'security.mitigate' | transloco }}</strong>
                                <p>{{ 'security.mitigateSteps' | transloco }}</p>
                              }
                              <p>{{ 'security.restart.' + (item.remediation?.restart ?? 'service') | transloco }}</p>
                              @if (item.remediation?.advisory) {
                                <p>{{ 'security.advisory' | transloco }}: {{ item.remediation!.advisory }}</p>
                              }
                              @if (item.riskReason) {
                                <p>{{ 'security.acceptReason' | transloco }}: {{ item.riskReason }}</p>
                              }
                            </td>
                          </tr>
                        }
                        @if (accepting() === item.findingUUID) {
                          <tr>
                            <td colspan="7">
                              <form class="request-form" (ngSubmit)="sendAccept(item)">
                                <p class="hint">{{ 'security.acceptHint' | transloco }}</p>
                                <mat-form-field>
                                  <mat-label>{{ 'security.acceptUntil' | transloco }}</mat-label>
                                  <input matInput type="date" name="acceptUntil" required [min]="bounds.min" [max]="bounds.max" [(ngModel)]="acceptUntil" />
                                </mat-form-field>
                                <mat-form-field>
                                  <mat-label>{{ 'security.acceptReason' | transloco }}</mat-label>
                                  <textarea matInput name="acceptReason" rows="3" minlength="5" maxlength="500" required [(ngModel)]="acceptReason"></textarea>
                                </mat-form-field>
                                <div class="actions">
                                  <button matButton type="button" (click)="accepting.set(null)">{{ 'security.cancel' | transloco }}</button>
                                  <button matButton="filled" type="submit">{{ 'security.acceptRisk' | transloco }}</button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
                <nav class="pagination" [attr.aria-label]="'security.pagination' | transloco">
                  <button matButton type="button" [disabled]="findingOffset() === 0" (click)="loadFindings(findingOffset() - page)">
                    {{ 'security.previous' | transloco }}
                  </button>
                  <button matButton type="button" [disabled]="findingOffset() + page >= findingTotal()" (click)="loadFindings(findingOffset() + page)">
                    {{ 'security.next' | transloco }}
                  </button>
                </nav>
              }
            }
            @case ('hardening') {
              @if (hardening().length === 0) {
                <p class="card">{{ 'security.emptyHardening' | transloco }}</p>
              }
              @for (server of hardening(); track server.uuid) {
                <article class="card">
                  <h2>{{ server.name }}</h2>
                  <p class="hint">
                    {{ 'security.score' | transloco }}: {{ server.score ?? '—' }} ·
                    {{ 'security.antivirus' | transloco }}:
                    @if (antivirusName(server); as engine) {
                      {{ engine }} ({{ (server.antivirusRealtime ? 'security.realtime' : 'security.onDemand') | transloco }})
                    } @else {
                      {{ 'security.antivirusNone' | transloco }}
                    }
                    · {{ 'security.activeThreats' | transloco }}: {{ server.activeThreats ?? 0 }} ·
                    {{ 'security.lastChecked' | transloco }}: {{ when(server.lastCheckedAt) }}
                  </p>
                  <div class="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{{ 'security.check' | transloco }}</th>
                          <th scope="col">{{ 'security.severity' | transloco }}</th>
                          <th scope="col">{{ 'security.checkStatus' | transloco }}</th>
                          <th scope="col">{{ 'security.evidence' | transloco }}</th>
                          <th scope="col">{{ 'security.howToFix' | transloco }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (check of server.checks; track check.code) {
                          <tr>
                            <td>
                              @if (checkKey('checkTitle', check.code); as key) { {{ key | transloco }} } @else { {{ check.code }} }
                            </td>
                            <td>{{ stateKey('severity', check.severity) | transloco }}</td>
                            <td><span class="badge">{{ stateKey('check', check.status) | transloco }}</span></td>
                            <td class="wrap">{{ check.evidence ?? '—' }}</td>
                            <td class="wrap">
                              @if (check.status === 'fail') {
                                @if (checkKey('checkAdvice', check.code); as key) { {{ key | transloco }} }
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </article>
              }
            }
            @case ('network') {
              @if (networkDevices().length === 0) {
                <p class="card">{{ 'security.emptyNetwork' | transloco }}</p>
              } @else {
                <div class="table-wrap card">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{{ 'security.device' | transloco }}</th>
                        <th scope="col">{{ 'security.model' | transloco }}</th>
                        <th scope="col">{{ 'security.firmware' | transloco }}</th>
                        <th scope="col">{{ 'security.openFindings' | transloco }}</th>
                        <th scope="col">{{ 'security.urgentFindings' | transloco }}</th>
                        <th scope="col">KEV</th>
                        <th scope="col">{{ 'security.lastCollected' | transloco }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of networkDevices(); track item.uuid) {
                        <tr>
                          <td>{{ item.name }}</td>
                          <td>{{ item.model ?? '—' }}</td>
                          <td>{{ item.firmwareVersion ?? '—' }}</td>
                          <td>{{ item.openFindings }}</td>
                          <td>{{ item.urgentFindings }}</td>
                          <td>{{ item.kevFindings }}</td>
                          <td>{{ when(item.lastCollectedAt) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <h2>{{ 'security.networkFindings' | transloco }}</h2>
                @if (networkFindings().length === 0) {
                  <p class="card">{{ 'security.emptyNetworkFindings' | transloco }}</p>
                } @else {
                  <div class="table-wrap card">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{{ 'security.device' | transloco }}</th>
                          <th scope="col">CVE</th>
                          <th scope="col">{{ 'security.priority' | transloco }}</th>
                          <th scope="col">CVSS</th>
                          <th scope="col">{{ 'security.firmware' | transloco }}</th>
                          <th scope="col">{{ 'security.fixedVersion' | transloco }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of networkFindings(); track item.findingUUID) {
                          <tr>
                            <td>{{ item.deviceName }}</td>
                            <td class="wrap">
                              {{ item.code }}@if (item.kev) { <span class="badge">KEV</span> }
                              @if (item.summary) { <span class="hint">{{ item.summary }}</span> }
                            </td>
                            <td><span class="badge">{{ stateKey('priority', item.priority) | transloco }}</span></td>
                            <td>{{ item.cvssScore ?? '—' }}</td>
                            <td>{{ item.firmwareVersion ?? '—' }}</td>
                            <td>{{ item.fixedVersion ?? '—' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
            }
            @case ('report') {
              <div class="toolbar no-print">
                <mat-form-field>
                  <mat-label>{{ 'security.reportMonth' | transloco }}</mat-label>
                  <mat-select [value]="reportMonth()" (valueChange)="reportMonth.set($event); loadReport()">
                    @for (month of months; track month) {
                      <mat-option [value]="month">{{ month }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button matButton type="button" (click)="print()"><mat-icon>print</mat-icon>{{ 'security.print' | transloco }}</button>
              </div>
              @if (report(); as data) {
                <article class="report">
                  <h2>{{ 'security.reportTitle' | transloco }} · {{ data.accountName }} · {{ data.month }}</h2>
                  <p class="hint">{{ 'security.reportServers' | transloco }}: {{ data.servers }} · {{ 'security.reportAssessed' | transloco }}: {{ data.assessedServers }} · {{ 'security.reportGenerated' | transloco }} {{ when(data.generatedAt) }}</p>
                  @if (data.narrative) {
                    <h2>{{ 'security.reportNarrative' | transloco }}</h2>
                    <div class="card narrative">
                      @for (paragraph of paragraphs(data.narrative); track $index) {
                        <p>{{ paragraph }}</p>
                      }
                    </div>
                  }
                  <h2>{{ 'security.reportPeriod' | transloco }}</h2>
                  <div class="metrics">
                    @for (metric of periodMetrics; track metric) {
                      <article class="card metric">
                        <span class="metric-value">{{ data.period[metric] ?? 0 }}</span>
                        <span>{{ 'security.report.' + metric | transloco }}</span>
                      </article>
                    }
                  </div>
                  <h2>{{ 'security.reportCurrent' | transloco }}</h2>
                  <div class="metrics">
                    @for (metric of currentMetrics; track metric) {
                      <article class="card metric">
                        <span class="metric-value">{{ data.current[metric] ?? 0 }}</span>
                        <span>{{ 'security.report.' + metric | transloco }}</span>
                      </article>
                    }
                  </div>
                  <h2>{{ 'security.reportTopOpen' | transloco }}</h2>
                  @if (data.topOpen.length === 0) {
                    <p class="card">{{ 'security.emptyFindings' | transloco }}</p>
                  } @else {
                    <div class="table-wrap card">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">{{ 'security.priority' | transloco }}</th>
                            <th scope="col">{{ 'security.vulnerability' | transloco }}</th>
                            <th scope="col">{{ 'security.server' | transloco }}</th>
                            <th scope="col">{{ 'security.package' | transloco }}</th>
                            <th scope="col">{{ 'security.due' | transloco }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of data.topOpen; track $index) {
                            <tr>
                              <td>{{ stateKey('priority', '' + item['priority']) | transloco }}</td>
                              <td>{{ item['code'] }}</td>
                              <td>{{ item['server'] }}</td>
                              <td>{{ item['package'] }}</td>
                              <td>{{ when('' + (item['dueAt'] ?? '')) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                  <h2>{{ 'security.reportPerServer' | transloco }}</h2>
                  @if (data.serversDetail.length === 0) {
                    <p class="card">{{ 'security.emptyFindings' | transloco }}</p>
                  } @else {
                    <div class="table-wrap card">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">{{ 'security.server' | transloco }}</th>
                            <th scope="col">{{ 'security.report.open' | transloco }}</th>
                            <th scope="col">P0</th>
                            <th scope="col">P1</th>
                            <th scope="col">{{ 'security.report.overdue' | transloco }}</th>
                            <th scope="col">{{ 'security.report.acceptedRisks' | transloco }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of data.serversDetail; track $index) {
                            <tr>
                              <td>{{ item['server'] }}</td>
                              <td>{{ item['open'] }}</td>
                              <td>{{ item['p0'] }}</td>
                              <td>{{ item['p1'] }}</td>
                              <td>{{ item['overdue'] }}</td>
                              <td>{{ item['acceptedRisks'] }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                  <h2>{{ 'security.reportAccepted' | transloco }}</h2>
                  @if (data.acceptedItems.length === 0) {
                    <p class="card">{{ 'security.emptyAccepted' | transloco }}</p>
                  } @else {
                    <div class="table-wrap card">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">{{ 'security.vulnerability' | transloco }}</th>
                            <th scope="col">{{ 'security.server' | transloco }}</th>
                            <th scope="col">{{ 'security.acceptUntil' | transloco }}</th>
                            <th scope="col">{{ 'security.acceptReason' | transloco }}</th>
                            <th scope="col">{{ 'security.acceptedBy' | transloco }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of data.acceptedItems; track $index) {
                            <tr>
                              <td>{{ item['code'] }}</td>
                              <td>{{ item['server'] }}</td>
                              <td>{{ when('' + (item['until'] ?? '')) }}</td>
                              <td class="wrap">{{ item['reason'] }}</td>
                              <td>{{ (item['via'] === 'portal' ? 'security.acceptedByCustomer' : 'security.acceptedByProvider') | transloco }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </article>
              }
            }
            @case ('secrets') {
              @if (vaults().length === 0) {
                <p class="card">{{ 'security.emptyVaults' | transloco }}</p>
              } @else {
                <div class="toolbar">
                  <mat-form-field>
                    <mat-label>{{ 'security.vault' | transloco }}</mat-label>
                    <mat-select [value]="vault()" (valueChange)="vault.set($event); loadSecrets()">
                      @for (item of vaults(); track item.uuid) {
                        <mat-option [value]="item.uuid">{{ item.name }} ({{ item.secretsCount }})</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                @if (canReveal()) {
                  <p class="hint">{{ 'security.revealAudit' | transloco }}</p>
                }
                @if (secrets().length === 0) {
                  <p class="card">{{ 'security.emptySecrets' | transloco }}</p>
                } @else {
                  <div class="table-wrap card">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{{ 'security.secret' | transloco }}</th>
                          <th scope="col">{{ 'security.secretType' | transloco }}</th>
                          <th scope="col">{{ 'security.expiresAt' | transloco }}</th>
                          <th scope="col">{{ 'security.value' | transloco }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of secrets(); track item.uuid) {
                          <tr>
                            <td class="wrap">
                              {{ item.name }}
                              @if (item.description) { <span class="hint">{{ item.description }}</span> }
                            </td>
                            <td>{{ stateKey('secret', item.type) | transloco }}</td>
                            <td>{{ item.expiresAt ? when(item.expiresAt) : '—' }}</td>
                            <td>
                              @if (revealed()?.uuid === item.uuid) {
                                <code class="secret-value">{{ revealed()!.value }}</code>
                                <button matIconButton type="button" [attr.aria-label]="'security.copy' | transloco" (click)="copy(revealed()!.value)">
                                  <mat-icon>content_copy</mat-icon>
                                </button>
                                <button matButton type="button" (click)="hide()">{{ 'security.hide' | transloco }}</button>
                              } @else if (!item.stored) {
                                {{ 'security.noValue' | transloco }}
                              } @else if (canReveal()) {
                                <button matButton type="button" (click)="reveal(item)">{{ 'security.reveal' | transloco }}</button>
                              } @else {
                                ••••••
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
            }
          }
        }
      }
    </section>
  `,
  styles: [`
    .page { display: block; }
    .page-header { margin-bottom: 16px; }
    .account-select { width: min(100%, 420px); }
    .account-name { font-weight: 600; margin: 0 0 12px; }
    .tabs, .toolbar, .pagination, .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
    .toolbar mat-form-field { flex: 1 1 200px; min-width: 0; max-width: 420px; }
    .tabs button.active { background: var(--surface-container, rgba(0, 0, 0, 0.06)); font-weight: 600; }
    .pagination, .actions { justify-content: flex-end; }
    h2 { font-size: 1.05rem; margin: 24px 0 8px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .metric { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
    .metric-value { font-size: 1.6rem; font-weight: 600; }
    .table-wrap { overflow-x: auto; }
    .table-wrap.card { padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; text-align: start; border-bottom: 1px solid var(--border-color, #eee); white-space: nowrap; }
    td.wrap { white-space: normal; min-width: 220px; overflow-wrap: anywhere; }
    .badge { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 8px; border-radius: 999px; font-size: 0.8rem; background: var(--surface-container, rgba(0, 0, 0, 0.05)); }
    .hint { display: block; margin-top: 2px; font-size: 0.85rem; color: var(--text-secondary, #666); }
    .narrative { padding: 12px 16px; line-height: 1.5; }
    .narrative p { margin: 0 0 8px; overflow-wrap: anywhere; }
    .request-form { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; white-space: normal; }
    .request-form mat-form-field { width: min(100%, 560px); }
    .secret-value { font-family: monospace; overflow-wrap: anywhere; white-space: normal; }
    .badge.urgent { background: var(--error-container, #fde7e9); color: var(--on-error-container, #8c1d18); }
    .detail p { margin: 4px 0; }
    .command { display: block; margin: 6px 0; padding: 8px; font-family: monospace; overflow-wrap: anywhere; white-space: pre-wrap; background: var(--surface-container, rgba(0, 0, 0, 0.05)); border-radius: 6px; }
    @media print { .no-print, .tabs, .account-select { display: none !important; } }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `],
})
export class SecurityPageComponent {
  private readonly api = inject(ApiService);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  readonly page = PAGE;
  readonly metrics = METRICS;
  readonly alertStatuses = KNOWN.alert;
  readonly stateKey = stateKey;
  readonly canRequestUnblock = canRequestUnblock;
  readonly canAcceptRisk = canAcceptRisk;
  readonly findingStatuses = FINDING_STATUSES;
  readonly periodMetrics = PERIOD_METRICS;
  readonly currentMetrics = CURRENT_METRICS;
  readonly months = reportMonths();
  readonly bounds = acceptanceBounds();
  readonly findings = signal<Finding[]>([]);
  readonly findingStatus = signal<string>('open');
  readonly findingOffset = signal(0);
  readonly findingTotal = signal(0);
  readonly fixing = signal<string | null>(null);
  readonly accepting = signal<string | null>(null);
  readonly report = signal<VulnerabilityReport | null>(null);
  readonly reportMonth = signal(reportMonths()[0]);
  acceptUntil = '';
  acceptReason = '';
  readonly accounts = signal<SecurityAccount[]>([]);
  readonly account = signal<SecurityAccount | null>(null);
  readonly tab = signal<SecurityTab>('dashboard');
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly dashboard = signal<Dashboard | null>(null);
  readonly servers = signal<Server[]>([]);
  readonly hardening = signal<HardeningServer[]>([]);
  readonly networkDevices = signal<NetworkDevice[]>([]);
  readonly networkFindings = signal<NetworkFinding[]>([]);
  readonly alerts = signal<Alert[]>([]);
  readonly alertStatus = signal('');
  readonly alertOffset = signal(0);
  readonly alertTotal = signal(0);
  readonly blocks = signal<Block[]>([]);
  readonly requests = signal<UnblockRequest[]>([]);
  readonly requesting = signal<string | null>(null);
  readonly vaults = signal<Vault[]>([]);
  readonly vault = signal<string | null>(null);
  readonly secrets = signal<Secret[]>([]);
  readonly revealed = signal<{ uuid: string; value: string } | null>(null);
  readonly tabs = computed(() => {
    const account = this.account();
    return account ? TABS.filter(([, flag]) => Number(account[flag]) === 1) : [];
  });
  readonly canAck = computed(() => Number(this.account()?.AlertAck) === 1);
  readonly canReveal = computed(() => Number(this.account()?.SecretReveal) === 1);
  reason = '';

  constructor() {
    void this.load();
  }

  private base(): string {
    return `customer-portal/cyber-security/accounts/${encodeURIComponent(this.account()!.CyaUUID)}`;
  }

  readonly paragraphs = paragraphs;
  readonly checkKey = checkKey;
  readonly antivirusName = antivirusName;

  when(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await this.api.get<ApiEnvelope<{ items: SecurityAccount[] }>>('customer-portal/cyber-security/accounts');
      const items = response.data?.items ?? [];
      this.accounts.set(items);
      if (items.length > 0) await this.selectAccount(items[0].CyaUUID);
    } catch {
      this.error.set('security.error');
    } finally {
      this.loading.set(false);
    }
  }

  async selectAccount(uuid: string) {
    this.account.set(this.accounts().find((item) => item.CyaUUID === uuid) ?? null);
    this.vault.set(null);
    this.hide();
    const first = this.tabs()[0];
    if (first) await this.openTab(first[0]);
  }

  async openTab(tab: SecurityTab) {
    this.tab.set(tab);
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.hide();
    try {
      if (tab === 'dashboard') {
        this.dashboard.set((await this.api.get<ApiEnvelope<Dashboard>>(`${this.base()}/dashboard`)).data ?? null);
      } else if (tab === 'servers') {
        this.servers.set((await this.api.get<ApiEnvelope<{ items: Server[] }>>(`${this.base()}/servers`)).data?.items ?? []);
      } else if (tab === 'hardening') {
        const items = (await this.api.get<ApiEnvelope<{ items: HardeningServer[] }>>(`${this.base()}/hardening`)).data?.items ?? [];
        this.hardening.set(items.map((item) => ({ ...item, checks: sortChecks(item.checks ?? []) })));
      } else if (tab === 'network') {
        const [devices, findings] = await Promise.all([
          this.api.get<ApiEnvelope<{ items: NetworkDevice[] }>>(`${this.base()}/network-devices`),
          this.api.get<ApiEnvelope<{ items: NetworkFinding[] }>>(`${this.base()}/network-devices/findings?limit=200`),
        ]);
        this.networkDevices.set(devices.data?.items ?? []);
        this.networkFindings.set(findings.data?.items ?? []);
      } else if (tab === 'threats') {
        await Promise.all([this.loadAlerts(0), this.loadBlocks()]);
      } else if (tab === 'vulnerabilities') {
        await this.loadFindings(0);
      } else if (tab === 'report') {
        await this.loadReport();
      } else {
        const vaults = (await this.api.get<ApiEnvelope<{ items: Vault[] }>>(`${this.base()}/vaults`)).data?.items ?? [];
        this.vaults.set(vaults);
        if (!this.vault() && vaults.length > 0) this.vault.set(vaults[0].uuid);
        await this.loadSecrets();
      }
    } catch {
      this.error.set('security.error');
    } finally {
      this.busy.set(false);
    }
  }

  async loadAlerts(offset: number) {
    const query = new URLSearchParams({ limit: String(PAGE), offset: String(Math.max(0, offset)) });
    if (this.alertStatus()) query.set('status', this.alertStatus());
    try {
      const response = await this.api.get<ApiEnvelope<{ items: Alert[]; total: number }>>(`${this.base()}/alerts?${query}`);
      this.alerts.set(response.data?.items ?? []);
      this.alertTotal.set(Number(response.data?.total ?? 0));
      this.alertOffset.set(Math.max(0, offset));
    } catch {
      this.error.set('security.error');
    }
  }

  async loadBlocks() {
    const [blocks, requests] = await Promise.all([
      this.api.get<ApiEnvelope<{ items: Block[] }>>(`${this.base()}/decisions?limit=200`),
      this.api.get<ApiEnvelope<{ items: UnblockRequest[] }>>(`${this.base()}/unblock-requests?limit=50`),
    ]);
    this.blocks.set(blocks.data?.items ?? []);
    this.requests.set(requests.data?.items ?? []);
  }

  async acknowledge(alert: Alert) {
    this.error.set(null);
    try {
      await this.api.post(`${this.base()}/alerts/${encodeURIComponent(alert.uuid)}/acknowledge`);
      this.notice.set('security.acknowledged');
    } catch {
      this.error.set('security.actionFailed');
    }
    await this.loadAlerts(this.alertOffset());
  }

  startRequest(block: Block) {
    this.reason = '';
    this.requesting.set(block.uuid);
  }

  async sendRequest(block: Block) {
    this.error.set(null);
    try {
      await this.api.post(`${this.base()}/unblock-requests`, {
        decisionUUID: block.uuid,
        reason: this.reason.trim() || null,
      });
      this.requesting.set(null);
      this.notice.set('security.requestSent');
    } catch {
      this.error.set('security.actionFailed');
    }
    await this.loadBlocks().catch(() => this.error.set('security.error'));
  }

  async loadFindings(offset: number) {
    const query = new URLSearchParams({
      status: this.findingStatus(),
      limit: String(PAGE),
      offset: String(Math.max(0, offset)),
    });
    try {
      const response = await this.api.get<ApiEnvelope<{ items: Finding[]; total: number }>>(`${this.base()}/vulnerabilities?${query}`);
      this.findings.set(response.data?.items ?? []);
      this.findingTotal.set(Number(response.data?.total ?? 0));
      this.findingOffset.set(Math.max(0, offset));
    } catch {
      this.error.set('security.error');
    }
  }

  toggleFix(finding: Finding) {
    this.fixing.set(this.fixing() === finding.findingUUID ? null : finding.findingUUID);
  }

  startAccept(finding: Finding) {
    this.acceptUntil = '';
    this.acceptReason = '';
    this.accepting.set(finding.findingUUID);
  }

  async sendAccept(finding: Finding) {
    this.error.set(null);
    const reason = this.acceptReason.trim();
    if (!this.acceptUntil || reason.length < 5) {
      this.error.set('security.acceptInvalid');
      return;
    }
    try {
      await this.api.post(`${this.base()}/vulnerabilities/${encodeURIComponent(finding.findingUUID)}/risk-acceptance`, {
        until: this.acceptUntil,
        reason,
      });
      this.accepting.set(null);
      this.notice.set('security.accepted');
    } catch {
      this.error.set('security.acceptFailed');
    }
    await this.loadFindings(this.findingOffset());
  }

  async loadReport() {
    try {
      const response = await this.api.get<ApiEnvelope<VulnerabilityReport>>(
        `${this.base()}/vulnerability-report?month=${encodeURIComponent(this.reportMonth())}`,
      );
      this.report.set(response.data ?? null);
    } catch {
      this.report.set(null);
      this.error.set('security.error');
    }
  }

  print() {
    window.print();
  }

  async loadSecrets() {
    const vault = this.vault();
    if (!vault) {
      this.secrets.set([]);
      return;
    }
    try {
      const response = await this.api.get<ApiEnvelope<{ items: Secret[] }>>(`${this.base()}/vaults/${encodeURIComponent(vault)}/secrets`);
      this.secrets.set(response.data?.items ?? []);
    } catch {
      this.error.set('security.error');
    }
  }

  async reveal(secret: Secret) {
    this.error.set(null);
    this.hide();
    try {
      const response = await this.api.post<ApiEnvelope<{ secretValue: string }>>(
        `${this.base()}/secrets/${encodeURIComponent(secret.uuid)}/reveal`,
      );
      const value = response.data?.secretValue;
      if (typeof value !== 'string') throw new Error('empty');
      this.revealed.set({ uuid: secret.uuid, value });
      this.hideTimer = setTimeout(() => this.hide(), REVEAL_VISIBLE_MS);
    } catch {
      this.error.set('security.revealFailed');
    }
  }

  hide() {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    this.revealed.set(null);
  }

  async copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.notice.set('security.copied');
    } catch {
      this.error.set('security.copyFailed');
    }
  }
}
