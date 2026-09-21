// Pure hunger-notification throttle: no Electron, no DOM, no Date.
// Main keeps lastNotifiedAt in memory; renderer snapshots drive the check.

/** Don't spam: at most one hunger toast per cooldown. */
export const HUNGER_NOTIFY_COOLDOWN_MS = 15 * 60 * 1000;

export function shouldNotifyHunger(
  lastNotifiedAt: number | null,
  hungry: boolean,
  now: number,
  cooldownMs: number = HUNGER_NOTIFY_COOLDOWN_MS,
): boolean {
  if (!hungry) return false;
  if (lastNotifiedAt === null || lastNotifiedAt === undefined) return true;
  return now - lastNotifiedAt >= cooldownMs;
}
