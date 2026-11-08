import { TestBed } from '@angular/core/testing';
import { ApiService } from '../../services/api.service';
import { filterMenu, PortalNavigationService, sectionOf } from './portal-navigation.service';

const MENU = [
  {
    title: 'overview',
    items: [{ path: '/dashboard' }, { path: '/ged' }, { path: '/dns' }, { path: '/security' }],
  },
  { title: 'account', items: [{ path: '/users' }] },
];

function service(get: () => Promise<unknown>) {
  TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { get } }] });
  return TestBed.inject(PortalNavigationService);
}

describe('portal navigation', () => {
  it('maps menu paths to section keys', () => {
    expect(sectionOf('/ged')).toBe('ged');
    expect(sectionOf('crm/workspaces')).toBe('crm');
  });

  it('hides only sections marked not visible and drops empty groups', () => {
    const result = filterMenu(MENU, new Set(['ged', 'users']));
    expect(result.map((group) => group.title)).toEqual(['overview']);
    expect(result[0].items.map((item) => item.path)).toEqual(['/dashboard', '/dns', '/security']);
  });

  it('keeps sections the API does not list', async () => {
    const nav = service(() =>
      Promise.resolve({
        data: {
          items: [
            { section: 'ged', visible: false },
            { section: 'dns', visible: true },
          ],
        },
      }),
    );
    await nav.load();
    expect([...nav.hidden()]).toEqual(['ged']);
    expect(filterMenu(MENU, nav.hidden())[0].items.map((item) => item.path)).toContain('/security');
  });

  it('keeps the full menu when the request fails', async () => {
    const nav = service(() => Promise.reject(new Error('unavailable')));
    await nav.load();
    expect(nav.hidden().size).toBe(0);
  });
});
