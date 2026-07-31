export type UxMetricEvent =
  | 'tables.checkout.open'
  | 'tables.checkout.method.change'
  | 'tables.checkout.submit.click'
  | 'tables.checkout.pay.success'
  | 'tables.checkout.pay.error'
  | 'tables.checkout.split.success'
  | 'tables.checkout.split.error'
  | 'tables.checkout.retry'
  | 'tables.action.open_pos'
  | 'pos.checkout.open'
  | 'pos.checkout.submit.click'
  | 'pos.checkout.pay.success'
  | 'pos.checkout.pay.error'
  | 'pos.checkout.split.success'
  | 'pos.checkout.split.error'
  | 'pos.checkout.split.click'
  | 'pos.checkout.split.init'
  | 'pos.checkout.split.mark_paid'
  | 'pos.checkout.pay_items.success'
  | 'pos.checkout.pay_items.error'
  | 'pos.checkout.pay_items.click'
  | 'pos.checkout.pay_items.confirm'
  | 'pos.checkout.close.confirm'
  | 'kitchen.filter.change'
  | 'kitchen.zone.change'
  | 'kitchen.batch.open'
  | 'kitchen.batch.apply.success'
  | 'kitchen.batch.apply.error'
  | 'dashboard.void.confirm.open'
  | 'dashboard.void.success'
  | 'dashboard.void.error'
  | 'reservations.status.update.success'
  | 'reservations.status.update.error'
  | 'kitchen.status.update.success'
  | 'kitchen.status.update.error';

const STORAGE_KEY = 'gustopos:ux:metrics';

type MetricsMap = Record<string, number>;

function readMetrics(): MetricsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as MetricsMap;
  } catch {
    return {};
  }
}

function writeMetrics(metrics: MetricsMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // non-blocking telemetry
  }
}

export function trackUxMetric(event: UxMetricEvent) {
  const current = readMetrics();
  current[event] = (current[event] ?? 0) + 1;
  writeMetrics(current);
}
