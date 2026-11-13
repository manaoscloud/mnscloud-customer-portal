/** What the customer sees of an SMTP sending account (V5; never prices, cost, provider or notes). */
export type SmtpAccount = {
  HsaUUID: string;
  HsaName: string;
  FromName: string | null;
  FromEmail: string;
  DailyLimit: number;
  QueuedToday: number;
  SentToday: number;
  SentMonth: number;
  SendKeyPrefix: string | null;
  SendKeyCreatedAt: string | null;
  CanManageKey: number | boolean;
  DateCreated: string | null;
};

export type SmtpMessage = {
  HsmUUID: string;
  Subject: string | null;
  Status: string;
  FirstRecipient: string | null;
  RecipientCount: number;
  QueuedAt: string | null;
  SentAt: string | null;
  DeliveredAt: string | null;
  FailedAt: string | null;
};

export type SmtpSendKey = { sendKey: string; prefix: string; createdAt: string };

export type SmtpMessageStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'complained'
  | 'rejected';

const STATUSES: readonly string[] = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'complained',
  'rejected',
];

/** Known status, or `queued` for anything unexpected (never shows a raw provider value). */
export function messageStatus(message: Pick<SmtpMessage, 'Status'>): SmtpMessageStatus {
  const status = String(message.Status ?? '').toLowerCase();
  return (STATUSES.includes(status) ? status : 'queued') as SmtpMessageStatus;
}

/** Tone used to color the status chip. */
export function statusTone(status: SmtpMessageStatus): 'ok' | 'bad' | 'neutral' {
  if (status === 'delivered' || status === 'sent') return 'ok';
  if (['failed', 'bounced', 'complained', 'rejected'].includes(status)) return 'bad';
  return 'neutral';
}

/** Share of the daily limit already sent (0-100), or null without a limit. */
export function dailyPercent(account: Pick<SmtpAccount, 'SentToday' | 'DailyLimit'>): number | null {
  const limit = Number(account.DailyLimit ?? 0);
  if (!limit || limit <= 0) return null;
  const used = Math.max(0, Number(account.SentToday ?? 0));
  return Math.min(100, Math.round((used / limit) * 100));
}

/** `Name <email>`, or just the e-mail without a name. */
export function senderLabel(account: Pick<SmtpAccount, 'FromName' | 'FromEmail'>): string {
  const name = (account.FromName ?? '').trim();
  return name ? `${name} <${account.FromEmail}>` : account.FromEmail;
}

/** Masked key as shown to the customer: the full secret is never kept. */
export function maskedKey(prefix: string | null | undefined): string | null {
  return prefix ? `mnssmtp_${prefix}_••••` : null;
}

/** Most relevant time of a message for its status. */
export function messageTime(message: SmtpMessage): string | null {
  return message.DeliveredAt ?? message.FailedAt ?? message.SentAt ?? message.QueuedAt ?? null;
}

/** Example request of the send endpoint for the given API base URL. */
export function curlExample(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, '');
  return (
    `curl -X POST ${base}/smtp/send \\\n` +
    `  -H "Authorization: Bearer <key>" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -d '{"to":["user@example.com"],"subject":"Subject","html":"<p>Hello</p>"}'`
  );
}
