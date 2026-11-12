/** A published server of the customer, as the portal API returns it (no provider data). */
export type VpsServer = {
  HviUUID: string;
  HviName: string;
  HviStatus: string | null;
  Provisioned: number;
  PowerHeld: number;
  PlanName: string | null;
  PublicIpv4: string | null;
  PublicIpv6: string | null;
  PrivateIpv4: string | null;
  Username: string | null;
  Vcpus: string | null;
  MemoryMb: string | null;
  DiskGb: string | null;
  GraphicalConsole: number;
  CanPower: number;
  CanConsole: number;
  CanSnapshots: number;
  DateCreated: string | null;
};

export type VpsPowerAction = 'start' | 'stop' | 'reboot';

const RUNNING = new Set(['running', 'active']);
const PENDING = new Set(['starting', 'stopping', 'rebooting', 'provisioning', 'new', 'resizing']);

/** Status family of a server, for the label, the colour and the actions offered. */
export function serverState(
  server: VpsServer,
): 'running' | 'stopped' | 'pending' | 'held' | 'unknown' {
  if (server.PowerHeld === 1) return 'held';
  const status = (server.HviStatus ?? '').toLowerCase();
  if (RUNNING.has(status)) return 'running';
  if (status === 'stopped' || status === 'off') return 'stopped';
  if (PENDING.has(status) || server.Provisioned !== 1) return 'pending';
  return 'unknown';
}

/** Power actions the customer may ask for now (the API checks again). */
export function powerActions(server: VpsServer): VpsPowerAction[] {
  if (server.CanPower !== 1 || server.Provisioned !== 1) return [];
  const state = serverState(server);
  if (state === 'stopped') return ['start'];
  if (state === 'running') return ['reboot', 'stop'];
  return [];
}

/** Memory in GB for display ("2 GB", "0.5 GB"). */
export function memoryLabel(memoryMb: string | null): string | null {
  const value = Number(memoryMb);
  if (!Number.isFinite(value) || value <= 0) return null;
  const gb = value / 1024;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
}

/** A snapshot of a published server (no provider id or job details). */
export type VpsSnapshot = {
  HvsUUID: string;
  HvsName: string;
  HvsStatus: string;
  SizeGb: number | string | null;
  DateCreated: string | null;
  DateCompleted: string | null;
};

export type VpsSnapshotList = {
  items: VpsSnapshot[];
  canManage: number;
  activeCount: number;
  limit: number;
  capabilities: { create: boolean; restore: boolean };
};

/** States in which a snapshot job is running; nothing else may start meanwhile. */
const SNAPSHOT_BUSY = new Set(['queued', 'creating', 'restoring', 'deleting']);

export function snapshotBusy(snapshot: VpsSnapshot): boolean {
  return SNAPSHOT_BUSY.has((snapshot.HvsStatus ?? '').toLowerCase());
}

/** Label key of a snapshot state (unknown states read as failed). */
export function snapshotState(snapshot: VpsSnapshot): string {
  const status = (snapshot.HvsStatus ?? '').toLowerCase();
  if (status === 'available') return 'available';
  if (SNAPSHOT_BUSY.has(status)) return status;
  return 'failed';
}

export type VpsMetricPoint = {
  metricKey: string;
  unit: string;
  bucketEpoch: number;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
};

export type VpsMetrics = {
  supported: boolean;
  windowHours: number;
  collectedAt: string | null;
  items: VpsMetricPoint[];
};

export type VpsMetricWindow = 1 | 24 | 168;

/** Charts of the portal: each line takes the first series key the provider reports. */
export const VPS_METRIC_CHARTS: ReadonlyArray<{
  key: string;
  lines: ReadonlyArray<readonly string[]>;
}> = [
  { key: 'cpu', lines: [['vps.cpu.usage_percent']] },
  { key: 'memory', lines: [['vps.memory.usage_percent']] },
  { key: 'disk', lines: [['vps.disk.usage_percent']] },
  {
    key: 'network',
    lines: [
      ['vps.network.inbound', 'vps.bandwidth.inbound'],
      ['vps.network.outbound', 'vps.bandwidth.outbound'],
    ],
  },
];

export type ChartLine = { unit: string; points: Array<{ x: number; y: number }> };

/** Points (time, average) of the first key that has data, oldest first. */
export function metricLine(items: VpsMetricPoint[], keys: readonly string[]): ChartLine | null {
  for (const key of keys) {
    const points = items
      .filter(
        (p) => p.metricKey === key && typeof p.average === 'number' && Number.isFinite(p.average),
      )
      .map((p) => ({ x: p.bucketEpoch, y: p.average as number }))
      .sort((a, b) => a.x - b.x);
    if (points.length) {
      return { unit: items.find((p) => p.metricKey === key)?.unit ?? '', points };
    }
  }
  return null;
}

/** SVG path of a line inside width x height, scaled to [minX, maxX] and [0, maxY]. */
export function chartPath(
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  minX: number,
  maxX: number,
  maxY: number,
): string {
  const spanX = maxX - minX || 1;
  const top = maxY > 0 ? maxY : 1;
  return points
    .map((p, i) => {
      const x = ((p.x - minX) / spanX) * width;
      const y = height - (Math.min(Math.max(p.y, 0), top) / top) * height;
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Human value of a metric ("42.0%", "1.5 MB", "3.2 MB/s"). */
export function metricValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (unit === '%' || /percent/i.test(unit)) return `${value.toFixed(1)}%`;
  if (/byte/i.test(unit)) {
    const steps = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = Math.abs(value);
    let i = 0;
    while (n >= 1024 && i < steps.length - 1) {
      n /= 1024;
      i += 1;
    }
    const rate = /\/s|per.?s/i.test(unit) ? '/s' : '';
    return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${steps[i]}${rate}`;
  }
  return `${Number(value.toFixed(2))} ${unit}`.trim();
}
