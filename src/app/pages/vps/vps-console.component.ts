import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, ApiService } from '../../services/api.service';
import { RuntimeConfigService } from '../../core/runtime/runtime-config.service';
import type { ApiEnvelope } from '../../models/session.model';
import type { VpsServer } from './vps.model';

/** Console session of the API (same session as the tenant console; token valid for 60 s). */
export type VpsConsoleSession = {
  type: 'serial' | 'vnc' | 'ssh';
  token: string;
  path: string;
  vncPassword?: string;
  consolePasswordAvailable?: boolean;
};

type NoVncRfb = InstanceType<typeof import('@novnc/novnc/core/rfb.js').default>;

/** WebSocket URL of a console session on the API origin of the portal. */
export function consoleSocketUrl(apiBase: string, session: VpsConsoleSession): string {
  const absolute = new URL(apiBase.replace(/\/+$/, ''), document.baseURI).toString();
  const base = absolute.replace(/^http/i, 'ws').replace(/\/+$/, '');
  return `${base}${session.path}?token=${encodeURIComponent(session.token)}`;
}

/** Proxmox termproxy input frame ("0:<bytes>:<data>"); also the SSH console framing. */
export function termproxyInput(data: string): string {
  return `0:${new TextEncoder().encode(data).length}:${data}`;
}

/** Proxmox termproxy resize frame. */
export function termproxyResize(cols: number, rows: number): string {
  return `1:${cols}:${rows}:`;
}

/** Proxmox banner of a serial session; it is not output of the server. */
export function isSerialBanner(text: string): boolean {
  return /^\s*starting serial terminal on interface \S+\s*$/i.test(text);
}

const HANDSHAKE_MS = 15_000;
const WAKE_DELAY_MS = 700;
const XTERM_STYLES_ID = 'mcp-xterm-styles';

/** xterm CSS ships as the lazy `xterm.css` bundle (angular.json, inject: false). */
function ensureTerminalStyles() {
  if (document.getElementById(XTERM_STYLES_ID)) return;
  const link = document.createElement('link');
  link.id = XTERM_STYLES_ID;
  link.rel = 'stylesheet';
  link.href = 'xterm.css';
  document.head.appendChild(link);
}

@Component({
  selector: 'mcp-vps-console',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'dialog', 'aria-modal': 'true', '[attr.aria-label]': 'server().HviName' },
  template: `
    <div class="frame">
      <header>
        <div>
          <strong>{{ 'vps.console' | transloco }} · {{ server().HviName }}</strong>
          <span class="status" [class.error]="failed()" role="status">{{
            status() | transloco
          }}</span>
        </div>
        <div class="actions">
          @if (passwordAvailable()) {
            @if (credential(); as shown) {
              <span class="secret">
                {{ 'vps.user' | transloco }}: <code>{{ shown.username }}</code> ·
                {{ 'vps.password' | transloco }}: <code>{{ shown.password }}</code>
                <button
                  matIconButton
                  type="button"
                  (click)="copyPassword()"
                  [matTooltip]="'vps.copyPassword' | transloco"
                  [attr.aria-label]="'vps.copyPassword' | transloco"
                >
                  <mat-icon>content_copy</mat-icon>
                </button>
              </span>
            } @else {
              <button matButton="outlined" type="button" (click)="revealPassword()">
                <mat-icon>key</mat-icon>
                {{ 'vps.consolePassword' | transloco }}
              </button>
            }
          }
          @if (type() === 'vnc') {
            <button matButton="outlined" type="button" (click)="sendCtrlAltDel()">
              Ctrl+Alt+Del
            </button>
          }
          <button matButton="outlined" type="button" (click)="reconnect()">
            <mat-icon>refresh</mat-icon>
            {{ 'vps.reconnect' | transloco }}
          </button>
          <button matButton="filled" type="button" (click)="closed.emit()">
            {{ 'vps.close' | transloco }}
          </button>
        </div>
      </header>
      <div class="screen" #screen></div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: stretch;
      padding: 16px;
      background: rgb(0 0 0 / 60%);
    }
    .frame {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      padding: 16px;
      border-radius: var(--radius, 12px);
      background: var(--surface);
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    header > div:first-child {
      display: grid;
      gap: 2px;
    }
    .status {
      color: var(--muted);
      font-size: 13px;
    }
    .status.error {
      color: var(--mat-sys-error);
    }
    .actions,
    .secret {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    code {
      user-select: all;
    }
    .screen {
      flex: 1 1 auto;
      min-height: 280px;
      overflow: hidden;
      border-radius: 8px;
      background: #000;
    }
    @media (max-width: 600px) {
      :host {
        padding: 0;
      }
      .frame {
        border-radius: 0;
      }
    }
  `,
})
export class VpsConsoleComponent {
  readonly server = input.required<VpsServer>();
  readonly closed = output<void>();
  private readonly api = inject(ApiService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly screen = viewChild.required<ElementRef<HTMLDivElement>>('screen');
  readonly status = signal('vps.connecting');
  readonly failed = signal(false);
  readonly type = signal<VpsConsoleSession['type'] | null>(null);
  readonly passwordAvailable = signal(false);
  readonly credential = signal<{ username: string; password: string } | null>(null);
  private teardown: (() => void) | null = null;
  private rfb: NoVncRfb | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
    queueMicrotask(() => void this.connect());
  }

  private close() {
    this.teardown?.();
    this.teardown = null;
  }

  private fail(message: string) {
    this.failed.set(true);
    this.status.set(message);
  }

  async reconnect() {
    this.close();
    this.screen().nativeElement.replaceChildren();
    await this.connect();
  }

  sendCtrlAltDel() {
    this.rfb?.sendCtrlAltDel();
  }

  async revealPassword() {
    try {
      const envelope = await this.api.post<ApiEnvelope<{ username?: string; password?: string }>>(
        `customer-portal/vps/instances/${this.server().HviUUID}/console-password/reveal`,
        {},
      );
      if (envelope.data?.password) {
        this.credential.set({
          username: envelope.data.username ?? 'admin',
          password: envelope.data.password,
        });
      }
    } catch {
      this.fail('vps.consolePasswordFailed');
    }
  }

  async copyPassword() {
    const password = this.credential()?.password;
    if (password) await navigator.clipboard?.writeText(password);
  }

  private async connect() {
    this.failed.set(false);
    this.status.set('vps.connecting');
    let session: VpsConsoleSession | undefined;
    try {
      const envelope = await this.api.post<ApiEnvelope<VpsConsoleSession>>(
        `customer-portal/vps/instances/${this.server().HviUUID}/console`,
        {},
      );
      session = envelope.data;
    } catch (error) {
      this.fail(
        error instanceof ApiError && error.status === 409
          ? 'vps.consoleNotRunning'
          : 'vps.consoleFailed',
      );
      return;
    }
    if (!session?.token) return this.fail('vps.consoleFailed');
    this.type.set(session.type);
    this.passwordAvailable.set(session.consolePasswordAvailable === true);
    const url = consoleSocketUrl(this.runtime.apiBaseUrl, session);
    if (session.type === 'vnc') await this.connectVnc(url, session.vncPassword ?? '');
    else await this.connectTerminal(url);
  }

  private async connectTerminal(url: string) {
    ensureTerminalStyles();
    const { Terminal } = await import('@xterm/xterm');
    const host = this.screen().nativeElement;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      theme: { background: '#000000' },
    });
    terminal.open(host);
    const fit = () => {
      terminal.resize(
        Math.max(40, Math.floor(host.clientWidth / 9)),
        Math.max(10, Math.floor(host.clientHeight / 17)),
      );
    };
    fit();
    const socket = new WebSocket(url, ['binary']);
    socket.binaryType = 'arraybuffer';
    const decoder = new TextDecoder();
    let ready = false;
    let spoke = false;
    let wake: ReturnType<typeof setTimeout> | undefined;
    // Keeps proxies open while the console is idle.
    const ping = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send('2');
    }, 30_000);
    const handshake = setTimeout(() => {
      if (ready) return;
      this.fail('vps.consoleNoAnswer');
      socket.close();
    }, HANDSHAKE_MS);
    socket.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : decoder.decode(event.data);
      if (!ready) {
        clearTimeout(handshake);
        if (!text.startsWith('OK')) {
          this.fail('vps.consoleFailed');
          socket.close();
          return;
        }
        ready = true;
        this.status.set('vps.connected');
        socket.send(termproxyResize(terminal.cols, terminal.rows));
        terminal.focus();
        const rest = text.slice(2);
        if (rest) {
          terminal.write(rest);
          if (!isSerialBanner(rest)) spoke = true;
        }
        // A login prompt printed before the session opened is not repeated: Enter asks for it.
        wake = setTimeout(() => {
          if (!spoke && socket.readyState === WebSocket.OPEN) socket.send(termproxyInput('\r'));
        }, WAKE_DELAY_MS);
        return;
      }
      if (!isSerialBanner(text)) spoke = true;
      terminal.write(text);
    };
    socket.onclose = () => {
      clearTimeout(handshake);
      if (ready) this.status.set('vps.disconnected');
      else if (!this.failed()) this.fail('vps.consoleClosed');
    };
    const typed = terminal.onData((data) => {
      if (ready && socket.readyState === WebSocket.OPEN) socket.send(termproxyInput(data));
    });
    const resized = terminal.onResize(({ cols, rows }) => {
      if (ready && socket.readyState === WebSocket.OPEN) socket.send(termproxyResize(cols, rows));
    });
    const observer = new ResizeObserver(() => fit());
    observer.observe(host);
    this.teardown = () => {
      clearInterval(ping);
      clearTimeout(handshake);
      clearTimeout(wake);
      observer.disconnect();
      typed.dispose();
      resized.dispose();
      socket.close();
      terminal.dispose();
    };
  }

  private async connectVnc(url: string, password: string) {
    const { default: RFB } = await import('@novnc/novnc/core/rfb.js');
    const rfb = new RFB(this.screen().nativeElement, url, {
      credentials: { password },
      wsProtocols: ['binary'],
    });
    rfb.scaleViewport = true;
    rfb.resizeSession = false;
    rfb.addEventListener('connect', () => {
      this.status.set('vps.connected');
      rfb.focus();
    });
    rfb.addEventListener('disconnect', () => this.status.set('vps.disconnected'));
    rfb.addEventListener('securityfailure', () => this.fail('vps.consoleFailed'));
    this.rfb = rfb;
    this.teardown = () => {
      try {
        rfb.disconnect();
      } catch {
        /* already closed */
      }
      this.rfb = null;
    };
  }
}
