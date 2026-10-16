import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  AppUpdateService,
  parseBuildMetadata,
  UPDATE_CONFIRM_DELAY_MS,
} from './app-update.service';
import { AppUpdateNoticeComponent } from './app-update-notice.component';

describe('AppUpdateService', () => {
  let service: AppUpdateService;
  const newer = '999.0.0';

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    service = TestBed.inject(AppUpdateService);
  });

  function announce(version = newer, at = 0) {
    service.observe({ version }, at);
    service.observe({ version }, at + UPDATE_CONFIRM_DELAY_MS);
  }

  it('parses only portal build metadata with a semantic version', () => {
    expect(parseBuildMetadata({ product: 'mnscloud-customer-portal', version: 'v1.2.3' })).toEqual({
      version: '1.2.3',
    });
    expect(parseBuildMetadata({ product: 'mnscloud-phoneweb', version: '1.2.3' })).toBeNull();
    expect(parseBuildMetadata({ product: 'mnscloud-customer-portal', version: '<x>' })).toBeNull();
  });

  it('stays quiet while the deployed release equals the running bundle', () => {
    service.observe({ version: service.runningVersion }, 0);
    expect(service.updateAvailable()).toBe(false);
  });

  it('announces a new release only after two reads agree over the confirmation delay', () => {
    service.observe({ version: newer }, 0);
    service.observe({ version: newer }, UPDATE_CONFIRM_DELAY_MS - 1);
    expect(service.updateAvailable()).toBe(false);
    service.observe({ version: newer }, UPDATE_CONFIRM_DELAY_MS);
    expect(service.noticeVisible()).toBe(true);
  });

  it('hides the notice after "later" until another release arrives', () => {
    announce();
    service.postpone();
    expect(service.noticeVisible()).toBe(false);
    announce('999.0.1', 100_000);
    expect(service.noticeVisible()).toBe(true);
  });

  it('clears the update after a rollback to the running version', () => {
    announce();
    announce(service.runningVersion, 200_000);
    expect(service.updateAvailable()).toBe(false);
  });

  it('asks before reloading when the customer typed on the page', async () => {
    announce();
    vi.spyOn(service, 'start').mockImplementation(() => undefined);
    vi.spyOn(service, 'hasOpenWork').mockReturnValue(true);
    const reload = vi.spyOn(service, 'reloadNow').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(AppUpdateNoticeComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="status"]')?.textContent).toContain('v999.0.0');
    const primary = () => element.querySelector('button[mat-flat-button]') as HTMLButtonElement;
    primary().click();
    await fixture.whenStable();
    expect(reload).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Update anyway');
    primary().click();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
