/** What the customer sees of a storage account (V4; never prices, cost or notes). */
export type StorageAccount = {
  HsaUUID: string;
  HsaName: string;
  BucketCount: number;
  UsedBytes: number;
  MeasuredAt: string | null;
  DateCreated: string | null;
};

/** What the customer sees of a bucket: never the provider, physical identity, config or errors. */
export type StorageBucket = {
  HsbUUID: string;
  HsbName: string;
  State: string;
  UsedBytes: number | null;
  LimitBytes: number | null;
  MeasuredAt: string | null;
  DateCreated: string | null;
};

export type BucketState = 'ready' | 'pending' | 'failed' | 'deleting';

/** Portal state of a bucket: provisioning and pending read the same for the customer. */
export function bucketState(bucket: Pick<StorageBucket, 'State'>): BucketState {
  switch (bucket.State) {
    case 'ready':
      return 'ready';
    case 'failed':
      return 'failed';
    case 'deleting':
      return 'deleting';
    default:
      return 'pending';
  }
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/** Binary size label (1 KB = 1024 B), one decimal from KB up; null for unknown. */
export function sizeLabel(bytes: number | string | null | undefined): string | null {
  if (bytes === null || bytes === undefined || bytes === '') return null;
  let value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return null;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = unit === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
  return `${text} ${UNITS[unit]}`;
}

/** Share of the limit in use (0-100), or null without a limit. */
export function usagePercent(
  bucket: Pick<StorageBucket, 'UsedBytes' | 'LimitBytes'>,
): number | null {
  const limit = Number(bucket.LimitBytes ?? 0);
  if (!limit || limit <= 0) return null;
  const used = Math.max(0, Number(bucket.UsedBytes ?? 0));
  return Math.min(100, Math.round((used / limit) * 100));
}
