import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguagePickerComponent } from '../../core/i18n/language-picker.component';
import { PortalI18nService } from '../../core/i18n/portal-i18n.service';
import { ApiService } from '../../services/api.service';
import {
  CheckState,
  dnssecState,
  FAMILY_PROBES,
  reach,
  ServiceCheck,
  SERVICES,
} from './connection-test';

type Network = {
  address: string;
  family: 4 | 6;
  operator: { asn: number; name: string | null; country: string | null } | null;
};

type Outcome = { code: string; verdict: 'ok' | 'partial' | 'no_internet'; notes: string[] };

/**
 * Public page the subscriber opens when "the internet is not working": checks run in the browser,
 * the result is stored by the platform and a short code is shown to read to the provider's support.
 */
@Component({
  selector: 'mcp-connection-test-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslocoPipe,
    LanguagePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="login-panel connection-test">
      <div class="login-form">
        <div class="login-form-header">
          <h2>{{ 'test.title' | transloco }}</h2>
          <mcp-language-picker />
        </div>
        <p class="login-subtitle">{{ 'test.intro' | transloco }}</p>

        @if (running()) {
          <mat-progress-bar mode="indeterminate" />
        }

        @if (network(); as net) {
          <p class="test-row">
            <mat-icon>public</mat-icon>
            <span>
              {{ 'test.address' | transloco }}: <strong>{{ net.address }}</strong> (IPv{{
                net.family
              }})
              @if (net.operator) {
                · {{ net.operator.name ?? 'AS' + net.operator.asn }}
              }
            </span>
          </p>
        }

        @if (started()) {
          <ul class="test-list">
            <li>
              <mat-icon>{{ icon(ipv4()) }}</mat-icon> {{ 'test.ipv4' | transloco }}
            </li>
            <li>
              <mat-icon>{{ icon(ipv6()) }}</mat-icon> {{ 'test.ipv6' | transloco }}
            </li>
            <li>
              <mat-icon>{{ icon(dnssecCheck()) }}</mat-icon>
              {{ 'test.dnssec.' + dnssec() | transloco }}
            </li>
            @for (service of services(); track service.key) {
              <li>
                <mat-icon>{{ icon(service.state) }}</mat-icon>
                {{ 'test.service.' + service.key | transloco }}
                @if (service.ms !== null) {
                  <small>{{ service.ms }} ms</small>
                }
              </li>
            }
          </ul>
        }

        @if (outcome(); as result) {
          <div class="test-code" role="status">
            <span>{{ 'test.verdict.' + result.verdict | transloco }}</span>
            @for (note of result.notes; track note) {
              <small>{{ 'test.note.' + note | transloco }}</small>
            }
            <p>{{ 'test.codeHint' | transloco }}</p>
            <strong class="code">{{ result.code }}</strong>
          </div>
        }

        @if (error()) {
          <p class="form-error" role="alert"><mat-icon>error</mat-icon>{{ error() }}</p>
        }

        <button matButton="filled" type="button" [disabled]="running()" (click)="run()">
          <mat-icon>{{ started() ? 'refresh' : 'network_check' }}</mat-icon>
          {{ (started() ? 'test.again' : 'test.start') | transloco }}
        </button>

        <div class="login-footer">
          <mat-icon>privacy_tip</mat-icon>
          {{ 'test.privacy' | transloco }}
        </div>
      </div>
    </section>
  `,
})
export class ConnectionTestPageComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(PortalI18nService);

  readonly started = signal(false);
  readonly running = signal(false);
  readonly network = signal<Network | null>(null);
  readonly ipv4 = signal<CheckState>('pending');
  readonly ipv6 = signal<CheckState>('pending');
  readonly dnssec = signal<'pending' | 'validating' | 'not_validating' | 'unknown'>('pending');
  readonly dnssecCheck = signal<CheckState>('pending');
  readonly services = signal<ServiceCheck[]>([]);
  readonly outcome = signal<Outcome | null>(null);
  readonly error = signal<string | null>(null);

  icon(state: CheckState): string {
    return state === 'ok' ? 'check_circle' : state === 'failed' ? 'cancel' : 'hourglass_empty';
  }

  async run(): Promise<void> {
    if (this.running()) return;
    const begun = performance.now();
    this.started.set(true);
    this.running.set(true);
    this.outcome.set(null);
    this.error.set(null);
    this.ipv4.set('pending');
    this.ipv6.set('pending');
    this.dnssec.set('pending');
    this.dnssecCheck.set('pending');
    this.services.set(SERVICES.map((service) => ({ ...service, state: 'pending', ms: null })));

    const context = this.api
      .get<{ data: Network }>('public/dns-test/context')
      .then((response) => this.network.set(response.data))
      .catch(() => this.network.set(null));
    const family = (url: string, target: typeof this.ipv4) =>
      reach(url).then((ms) => {
        target.set(ms === null ? 'failed' : 'ok');
        return ms !== null;
      });
    const services = SERVICES.map((service) =>
      reach(service.url).then((ms) =>
        this.services.update((list) =>
          list.map((item) =>
            item.key === service.key
              ? { ...item, state: ms === null ? ('failed' as const) : ('ok' as const), ms }
              : item,
          ),
        ),
      ),
    );
    const [ipv4, ipv6, dnssec] = await Promise.all([
      family(FAMILY_PROBES.ipv4, this.ipv4),
      family(FAMILY_PROBES.ipv6, this.ipv6),
      dnssecState().then((state) => {
        this.dnssec.set(state);
        this.dnssecCheck.set(state === 'validating' ? 'ok' : 'failed');
        return state;
      }),
    ]);
    await Promise.all([...services, context]);

    try {
      const response = await this.api.post<{ data: Outcome }>('public/dns-test', {
        ipv4,
        ipv6,
        dnssec,
        services: this.services().map((service) => ({
          key: service.key,
          ok: service.state === 'ok',
          ms: service.ms,
        })),
        durationMs: Math.round(performance.now() - begun),
      });
      this.outcome.set(response.data);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.i18n.t('test.failed'));
    } finally {
      this.running.set(false);
    }
  }
}
