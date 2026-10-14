import { Injectable, effect, signal } from '@angular/core';

export type ColorScheme = 'light' | 'dark';

const SCHEME_KEY = 'mnscloud_customer_portal_color_scheme';

function readStoredScheme(): ColorScheme | null {
  try {
    const value = localStorage.getItem(SCHEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function systemScheme(): ColorScheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly schemeState = signal<ColorScheme>(readStoredScheme() ?? systemScheme());

  readonly scheme = this.schemeState.asReadonly();

  constructor() {
    effect(() => {
      const scheme = this.schemeState();
      const root = document.documentElement;
      root.classList.toggle('dark-theme', scheme === 'dark');
      root.style.colorScheme = scheme;
    });
  }

  toggle(): void {
    const next: ColorScheme = this.schemeState() === 'dark' ? 'light' : 'dark';
    this.schemeState.set(next);
    try {
      localStorage.setItem(SCHEME_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the choice still applies to this session.
    }
  }
}
