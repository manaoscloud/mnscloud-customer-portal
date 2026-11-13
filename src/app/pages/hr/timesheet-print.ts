/** Printable monthly timesheet (Portaria MTP 671/2021 art. 84 minimum content), self-contained A4 HTML. */

export type PrintSchedule = {
  Name?: string | null;
  Kind?: string | null;
  CycleLength?: number | null;
  StartDate?: string | null;
  EndDate?: string | null;
  Days?: { Position?: number; Start?: string | null; BreakStart?: string | null; BreakEnd?: string | null; End?: string | null }[] | null;
};
export type PrintAdjustment = {
  Kind?: string | null;
  PunchType?: string | null;
  LocalTime?: string | null;
  Reason?: string | null;
};
export type PrintPunch = { Type?: string | null; LocalTime?: string | null; NSR?: number | string | null; Disregarded?: boolean | number | null };
export type PrintDay = Record<string, unknown> & {
  Date?: string;
  DayKind?: string;
  HolidayName?: string | null;
  punches?: PrintPunch[] | null;
  adjustments?: PrintAdjustment[] | null;
  Flags?: string[] | string | null;
};
export type PrintTimesheet = {
  days?: PrintDay[] | null;
  totals?: Record<string, unknown> | null;
  header?: {
    employer?: { Name?: string | null; Document?: string | null; DocumentKind?: string | null } | null;
    employee?: {
      Name?: string | null;
      Document?: string | null;
      HireDate?: string | null;
      PositionName?: string | null;
      DepartmentName?: string | null;
      RegistrationNumber?: string | null;
      LocationName?: string | null;
      TerminationDate?: string | null;
    } | null;
    schedules?: PrintSchedule[] | null;
    period?: { From?: string | null; To?: string | null } | null;
    IssuedAt?: string | null;
    IssuedAtLocal?: string | null;
    Timezone?: string | null;
  } | null;
};

export type Translate = (key: string, params?: Record<string, unknown>) => string;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function minutesText(value: unknown, signed = false): string {
  const minutes = Number(value) || 0;
  const abs = Math.abs(Math.round(minutes));
  const text = `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  return signed && minutes < 0 ? `-${text}` : signed && minutes > 0 ? `+${text}` : text;
}

/** YYYY-MM-DD as DD/MM/YYYY; anything else is returned as is. */
export function dateText(value: unknown): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? '');
}

function issuedText(value: string | null | undefined, timezone: string | null | undefined, language: string): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'medium' };
  try {
    return new Intl.DateTimeFormat(language, { ...options, timeZone: timezone || undefined }).format(date);
  } catch {
    return new Intl.DateTimeFormat(language, options).format(date);
  }
}

const KINDS = ['work', 'off', 'holiday', 'no_schedule'];
const PUNCH_TYPES = ['clock_in', 'break_start', 'break_end', 'clock_out'];
const FLAGS = [
  'absence', 'missing_punch', 'late', 'early_leave', 'short_break', 'rest_violation',
  'overtime_limit', 'worked_day_off', 'flagged_punch', 'no_schedule',
];

const STYLE = `
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; }
body { font: 10px/1.35 Arial, Helvetica, sans-serif; color: #000; margin: 0; }
h1 { font-size: 15px; margin: 0 0 6px; text-align: center; }
h2 { font-size: 11px; margin: 10px 0 3px; text-transform: uppercase; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #888; padding: 2px 4px; text-align: left; vertical-align: top; }
th { background: #eee; }
td.n, th.n { text-align: right; white-space: nowrap; }
.kv th { width: 22%; }
.mark { white-space: nowrap; margin-right: 6px; display: inline-block; }
.mark b { border: 1px solid #000; padding: 0 2px; margin-right: 2px; }
.d { text-decoration: line-through; }
.foot { margin-top: 8px; display: flex; justify-content: space-between; }
tr { page-break-inside: avoid; }
`;

/** Self-contained printable page; every API value is escaped. */
export function buildTimesheetHtml(body: PrintTimesheet, t: Translate, language: string): string {
  const header = body.header ?? {};
  const employer = header.employer ?? {};
  const employee = header.employee ?? {};
  const days = body.days ?? [];
  const totals = body.totals ?? {};
  const e = escapeHtml;
  const dash = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : e(value));
  const period = `${dateText(header.period?.From)} – ${dateText(header.period?.To)}`;
  const typeLabel = (type: string | null | undefined) =>
    type && PUNCH_TYPES.includes(type) ? t(`hr.print.type.${type}`) : (type ?? '');

  const scheduleRows = (header.schedules ?? [])
    .map((schedule) => {
      const kind = schedule.Kind === 'cycle' ? t('hr.print.kindCycle') : t('hr.print.kindWeekly');
      const range = schedule.StartDate || schedule.EndDate
        ? ` (${dateText(schedule.StartDate)} – ${schedule.EndDate ? dateText(schedule.EndDate) : '…'})`
        : '';
      const rows = (schedule.Days ?? [])
        .map((day) => {
          const label = schedule.Kind === 'cycle'
            ? t('hr.cycleDay', { n: day.Position })
            : t(`hr.weekdays.${day.Position}`);
          const times = day.Start
            ? `${e(day.Start)} – ${e(day.BreakStart ?? '—')} / ${e(day.BreakEnd ?? '—')} – ${e(day.End ?? '—')}`
            : e(t('hr.dayOff'));
          return `<tr><td>${e(label)}</td><td>${times}</td></tr>`;
        })
        .join('');
      return `<tr><th colspan="2">${e(schedule.Name)} · ${e(kind)}${e(range)}</th></tr>${rows}`;
    })
    .join('');

  const legend: string[] = [];
  const dayRows = days
    .map((day) => {
      const kind = KINDS.includes(String(day.DayKind)) ? String(day.DayKind) : 'work';
      const kindText = day.HolidayName ? String(day.HolidayName) : t(`hr.dayKinds.${kind}`);
      const marks: string[] = [];
      for (const punch of day.punches ?? []) {
        const disregarded = punch.Disregarded === true || punch.Disregarded === 1;
        const nsr = punch.NSR === null || punch.NSR === undefined ? '' : ` NSR ${e(punch.NSR)}`;
        const text = `${e(punch.LocalTime)}${nsr}`;
        marks.push(
          disregarded
            ? `<span class="mark d"><b>D</b>${text}</span>`
            : `<span class="mark">${text}</span>`,
        );
      }
      for (const adjustment of day.adjustments ?? []) {
        const include = adjustment.Kind === 'include';
        const marker = include ? 'I' : 'D';
        if (include) marks.push(`<span class="mark"><b>I</b>${e(adjustment.LocalTime)}</span>`);
        legend.push(
          `<tr><td>${e(dateText(day.Date))}</td><td>${marker}</td><td>${e(adjustment.LocalTime ?? '—')}</td>` +
            `<td>${e(typeLabel(adjustment.PunchType))}</td><td>${dash(adjustment.Reason)}</td></tr>`,
        );
      }
      const flagList = Array.isArray(day.Flags) ? day.Flags : String(day.Flags ?? '').split(',');
      const flags = flagList
        .map((flag) => String(flag).trim())
        .filter((flag) => FLAGS.includes(flag))
        .map((flag) => t(`hr.flags.${flag}`))
        .join(', ');
      const overtime = (Number(day['OvertimeMinutes']) || 0) + (Number(day['OvertimeRestMinutes']) || 0);
      return (
        `<tr><td>${e(dateText(day.Date))}</td><td>${e(kindText)}</td><td>${marks.join(' ') || '—'}</td>` +
        `<td class="n">${minutesText(day['ExpectedMinutes'])}</td><td class="n">${minutesText(day['WorkedMinutes'])}</td>` +
        `<td class="n">${minutesText(overtime)}</td><td class="n">${minutesText(day['AbsenceMinutes'])}</td>` +
        `<td class="n">${minutesText(day['LateMinutes'])}</td><td class="n">${minutesText(day['NightReducedMinutes'] ?? day['NightMinutes'])}</td>` +
        `<td class="n">${minutesText(day['BalanceMinutes'], true)}</td><td>${e(flags)}</td></tr>`
      );
    })
    .join('');

  const totalOvertime = (Number(totals['OvertimeMinutes']) || 0) + (Number(totals['OvertimeRestMinutes']) || 0);
  const heads = ['hr.date', 'hr.day', 'hr.print.marks', 'hr.expected', 'hr.worked', 'hr.print.overtime', 'hr.print.absence', 'hr.print.late', 'hr.print.night', 'hr.balance', 'hr.issues'];
  const numeric = new Set([3, 4, 5, 6, 7, 8, 9]);
  const headRow = heads.map((key, index) => `<th${numeric.has(index) ? ' class="n"' : ''}>${e(t(key))}</th>`).join('');
  const legendHtml = legend.length
    ? `<h2>${e(t('hr.print.legend'))}</h2><p>${e(t('hr.print.legendText'))}</p><table><tr><th>${e(t('hr.date'))}</th><th></th><th>${e(t('hr.print.time'))}</th><th>${e(t('hr.print.type'))}</th><th>${e(t('hr.print.reason'))}</th></tr>${legend.join('')}</table>`
    : '';
  const title = t('hr.print.title');
  const issued = header.IssuedAtLocal || issuedText(header.IssuedAt, header.Timezone, language);
  return `<!doctype html><html lang="${e(language)}"><head><meta charset="utf-8"><title>${e(title)}</title><style>${STYLE}</style></head><body>
<h1>${e(title)}</h1>
<table class="kv">
<tr><th>${e(t('hr.print.employer'))}</th><td>${dash(employer.Name)}</td><th>${e(t('hr.print.employerDocument'))}</th><td>${dash(employer.Document)}</td></tr>
<tr><th>${e(t('hr.print.employee'))}</th><td>${dash(employee.Name)}</td><th>${e(t('hr.print.cpf'))}</th><td>${dash(employee.Document)}</td></tr>
<tr><th>${e(t('hr.print.hireDate'))}</th><td>${employee.HireDate ? e(dateText(employee.HireDate)) : '—'}</td><th>${e(t('hr.print.position'))}</th><td>${dash(employee.PositionName)}</td></tr>
<tr><th>${e(t('hr.print.period'))}</th><td>${e(period)}</td><th>${e(t('hr.print.department'))}</th><td>${dash(employee.DepartmentName)}</td></tr>
<tr><th>${e(t('hr.print.registration'))}</th><td>${dash(employee.RegistrationNumber)}</td><th>${e(t('hr.print.location'))}</th><td>${dash(employee.LocationName)}</td></tr>
${employee.TerminationDate ? `<tr><th>${e(t('hr.print.termination'))}</th><td>${e(dateText(employee.TerminationDate))}</td><th></th><td></td></tr>` : ''}
</table>
${scheduleRows ? `<h2>${e(t('hr.print.schedules'))}</h2><table>${scheduleRows}</table>` : ''}
<h2>${e(t('hr.print.days'))}</h2>
<table><thead><tr>${headRow}</tr></thead><tbody>${dayRows}</tbody>
<tfoot><tr><th colspan="3">${e(t('hr.print.totals'))}</th><th class="n">${minutesText(totals['ExpectedMinutes'])}</th><th class="n">${minutesText(totals['WorkedMinutes'])}</th><th class="n">${minutesText(totalOvertime)}</th><th class="n">${minutesText(totals['AbsenceMinutes'])}</th><th class="n">${minutesText(totals['LateMinutes'])}</th><th class="n">${minutesText(totals['NightReducedMinutes'] ?? totals['NightMinutes'])}</th><th class="n">${minutesText(totals['BalanceMinutes'], true)}</th><th></th></tr></tfoot></table>
${legendHtml}
<div class="foot"><span>${e(t('hr.print.issuedAt'))}: ${e(issued)}${header.Timezone ? ` (${e(header.Timezone)})` : ''}</span><span>${e(t('hr.print.period'))}: ${e(period)}</span></div>
</body></html>`;
}

/** Prints [html] through a hidden iframe, removed afterwards. */
export function printHtml(html: string, doc: Document = document): void {
  const frame = doc.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      setTimeout(() => frame.remove(), 60_000);
    }
  };
  frame.srcdoc = html;
  doc.body.appendChild(frame);
}
