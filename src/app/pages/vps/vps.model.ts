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
  DateCreated: string | null;
};

export type VpsPowerAction = 'start' | 'stop' | 'reboot';

const RUNNING = new Set(['running', 'active']);
const PENDING = new Set(['starting', 'stopping', 'rebooting', 'provisioning', 'new', 'resizing']);

/** Status family of a server, for the label, the colour and the actions offered. */
export function serverState(server: VpsServer): 'running' | 'stopped' | 'pending' | 'held' | 'unknown' {
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
