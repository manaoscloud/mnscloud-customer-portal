import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiService } from '../../services/api.service';
import { SmtpPageComponent } from './smtp-page.component';
import {
  curlExample,
  dailyPercent,
  maskedKey,
  messageStatus,
  senderLabel,
  statusTone,
  type SmtpAccount,
  type SmtpMessage,
} from './smtp.model';

const ACCOUNT: SmtpAccount = {
  HsaUUID: 'acc-1',
  HsaName: 'TRANSACTIONAL',
  FromName: 'ACME',
  FromEmail: 'no-reply@acme.test',
  DailyLimit: 200,
  QueuedToday: 60,
  SentToday: 50,
  SentMonth: 900,
  SendKeyPrefix: 'ab12cd34',
  SendKeyCreatedAt: null,
  CanManageKey: 1,
  DateCreated: null,
};
const MESSAGE: SmtpMessage = {
  HsmUUID: 'm-1',
  Subject: 'Welcome aboard',
  Status: 'delivered',
  FirstRecipient: 'a@b.test',
  RecipientCount: 3,
  QueuedAt: '2026-11-13T10:00:00Z',
  SentAt: null,
  DeliveredAt: null,
  FailedAt: null,
};

describe('smtp model', () => {
  it('formats usage, sender, key and status', () => {
    expect(dailyPercent(ACCOUNT)).toBe(25);
    expect(dailyPercent({ SentToday: 5, DailyLimit: 0 })).toBeNull();
    expect(dailyPercent({ SentToday: 500, DailyLimit: 100 })).toBe(100);
    expect(senderLabel(ACCOUNT)).toBe('ACME <no-reply@acme.test>');
    expect(senderLabel({ FromName: null, FromEmail: 'x@y.test' })).toBe('x@y.test');
    expect(maskedKey('ab12cd34')).toBe('mnssmtp_ab12cd34_••••');
    expect(maskedKey(null)).toBeNull();
    expect(messageStatus({ Status: 'bounced' })).toBe('bounced');
    expect(messageStatus({ Status: 'weird' })).toBe('queued');
    expect(statusTone('delivered')).toBe('ok');
    expect(statusTone('rejected')).toBe('bad');
    expect(statusTone('queued')).toBe('neutral');
    expect(curlExample('https://x.test/api/v1/')).toContain('https://x.test/api/v1/smtp/send');
  });
});

describe('SmtpPageComponent', () => {
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn((path: string) =>
      Promise.resolve({ data: { items: path.endsWith('/messages') ? [MESSAGE] : [ACCOUNT] } }),
    );
    apiPost = vi.fn(() =>
      Promise.resolve({
        data: { sendKey: 'mnssmtp_zz99_SECRETVALUE', prefix: 'zz99', createdAt: '2026-11-13' },
      }),
    );
    TestBed.configureTestingModule({
      imports: [
        SmtpPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: ApiService, useValue: { get: apiGet, post: apiPost } }],
    });
  });

  const text = (fixture: { nativeElement: HTMLElement }) =>
    (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  it('renders accounts and loads messages on expand', async () => {
    const fixture = TestBed.createComponent(SmtpPageComponent);
    const page = fixture.componentInstance;
    await page.load();
    fixture.detectChanges();
    expect(apiGet).toHaveBeenCalledWith('customer-portal/smtp/accounts');
    expect(text(fixture)).toContain('TRANSACTIONAL');
    expect(text(fixture)).toContain('ACME <no-reply@acme.test>');
    expect(text(fixture)).toContain('mnssmtp_ab12cd34_••••');
    await page.toggle(ACCOUNT);
    fixture.detectChanges();
    expect(apiGet).toHaveBeenCalledWith('customer-portal/smtp/accounts/acc-1/messages');
    expect(text(fixture)).toContain('Welcome aboard');
    expect(text(fixture)).toContain('a@b.test (+2)');
    expect(text(fixture)).toContain('Delivered');
  });

  it('shows the generated key once and drops it on close', async () => {
    const fixture = TestBed.createComponent(SmtpPageComponent);
    const page = fixture.componentInstance;
    await page.load();
    page.askKey(ACCOUNT);
    expect(page.confirming()).toBe('acc-1');
    await page.generateKey(ACCOUNT);
    fixture.detectChanges();
    expect(apiPost).toHaveBeenCalledWith('customer-portal/smtp/accounts/acc-1/send-key');
    expect(text(fixture)).toContain('mnssmtp_zz99_SECRETVALUE');
    expect(text(fixture)).toContain('mnssmtp_zz99_••••');
    page.closeKey();
    fixture.detectChanges();
    expect(page.newKey()).toBeNull();
    expect(text(fixture)).not.toContain('SECRETVALUE');
  });

  it('hides the key button when the account cannot manage keys', async () => {
    apiGet.mockResolvedValue({ data: { items: [{ ...ACCOUNT, CanManageKey: 0 }] } });
    const fixture = TestBed.createComponent(SmtpPageComponent);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(text(fixture)).not.toContain('Generate new key');
    await fixture.componentInstance.generateKey({ ...ACCOUNT, CanManageKey: 0 });
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('shows the empty state', async () => {
    apiGet.mockResolvedValue({ data: { items: [] } });
    const fixture = TestBed.createComponent(SmtpPageComponent);
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(text(fixture)).toContain('No e-mail account available');
  });
});
