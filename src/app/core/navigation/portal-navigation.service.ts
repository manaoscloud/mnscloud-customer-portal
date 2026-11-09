import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';

export type PortalSection = { section: string; visible: boolean };
type NavigationResponse = { data?: { items?: PortalSection[] } };

/** Section key of a menu path: `/ged` → `ged`. */
export function sectionOf(path: string): string {
  return path.replace(/^\/+/, '').split('/')[0] ?? '';
}

/**
 * Hides only the menu entries the API marks as not visible. An entry the API does not list (a
 * section shipping elsewhere) and a failed request keep the full menu: the menu is a convenience,
 * every module route still checks access on the server.
 */
export function filterMenu<T extends { items: { path: string }[] }>(
  groups: T[],
  hidden: ReadonlySet<string>,
): T[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !hidden.has(sectionOf(item.path))),
    }))
    .filter((group) => group.items.length > 0);
}

@Injectable({ providedIn: 'root' })
export class PortalNavigationService {
  private readonly api = inject(ApiService);
  readonly hidden = signal<ReadonlySet<string>>(new Set());

  async load(): Promise<void> {
    try {
      const response = await this.api.get<NavigationResponse>('customer-portal/navigation');
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      this.hidden.set(
        new Set(items.filter((item) => item && item.visible === false).map((item) => item.section)),
      );
    } catch {
      this.hidden.set(new Set());
    }
  }
}
