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

  it('loads eligible plans from backend with distinct UUIDs, submits selection, renders pending plan, and forbids submit when no eligible plans exist', async () => {
    const subUUID = '11111111-1111-4111-8111-111111111111';
    const planUUID1 = '22222222-2222-4222-8222-222222222222';
    const planUUID2 = '33333333-3333-4333-8333-333333333333';

    const testSub: CustomerPortalIspSubscription = {
      ...SUBSCRIPTION,
      subscriptionUUID: subUUID,
    };

    const eligibleList = [
      { planUUID: planUUID1, name: 'Fibra 600M Turbo', downloadKbps: 600000, uploadKbps: 300000 },
      { planUUID: planUUID2, name: 'Fibra 1 Giga Gamer', downloadKbps: 1000000, uploadKbps: 500000 },
    ];

    apiGet.mockImplementation((path: string) => {
      if (path.includes('/eligible-plans')) {
        return Promise.resolve({ data: { items: eligibleList } });
      }
      if (path.includes('/status')) {
        return Promise.resolve({ data: { status: { ...STATUS, subscriptionUUID: subUUID } } });
      }
      return Promise.resolve({
        data: {
          items: [testSub],
        },
      });
    });

    const fixture = TestBed.createComponent(InternetPageComponent);
    const component = fixture.componentInstance;
    await component.load();

    const sub = component.subscriptions()[0];
    expect(sub.subscriptionUUID).toBe(subUUID);

    // 1. Open change plan dialog: loads eligible plans from backend
    await component.openChangePlan(sub);
    expect(apiGet).toHaveBeenCalledWith(
      `customer-portal/isp/subscriptions/${subUUID}/eligible-plans`,
    );
    expect(component.eligiblePlans().length).toBe(2);
    expect(component.selectedPlanUUID()).toBe(planUUID1);

    // 2. Select distinct plan UUID
    component.selectedPlanUUID.set(planUUID2);
    component.changePlanNotes.set('Solicito upgrade para 1 Gbps');

    apiPost.mockImplementation(async () => {
      testSub.pendingPlanName = 'Fibra 1 Giga Gamer';
      testSub.pendingPlanUUID = planUUID2;
      testSub.pendingPlanDate = '2026-11-26';
      return {
        data: {
          item: {
            subscriptionUUID: subUUID,
            pendingPlanUUID: planUUID2,
            pendingPlanName: 'Fibra 1 Giga Gamer',
            pendingPlanDate: '2026-11-26',
          },
        },
      };
    });

    await component.submitChangePlan();

    // 3. Confirm URL carries subscription ID and body carries selected plan ID
    expect(apiPost).toHaveBeenCalledWith(
      `customer-portal/isp/subscriptions/${subUUID}/change-plan`,
      { planUUID: planUUID2, notes: 'Solicito upgrade para 1 Gbps' },
    );

    // 4. Confirm screen renders pending plan
    const updatedSub = component.subscriptions().find((s) => s.subscriptionUUID === subUUID);
    expect(updatedSub?.pendingPlanName).toBe('Fibra 1 Giga Gamer');
    expect(component.changePlanSuccess()).toContain('Fibra 1 Giga Gamer');

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Fibra 1 Giga Gamer');

    // 5. When no eligible option exists, submission is forbidden
    apiPost.mockClear();
    apiGet.mockImplementation((path: string) => {
      if (path.includes('/eligible-plans')) {
        return Promise.resolve({ data: { items: [] } });
      }
      return Promise.resolve({ data: { items: [testSub] } });
    });

    await component.openChangePlan(sub);
    expect(component.eligiblePlans().length).toBe(0);
    expect(component.selectedPlanUUID()).toBe('');

    fixture.detectChanges();
    // Direct submitChangePlan must early-return and not invoke apiPost
    await component.submitChangePlan();
    expect(apiPost).not.toHaveBeenCalled();
  });
});
