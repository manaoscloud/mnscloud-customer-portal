import { TestBed } from '@angular/core/testing';
import { provideTransloco, TranslocoTestingModule } from '@jsverse/transloco';
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
      imports: [HrRequestsComponent, TranslocoTestingModule.forRoot({ langs: {}, translocoConfig: { availableLangs: ['pt-BR'], defaultLang: 'pt-BR' } })],
      providers: [{ provide: ApiService, useValue: api }, provideTransloco({ config: { availableLangs: ['pt-BR'], defaultLang: 'pt-BR' } })],
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
  });
});
