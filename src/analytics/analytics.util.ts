import { PlanInterval } from '../shared/enums';
import { TrendGranularity } from './analytics.types';

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeToMonthly(
  amount: number,
  interval: PlanInterval,
  customDays?: number,
): number {
  switch (interval) {
    case PlanInterval.MONTHLY:
      return amount;
    case PlanInterval.QUARTERLY:
      return amount / 3;
    case PlanInterval.YEARLY:
      return amount / 12;
    case PlanInterval.CUSTOM:
      return (amount / (customDays ?? 30)) * 30;
    default:
      return amount;
  }
}

export function parseAmount(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

export function defaultTrendRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = daysAgo(30);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function resolveDateRange(
  from?: string,
  to?: string,
): { from: Date; to: Date } {
  const defaults = defaultTrendRange();
  const resolvedFrom = from ? new Date(from) : defaults.from;
  const resolvedTo = to ? new Date(to) : defaults.to;

  if (
    Number.isNaN(resolvedFrom.getTime()) ||
    Number.isNaN(resolvedTo.getTime())
  ) {
    return defaults;
  }

  if (resolvedFrom > resolvedTo) {
    return { from: resolvedTo, to: resolvedFrom };
  }

  return { from: resolvedFrom, to: resolvedTo };
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function truncateDate(
  date: Date,
  granularity: TrendGranularity,
): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (granularity === 'month') {
    return `${year}-${String(month + 1).padStart(2, '0')}-01`;
  }

  if (granularity === 'week') {
    const weekStart = new Date(Date.UTC(year, month, day));
    const dayOfWeek = weekStart.getUTCDay();
    weekStart.setUTCDate(day - dayOfWeek);
    return toDateKey(weekStart);
  }

  return toDateKey(date);
}

export function generateDateBuckets(
  from: Date,
  to: Date,
  granularity: TrendGranularity,
): string[] {
  const buckets: string[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= to) {
    buckets.push(truncateDate(cursor, granularity));

    if (granularity === 'month') {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else if (granularity === 'week') {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return buckets;
}

export function postgresDateTrunc(granularity: TrendGranularity): string {
  switch (granularity) {
    case 'week':
      return 'week';
    case 'month':
      return 'month';
    default:
      return 'day';
  }
}

export function safePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return round((numerator / denominator) * 100);
}
