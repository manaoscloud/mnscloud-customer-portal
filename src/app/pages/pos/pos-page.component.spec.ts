import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiError, ApiService } from '../../services/api.service';
import { groupByShop, PosPageComponent, type PosTerminal } from './pos-page.component';

const terminal = (uuid: string, shop: string, cashOpen = false): PosTerminal => ({
  terminalUUID: uuid,
  terminalName: `Caixa ${uuid}`,
  accountUUID: shop,
  accountName: `Loja ${shop}`,
  operatorName: 'Maria',
  cashOpen,
});

describe('POS portal page', () => {
  let calls: [string, string, unknown?][];
  let listFails: ApiError | null;
  let postFails: boolean;
  let popup: { opener: unknown; location: { href: string }; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    calls = [];
    listFails = null;
    postFails = false;
    popup = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const api = {
      get: async (url: string) => {
        calls.push(['GET', url]);
        if (listFails) throw listFails;
        return {
          data: {
            items: [terminal('T1', 'A', true), terminal('T2', 'A'), terminal('T3', 'B')],
          },
        };
      },
      post: async (url: string, body: unknown) => {
        calls.push(['POST', url, body]);
        if (postFails) throw new ApiError('nope', 500);
        return { data: { code: 'a+b/c', expiresIn: 60, path: '/pos/' } };
      },
    };
    TestBed.configureTestingModule({
      imports: [
        PosPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: ApiService, useValue: api }],
    });
  });

  it('groups terminals by shop', async () => {
    expect(
      groupByShop([terminal('T1', 'A'), terminal('T3', 'B'), terminal('T2', 'A')]).map(
        (s) => s.terminals.length,
      ),
    ).toEqual([2, 1]);
    const fixture = TestBed.createComponent(PosPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('article.shop').length).toBe(2);
    expect(el.querySelectorAll('.terminal').length).toBe(3);
    expect(el.querySelectorAll('.chip').length).toBe(1);
    expect(calls[0]).toEqual(['GET', 'customer-portal/pos/terminals']);
  });

  it('shows the empty state, not an error, when the portal has no POS access', async () => {
    listFails = new ApiError('x', 404, 'POS_PORTAL_UNAVAILABLE');
    const fixture = TestBed.createComponent(PosPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No point of sale available',
    );
  });

  it('opens the POS in the pre-opened window with the code in the fragment', async () => {
    const fixture = TestBed.createComponent(PosPageComponent);
    await fixture.whenStable();
    await fixture.componentInstance.open(terminal('T1', 'A'));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(calls[1]).toEqual(['POST', 'customer-portal/pos/handoffs', { terminalUUID: 'T1' }]);
    expect(popup.opener).toBeNull();
    expect(popup.location.href).toBe('/pos/#handoff=a%2Bb%2Fc');
    expect(popup.close).not.toHaveBeenCalled();
  });

  it('closes the window and reports the failure', async () => {
    postFails = true;
    const fixture = TestBed.createComponent(PosPageComponent);
    await fixture.whenStable();
    await fixture.componentInstance.open(terminal('T1', 'A'));
    expect(popup.close).toHaveBeenCalled();
    expect(popup.location.href).toBe('');
    expect(fixture.componentInstance.openError()).toBe(true);
  });
});
