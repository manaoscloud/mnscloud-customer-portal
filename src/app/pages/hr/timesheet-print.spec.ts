import { buildTimesheetHtml, escapeHtml, minutesText, type PrintTimesheet } from './timesheet-print';

const t = (key: string) => `[${key}]`;

const body: PrintTimesheet = {
  header: {
    employer: { Name: 'Posto <b>X</b> & Cia', Document: '12.345.678/0001-90', DocumentKind: 'cnpj' },
    employee: { Name: 'Ana "A" <script>', Document: '123.456.789-09', HireDate: '2024-03-05', PositionName: 'Frentista', DepartmentName: null },
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

  it('tolerates a body without header, adjustments or days', () => {
    expect(() => buildTimesheetHtml({}, t, 'en-US')).not.toThrow();
    const html = buildTimesheetHtml({ days: [{ Date: '2026-10-02', DayKind: 'off' }] }, t, 'en-US');
    expect(html).not.toContain('[hr.print.legend]');
  });

  it('formats minutes', () => {
    expect(minutesText(75, true)).toBe('+1:15');
    expect(minutesText(undefined)).toBe('0:00');
  });
});
