import { buildTimesheetHtml, closingLines, escapeHtml, minutesText, type PrintTimesheet } from './timesheet-print';

const t = (key: string) => `[${key}]`;

const body: PrintTimesheet = {
  header: {
    employer: { Name: 'Posto <b>X</b> & Cia', Document: '12.345.678/0001-90', DocumentKind: 'cnpj' },
    employee: { Name: 'Ana "A" <script>', Document: '123.456.789-09', HireDate: '2024-03-05', PositionName: 'Frentista', DepartmentName: null, RegistrationNumber: 'M-77', LocationName: 'Loja <i>1</i>', TerminationDate: '2026-10-20' },
    schedules: [{ Name: 'Escala 6x1', Kind: 'weekly', Days: [{ Position: 1, Start: '08:00', BreakStart: '12:00', BreakEnd: '13:00', End: '17:00' }] }],
    period: { From: '2026-10-01', To: '2026-10-31' },
    IssuedAt: '2026-11-12T15:00:00Z',
    Timezone: 'America/Manaus',
  },
  days: [
    {
      Date: '2026-10-01',
      DayKind: 'work',
      WorkedMinutes: 480,
      BalanceMinutes: -15,
      punches: [
        { Type: 'clock_in', LocalTime: '08:00', NSR: 10, Disregarded: false },
        { Type: 'clock_out', LocalTime: '17:30', NSR: 11, Disregarded: true },
      ],
      adjustments: [
        { Kind: 'include', PunchType: 'clock_out', LocalTime: '17:00', Reason: '<img onerror=x>' },
        { Kind: 'disregard', PunchType: 'clock_out', LocalTime: '17:30', Reason: 'Duplicada' },
      ],
      Flags: ['late'],
    },
  ],
  totals: { WorkedMinutes: 480, BalanceMinutes: -15 },
};

describe('timesheet print', () => {
  it('escapes every value', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    const html = buildTimesheetHtml(body, t, 'pt-BR');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('Posto &lt;b&gt;X&lt;/b&gt; &amp; Cia');
  });

  it('shows header, NSR, I/D markers and the legend', () => {
    const html = buildTimesheetHtml(body, t, 'pt-BR');
    expect(html).toContain('12.345.678/0001-90');
    expect(html).toContain('05/03/2024');
    expect(html).toContain('NSR 10');
    expect(html).toContain('<b>D</b>17:30 NSR 11');
    expect(html).toContain('<b>I</b>17:00');
    expect(html).toContain('[hr.print.legend]');
    expect(html).toContain('Duplicada');
    expect(html).toContain('-0:15');
  });

  it('prints registration, location and termination of the employment', () => {
    const html = buildTimesheetHtml(body, t, 'pt-BR');
    expect(html).toContain('M-77');
    expect(html).toContain('Loja &lt;i&gt;1&lt;/i&gt;');
    expect(html).toContain('[hr.print.termination]');
    expect(html).toContain('20/10/2026');
    expect(buildTimesheetHtml({ header: { employee: { Name: 'A' } } }, t, 'pt-BR')).not.toContain('[hr.print.termination]');
  });

  it('tolerates a body without header, adjustments or days', () => {
    expect(() => buildTimesheetHtml({}, t, 'en-US')).not.toThrow();
    const html = buildTimesheetHtml({ days: [{ Date: '2026-10-02', DayKind: 'off' }] }, t, 'en-US');
    expect(html).not.toContain('[hr.print.legend]');
  });

  it('prints dashes and the notice when totals are omitted (null minutes)', () => {
    const omitted: PrintTimesheet = {
      totalsScope: 'omitted',
      totals: { WorkDays: 1, WorkedMinutes: null, BalanceMinutes: null },
      days: [{ Date: '2026-10-01', DayKind: 'work', WorkedMinutes: null, BalanceMinutes: null, ExpectedMinutes: null }],
    };
    const html = buildTimesheetHtml(omitted, t, 'pt-BR');
    expect(html).toContain('[hr.print.totalsOmitted]');
    expect(html).not.toContain('0:00');
    expect(buildTimesheetHtml(body, t, 'pt-BR')).not.toContain('[hr.print.totalsOmitted]');
  });

  it('formats minutes', () => {
    expect(minutesText(75, true)).toBe('+1:15');
    expect(minutesText(undefined)).toBe('0:00');
  });
});

describe('closing state', () => {
  const tp = (key: string, params?: Record<string, unknown>) => `${key}${params ? JSON.stringify(params) : ''}`;
  const closed = {
    Status: 'closed', ClosedAt: '2026-11-02T12:00:00Z', DsrLostDays: 1, DsrLostHolidays: 0,
    OvertimeMode: 'bank', BankCreditMinutes: 120, BankDebitMinutes: 30, BankPaidMinutes: 0, BankBalanceMinutes: 90,
    Acknowledged: 0, AcknowledgedAt: null,
  };

  it('has no lines without a closing', () => {
    expect(closingLines(null, tp, 'pt-BR')).toEqual([]);
    expect(buildTimesheetHtml(body, t, 'pt-BR')).not.toContain('hr.closing.title');
  });

  it('shows pending acknowledgement, DSR and bank hh:mm', () => {
    const lines = closingLines(closed, tp, 'pt-BR');
    expect(lines[0]).toContain('hr.closing.closedAt');
    expect(lines[0]).toContain('02/11/2026');
    expect(lines[1]).toBe('hr.closing.pending');
    expect(lines[2]).toContain('"days":1');
    expect(lines[3]).toContain('"credit":"2:00"');
    expect(lines[3]).toContain('"balance":"+1:30"');
  });

  it('shows the acknowledgement time and omits bank outside bank mode', () => {
    const lines = closingLines({ ...closed, Acknowledged: 1, AcknowledgedAt: '2026-11-03T15:30:00Z', OvertimeMode: 'payment' }, tp, 'pt-BR');
    expect(lines[1]).toContain('hr.closing.acknowledged');
    expect(lines).toHaveLength(3);
  });

  it('shows compensated hours in compensation mode, tolerating a missing field', () => {
    const comp = { ...closed, OvertimeMode: 'compensation', CompensatedMinutes: 135, BankAgreement: null };
    const lines = closingLines(comp, tp, 'pt-BR');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('hr.closing.compensated{"minutes":"2:15"}');
    const old = closingLines({ ...comp, CompensatedMinutes: undefined }, tp, 'pt-BR');
    expect(old[3]).toBe('hr.closing.compensated{"minutes":"0:00"}');
  });

  it('prints the closing in the HTML header, escaped', () => {
    const html = buildTimesheetHtml({ ...body, closing: closed }, (k) => `<${k}>`, 'pt-BR');
    expect(html).toContain('&lt;hr.closing.title&gt;');
    expect(html).toContain('class="closing"');
  });
});
