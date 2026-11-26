import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en-US.json';
import { ApiService } from '../../services/api.service';
import { InternetPageComponent } from './internet-page.component';
import {
  type CustomerPortalIspSubscription,
  type CustomerPortalIspSubscriptionStatus,
  speedLabel,
  trafficLabel,
} from './internet.model';

const SUBSCRIPTION: CustomerPortalIspSubscription = {
  subscriptionUUID: 'sub-1',
  subscriptionID: 101,
  status: 'active',
  effectiveState: 'active',
  planName: 'Fibra 500M',
  downloadKbps: 500000,
  uploadKbps: 250000,
  technology: 'FTTH',
  framedIp: '100.64.10.20',
  accessUsername: 'user101',
  activationDate: '2026-01-01',
  cancellationDate: null,
  addressStreet: 'Rua Principal',
  addressNumber: '100',
  addressDistrict: 'Centro',
  addressCity: 'São Paulo',
  addressState: 'SP',
  addressZip: '01001-000',
  addressMunicipalityCode: '3550308',
  dunningBlocked: 0,
  trustUnlockActive: 0,
};

const STATUS: CustomerPortalIspSubscriptionStatus = {
  subscriptionUUID: 'sub-1',
  isOnline: 1,
  ipAddress: '100.64.10.20',
  username: 'user101',
  sessionStartedAt: '2026-11-25T10:00:00Z',
  monthlyDownloadBytes: 42949672960,
  monthlyUploadBytes: 10737418240,
};

describe('internet model', () => {
  it('formats speeds and traffic correctly', () => {
    expect(speedLabel(0)).toBe('0 Mbps');
    expect(speedLabel(500000)).toBe('500 Mbps');
    expect(speedLabel(1000000)).toBe('1.0 Gbps');
    expect(trafficLabel(0)).toBe('0 GB');
    expect(trafficLabel(42949672960)).toBe('40.0 GB');
  });
});

describe('InternetPageComponent', () => {
  let apiGet: ReturnType<typeof vi.fn>;
  let apiPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiGet = vi.fn().mockImplementation((path: string) => {
      if (path.includes('/status')) {
        return Promise.resolve({ data: { status: STATUS } });
      }
      return Promise.resolve({ data: { items: [SUBSCRIPTION] } });
    });
    apiPost = vi.fn().mockResolvedValue({ data: { result: { unlocked: 1 } } });

    TestBed.configureTestingModule({
      imports: [
        InternetPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { 'en-US': en },
          translocoConfig: { availableLangs: ['en-US'], defaultLang: 'en-US' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ApiService,
          useValue: { get: apiGet, post: apiPost },
        },
      ],
    });
  });

  it('loads subscriptions on mount', async () => {
    const fixture = TestBed.createComponent(InternetPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(apiGet).toHaveBeenCalledWith('customer-portal/isp/subscriptions');
    expect(fixture.componentInstance.subscriptions().length).toBe(1);
    expect(fixture.componentInstance.subscriptions()[0].planName).toBe('Fibra 500M');
  });

  it('triggers trust unlock when requested', async () => {
    const fixture = TestBed.createComponent(InternetPageComponent);
    const component = fixture.componentInstance;
    await component.load();
    const blockedSub = { ...SUBSCRIPTION, dunningBlocked: 1 };
    await component.unlock(blockedSub);

    expect(apiPost).toHaveBeenCalledWith(
      'customer-portal/isp/subscriptions/sub-1/trust-unlock',
      expect.any(Object),
    );
    expect(component.unlockSuccess()).toBe(true);
  });

  it('selects an eligible plan with distinct synthetic IDs, verifies URL and body mapping, and renders pending plan on screen', async () => {
    const fixture = TestBed.createComponent(InternetPageComponent);
    const component = fixture.componentInstance;
    await component.load();

    const sub = component.subscriptions()[0];
    // Subscription synthetic ID is 'sub-1'
    expect(sub.subscriptionUUID).toBe('sub-1');

    component.openChangePlan(sub);
    // Distinct synthetic IDs: subscription is 'sub-1', plan is 'plan-1g'
    expect(component.selectedPlanUUID()).toBe('plan-600m');
    component.selectedPlanUUID.set('plan-1g');
    component.changePlanNotes.set('Solicito upgrade para 1 Gbps');

    apiPost.mockResolvedValueOnce({
      data: {
        item: {
          subscriptionUUID: 'sub-1',
          pendingPlanUUID: 'plan-1g',
          pendingPlanName: 'Fibra 1 Giga Gamer',
          pendingPlanDate: '2026-11-26',
        },
      },
    });

    apiGet.mockImplementation((path: string) => {
      if (path.includes('/status')) {
        return Promise.resolve({ data: { status: STATUS } });
      }
      return Promise.resolve({
        data: {
          items: [{
            ...SUBSCRIPTION,
            pendingPlanUUID: 'plan-1g',
            pendingPlanName: 'Fibra 1 Giga Gamer',
            pendingPlanDate: '2026-11-26',
          }],
        },
      });
    });

    await component.submitChangePlan();

    // 1. Confirms URL carries subscription ID ('sub-1')
    // 2. Confirms request body carries the selected plan ID ('plan-1g')
    expect(apiPost).toHaveBeenCalledWith(
      'customer-portal/isp/subscriptions/sub-1/change-plan',
      { planUUID: 'plan-1g', notes: 'Solicito upgrade para 1 Gbps' },
    );

    // 3. Confirms screen renders the pending plan returned by the API
    const updatedSub = component.subscriptions().find((s) => s.subscriptionUUID === 'sub-1');
    expect(updatedSub?.pendingPlanName).toBe('Fibra 1 Giga Gamer');
    expect(component.changePlanSuccess()).toContain('Fibra 1 Giga Gamer');

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Fibra 1 Giga Gamer');
  });
});
