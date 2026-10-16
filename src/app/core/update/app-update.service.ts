import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { version as BUNDLE_VERSION } from '../../../../package.json';

/** Build metadata written by mnscloud-webapps next to index.html of the active release. */
export const BUILD_METADATA_FILE = 'build.json';
export const PORTAL_PRODUCT = 'mnscloud-customer-portal';
/** Background check cadence while the tab is visible (jittered to spread load). */
export const UPDATE_POLL_MS = 5 * 60_000;
/** Minimum spacing between checks triggered by focus, navigation or network events. */
export const UPDATE_MIN_CHECK_GAP_MS = 60_000;
/** A new version must be read twice, this far apart, before it is announced. */
export const UPDATE_CONFIRM_DELAY_MS = 45_000;
/** "Later" hides the notice for this long; a different version shows it again at once. */
export const UPDATE_SNOOZE_MS = 4 * 60 * 60_000;

const SNOOZE_STORAGE_KEY = 'mnscloud_customer_portal_update_snooze';
const CHUNK_RELOAD_STORAGE_KEY = 'mnscloud_customer_portal_chunk_reload';
const CHANNEL_NAME = 'mnscloud-customer-portal-update';
const CHUNK_ERROR_PATTERN =
  /Loading chunk|ChunkLoadError|dynamically imported module|Importing a module script failed|error loading dynamically imported/i;

export type DeployedBuild = {
  version: string;
  /** Releases below this version must update (critical fix); null when no policy is set. */
  minimumVersion?: string | null;
};
type Snooze = { version: string; until: number };

/**
 * Detects that a newer portal release went live while the tab stays open, by reading the
 * release's `build.json` and comparing it with the version compiled into this bundle. It never
 * reloads while the customer works: it shows a calm notice and, with an update pending, turns the
 * next route change into a full page load of the same target.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly runningVersion = normalizeVersion(BUNDLE_VERSION);
  readonly deployed = signal<DeployedBuild | null>(null);
  readonly updateAvailable = computed(() => {
    const deployed = this.deployed();
    return Boolean(deployed && deployed.version !== this.runningVersion);
  });
  /** Running below the deployed `minimumVersion`: the notice cannot be postponed. */
  readonly critical = computed(() => {
    const minimum = this.deployed()?.minimumVersion;
    return Boolean(
      minimum && this.updateAvailable() && compareSemver(this.runningVersion, minimum) < 0,
    );
  });
  private readonly snooze = signal<Snooze | null>(readSnooze());
  private readonly now = signal(Date.now());
  readonly noticeVisible = computed(() => {
    const deployed = this.deployed();
    if (!deployed || !this.updateAvailable()) return false;
    if (this.critical()) return true;
    const snooze = this.snooze();
    return !snooze || snooze.version !== deployed.version || snooze.until <= this.now();
  });

  private started = false;
  private lastCheckAt = 0;
  private inFlight: Promise<void> | null = null;
  private candidate: (DeployedBuild & { seenAt: number }) | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;
  /** True once the customer typed on the current page; reset on every route change. */
  private editedSinceNavigation = false;

  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    const onVisible = () => {
      this.now.set(Date.now());
      if (document.visibilityState === 'visible') void this.check();
    };
    const onFocusOrOnline = () => {
      this.now.set(Date.now());
      void this.check();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SNOOZE_STORAGE_KEY) this.snooze.set(readSnooze());
    };
    const onInput = () => {
      this.editedSinceNavigation = true;
    };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('input', onInput, true);
    window.addEventListener('focus', onFocusOrOnline);
    window.addEventListener('online', onFocusOrOnline);
    window.addEventListener('storage', onStorage);

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<DeployedBuild>) => {
        const version = normalizeVersion(event.data?.version);
        const minimum = normalizeVersion(event.data?.minimumVersion);
        if (version) {
          this.accept(
            { version, minimumVersion: isReleaseVersion(minimum) ? minimum : null },
            false,
          );
        }
      };
    }

    // Boundary adapter: NavigationStart must be handled synchronously to reload before the route.
    const routerEvents = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.onNavigationStart(event);
      if (event instanceof NavigationEnd) this.editedSinceNavigation = false;
      if (event instanceof NavigationError) this.onNavigationError(event);
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('input', onInput, true);
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('online', onFocusOrOnline);
      window.removeEventListener('storage', onStorage);
      routerEvents.unsubscribe();
      this.channel?.close();
      this.clearTimers();
    });

    this.schedulePoll();
    void this.check(true);
  }

  check(force = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const now = Date.now();
    if (!force && now - this.lastCheckAt < UPDATE_MIN_CHECK_GAP_MS) return Promise.resolve();
    this.lastCheckAt = now;
    this.now.set(now);
    this.inFlight = fetchDeployedBuild()
      .then((build) => {
        if (build) this.observe(build, Date.now());
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  postpone() {
    const deployed = this.deployed();
    if (!deployed) return;
    const snooze = { version: deployed.version, until: Date.now() + UPDATE_SNOOZE_MS };
    this.snooze.set(snooze);
    writeStorage(SNOOZE_STORAGE_KEY, JSON.stringify(snooze));
  }

  /** True when the customer typed on this page, i.e. a reload could discard unsaved input. */
  hasOpenWork() {
    return this.editedSinceNavigation;
  }

  reloadNow() {
    window.location.reload();
  }

  /** Feeds one `build.json` read into the confirmation state. */
  observe(build: DeployedBuild, at: number) {
    const current = this.deployed();
    if (build.version === (current?.version ?? this.runningVersion)) {
      this.candidate = null;
      this.clearConfirmTimer();
      if (!current || (current.minimumVersion ?? null) !== (build.minimumVersion ?? null)) {
        this.deployed.set(build);
      }
      return;
    }
    const candidate = this.candidate;
    if (candidate && candidate.version === build.version) {
      if (at - candidate.seenAt >= UPDATE_CONFIRM_DELAY_MS) this.accept(build, true);
      return;
    }
    this.candidate = { ...build, seenAt: at };
    this.clearConfirmTimer();
    this.confirmTimer = setTimeout(() => void this.check(true), UPDATE_CONFIRM_DELAY_MS);
  }

  private accept(build: DeployedBuild, broadcast: boolean) {
    this.candidate = null;
    this.clearConfirmTimer();
    const current = this.deployed();
    if (
      current?.version === build.version &&
      (current.minimumVersion ?? null) === (build.minimumVersion ?? null)
    ) {
      return;
    }
    this.deployed.set(build);
    if (broadcast) this.channel?.postMessage(build);
  }

  private onNavigationStart(event: NavigationStart) {
    if (
      (event.navigationTrigger === 'imperative' || event.navigationTrigger === 'popstate') &&
      this.updateAvailable() &&
      !this.router.currentNavigation()?.extras.state &&
      pathOf(event.url) !== pathOf(this.router.url)
    ) {
      window.location.assign(new URL(event.url.replace(/^\//, ''), document.baseURI).href);
      return;
    }
    void this.check();
  }

  private onNavigationError(event: NavigationError) {
    const message = event.error instanceof Error ? event.error.message : String(event.error ?? '');
    if (!CHUNK_ERROR_PATTERN.test(message)) return;
    if (readStorage(CHUNK_RELOAD_STORAGE_KEY, 'session') === event.url) return;
    writeStorage(CHUNK_RELOAD_STORAGE_KEY, event.url, 'session');
    window.location.assign(new URL(event.url.replace(/^\//, ''), document.baseURI).href);
  }

  private schedulePoll() {
    const jitter = Math.round((Math.random() - 0.5) * 60_000);
    this.pollTimer = setTimeout(() => {
      if (document.visibilityState === 'visible') void this.check();
      this.schedulePoll();
    }, UPDATE_POLL_MS + jitter);
  }

  private clearConfirmTimer() {
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    this.confirmTimer = null;
  }

  private clearTimers() {
    this.clearConfirmTimer();
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
}

export function normalizeVersion(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/^v/i, '') : '';
}

export function parseBuildMetadata(value: unknown): DeployedBuild | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row['product'] !== PORTAL_PRODUCT) return null;
  const version = normalizeVersion(row['version']);
  if (!isReleaseVersion(version)) return null;
  const minimum = normalizeVersion(row['minimumVersion']);
  return { version, minimumVersion: isReleaseVersion(minimum) ? minimum : null };
}

export function isReleaseVersion(value: string) {
  return /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(value);
}

/** Compares the numeric `major.minor.patch` part; suffixes are ignored. */
export function compareSemver(left: string, right: string) {
  const parts = (value: string) =>
    normalizeVersion(value)
      .split(/[+-]/)[0]
      .split('.')
      .map((item) => Number(item) || 0);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchDeployedBuild(): Promise<DeployedBuild | null> {
  try {
    const url = new URL(BUILD_METADATA_FILE, document.baseURI);
    url.searchParams.set('t', String(Date.now()));
    const response = await fetch(url.href, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return parseBuildMetadata(await response.json());
  } catch {
    return null;
  }
}

function pathOf(url: string) {
  return url.split(/[?#]/)[0] || '/';
}

function readSnooze(): Snooze | null {
  try {
    const value = JSON.parse(readStorage(SNOOZE_STORAGE_KEY) ?? 'null') as Snooze | null;
    return value && typeof value.version === 'string' && typeof value.until === 'number'
      ? value
      : null;
  } catch {
    return null;
  }
}

function storage(kind: 'local' | 'session') {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readStorage(key: string, kind: 'local' | 'session' = 'local') {
  try {
    return storage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string, kind: 'local' | 'session' = 'local') {
  try {
    storage(kind)?.setItem(key, value);
  } catch {
    // Storage may be blocked (private mode); the notice still works for this tab.
  }
}
