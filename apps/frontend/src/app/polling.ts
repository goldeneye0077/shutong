const ACTIVE_STATUSES = new Set(["queued", "processing", "pending"]);

export function getActiveRefetchInterval(
  statuses: Array<string | null | undefined>,
  intervalMs = 5000
): number | false {
  return statuses.some((status) => status && ACTIVE_STATUSES.has(status)) ? intervalMs : false;
}
