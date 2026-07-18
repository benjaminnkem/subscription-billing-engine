import {
  generateDateBuckets,
  normalizeToMonthly,
  parseAmount,
  resolveDateRange,
  round,
  safePercent,
  truncateDate,
} from './analytics.util';
import { PlanInterval } from '../shared/enums';

describe('analytics.util', () => {
  describe('normalizeToMonthly', () => {
    it('normalizes billing intervals to monthly amounts', () => {
      expect(normalizeToMonthly(1200, PlanInterval.YEARLY)).toBe(100);
      expect(normalizeToMonthly(300, PlanInterval.QUARTERLY)).toBe(100);
      expect(normalizeToMonthly(100, PlanInterval.MONTHLY)).toBe(100);
      expect(normalizeToMonthly(100, PlanInterval.CUSTOM, 15)).toBe(200);
    });
  });

  describe('parseAmount', () => {
    it('parses numeric strings safely', () => {
      expect(parseAmount('1250.50')).toBe(1250.5);
      expect(parseAmount(null)).toBe(0);
      expect(parseAmount('invalid')).toBe(0);
    });
  });

  describe('round', () => {
    it('rounds to two decimal places by default', () => {
      expect(round(12.3456)).toBe(12.35);
    });
  });

  describe('safePercent', () => {
    it('returns zero when denominator is zero', () => {
      expect(safePercent(5, 0)).toBe(0);
      expect(safePercent(25, 100)).toBe(25);
    });
  });

  describe('resolveDateRange', () => {
    it('swaps inverted ranges', () => {
      const range = resolveDateRange('2026-02-01', '2026-01-01');
      expect(range.from.toISOString().slice(0, 10)).toBe('2026-01-01');
      expect(range.to.toISOString().slice(0, 10)).toBe('2026-02-01');
    });
  });

  describe('truncateDate', () => {
    it('buckets dates by granularity', () => {
      const date = new Date('2026-01-15T12:00:00.000Z');
      expect(truncateDate(date, 'day')).toBe('2026-01-15');
      expect(truncateDate(date, 'month')).toBe('2026-01-01');
    });
  });

  describe('generateDateBuckets', () => {
    it('generates contiguous daily buckets', () => {
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-01-03T00:00:00.000Z');
      expect(generateDateBuckets(from, to, 'day')).toEqual([
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
      ]);
    });
  });
});
