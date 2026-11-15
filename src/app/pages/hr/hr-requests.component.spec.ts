import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiError, ApiService } from '../../services/api.service';
import { day, HrRequestsComponent, localInstant } from './hr-requests.component';

const request = {
  RequestUUID: 'R1',
  RequestID: '00000001',
  Type: 'missing_punch',
  Status: 'pending',
  EmployeeName: 'MARIA',
  DepartmentName: 'LOJA',
  Date: '2026-11-03',
  EndDate: null,
  PunchType: 'clock_out',
  OccurredAt: '2026-11-03T21:00:00.000Z',
  ContestedPunchType: null,
  ContestedOccurredAt: null,
  AbsenceType: null,
  HasAttachment: false,
  AttachmentFileName: null,
  Reason: 'ESQUECI',
  DecisionNote: null,
  CanDecide: true,
  MessageCount: 0,
  Revision: 3,
};

describe('HR portal requests', () => {
  let calls: [string, string, unknown?][];
  let refuse: ApiError | null;

  beforeEach(() => {
    calls = [];
    refuse = null;
    const api = {
      get: async (url: string) => {
        calls.push(['GET', url]);
        return { data: { items: url.includes('/messages') ? [] : [request] } };
      },
      post: async (url: string, body: unknown) => {
        calls.push(['POST', url, body]);
        if (refuse) throw refuse;
        return { data: {} };
      },
      put: async (url: string, body: unknown) => {
        calls.push(['PUT', url, body]);
        if (refuse) throw refuse;
        return { data: {} };
      },
      getBlob: async () => new Blob(),
    };
    TestBed.configureTestingModule({
      imports: [
        HrRequestsComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: ApiService, useValue: api }],
    });
  });

  it('formats days and instants for the list', () => {
    expect(day('2026-11-03')).toBe('03/11/2026');
    expect(day(null)).toBe('');
    expect(localInstant('nope')).toBe('');
  });

  it('lists pending requests of the account, decides with the revision and keeps a retried message identifier', async () => {
    const fixture = TestBed.createComponent(HrRequestsComponent);
    fixture.componentRef.setInput('account', 'A1');
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(calls[0]).toEqual(['GET', 'customer-portal/hr/accounts/A1/requests?limit=100&status=pending']);
    expect(component.items().map((item) => item.RequestUUID)).toEqual(['R1']);

    await component.toggle(component.items()[0]);
    component.message = ' Pode enviar o horário? ';
    refuse = new ApiError('offline', 0);
    await component.send(component.items()[0]);
    refuse = null;
    await component.send(component.items()[0]);
    const posts = calls.filter(([method]) => method === 'POST').map(([, , body]) => body as { uuid: string; body: string });
    expect(posts.length).toBe(2);
    expect(posts[1].uuid).toBe(posts[0].uuid);
    expect(posts[1].body).toBe('Pode enviar o horário?');

    refuse = new ApiError('Request was changed by another user.', 409, 'REVISION_CONFLICT');
    await component.decide(component.items()[0], 'approve');
    expect(calls.find(([method]) => method === 'PUT')).toEqual([
      'PUT',
      'customer-portal/hr/accounts/A1/requests/R1',
      { decision: 'approve', note: null, revision: 3 },
    ]);
    expect(component.feedback()).toBe('hr.requests.conflict');

    refuse = new ApiError('closed', 409, 'HR_TIMESHEET_CLOSED');
    await component.decide(component.items()[0], 'approve');
    expect(component.feedback()).toBe('hr.requests.monthClosed');
  });

  it('shows a shift swap with the colleague and blocks approval until the colleague accepts', async () => {
    const swap = {
      ...request,
      RequestUUID: 'S1',
      Type: 'shift_swap',
      Date: '2026-12-01',
      SwapDate: '2026-12-03',
      PeerEmployeeName: 'JOAO',
      PeerStatus: 'pending',
      PeerDecidedAt: null,
    };
    const api = TestBed.inject(ApiService) as unknown as { get: (url: string) => Promise<unknown> };
    api.get = async (url: string) => ({ data: { items: url.includes('/messages') ? [] : [swap] } });
    const fixture = TestBed.createComponent(HrRequestsComponent);
    fixture.componentRef.setInput('account', 'A1');
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component.detail(swap as never)).toBe('JOAO · 01/12/2026 ⇄ 03/12/2026');
    expect(component.waitsPeer(swap as never)).toBe(true);
    expect(component.waitsPeer({ ...swap, PeerStatus: 'accepted' } as never)).toBe(false);

    await component.toggle(component.items()[0]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Shift swap');
    expect(text).toContain('Awaiting colleague');
    const approve = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Approve',
    );
    expect(approve?.disabled).toBe(true);

    for (const [code, key] of [
      ['HR_SWAP_PEER_PENDING', 'hr.requests.swap.peerPending'],
      ['HR_SWAP_NOT_ALLOWED', 'hr.requests.swap.notAllowed'],
      ['HR_SCHEDULE_SCOPE_FORBIDDEN', 'hr.requests.swap.scopeForbidden'],
    ] as const) {
      refuse = new ApiError('refused', code === 'HR_SCHEDULE_SCOPE_FORBIDDEN' ? 403 : 409, code);
      await component.decide(component.items()[0], 'approve');
      expect(component.feedback()).toBe(key);
    }
  });
});
