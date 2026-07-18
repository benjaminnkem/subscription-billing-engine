import {
  buildPaymentReference,
  parsePaymentIdFromReference,
} from './monnify.util';

describe('monnify.util', () => {
  describe('buildPaymentReference', () => {
    it('builds a unique ref per attempt', () => {
      expect(buildPaymentReference('pay_123', 1)).toBe(
        'sub_pay_123_attempt_1',
      );
      expect(buildPaymentReference('pay_123', 2)).toBe(
        'sub_pay_123_attempt_2',
      );
    });
  });

  describe('parsePaymentIdFromReference', () => {
    it('extracts payment id from attempt reference', () => {
      const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(parsePaymentIdFromReference(`sub_${id}_attempt_2`)).toBe(id);
    });

    it('returns bare uuid', () => {
      const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(parsePaymentIdFromReference(id)).toBe(id);
    });

    it('returns undefined for unknown formats', () => {
      expect(parsePaymentIdFromReference('MNFY|04|20211117112842|000170')).toBe(
        undefined,
      );
    });
  });
});
