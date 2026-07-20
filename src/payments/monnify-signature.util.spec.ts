import * as crypto from 'crypto';
import {
  generateMonnifyLegacySignature,
  generateMonnifySignature,
  verifyMonnifySignature,
} from './monnify-signature.util';

describe('monnify-signature.util', () => {
  const secret = 'test-monnify-client-secret';
  const payload = {
    eventType: 'SUCCESSFUL_TRANSACTION',
    eventData: {
      paymentReference: 'ORDER_001',
      transactionReference: 'MNFY|01|0001',
      paymentStatus: 'PAID',
      amountPaid: 1000,
    },
  };

  it('generates a stable HMAC-SHA512 signature for a JSON body string', () => {
    const raw = JSON.stringify(payload);
    const signature = generateMonnifySignature(raw, secret);
    expect(signature).toHaveLength(128);
    expect(signature).toBe(generateMonnifySignature(raw, secret));
  });

  it('verifies a valid Monnify HMAC signature', () => {
    const raw = JSON.stringify(payload);
    const signature = generateMonnifySignature(raw, secret);
    expect(verifyMonnifySignature(raw, secret, signature)).toBe(true);
  });

  it('verifies the legacy SHA-512(secret + body) form', () => {
    const raw = JSON.stringify(payload);
    const signature = generateMonnifyLegacySignature(raw, secret);
    expect(verifyMonnifySignature(raw, secret, signature)).toBe(true);
  });

  it('rejects an invalid Monnify signature', () => {
    const raw = JSON.stringify(payload);
    expect(verifyMonnifySignature(raw, secret, 'invalid')).toBe(false);
  });

  it('verifies against a parsed object via JSON.stringify', () => {
    const signature = generateMonnifySignature(payload, secret);
    expect(verifyMonnifySignature(payload, secret, signature)).toBe(true);
  });

  it('uses HMAC-SHA512 (not concat SHA-512) as the primary algorithm', () => {
    // Confirmed against a live Monnify sandbox delivery: monnify-signature is
    // HMAC-SHA512(secretKey, rawBody), not SHA512(secretKey + rawBody).
    const raw = JSON.stringify(payload);
    const hmac = crypto
      .createHmac('sha512', secret)
      .update(raw)
      .digest('hex');
    const legacy = crypto
      .createHash('sha512')
      .update(secret + raw)
      .digest('hex');

    expect(generateMonnifySignature(raw, secret)).toBe(hmac);
    expect(generateMonnifyLegacySignature(raw, secret)).toBe(legacy);
    expect(hmac).not.toBe(legacy);
    expect(verifyMonnifySignature(raw, secret, hmac)).toBe(true);
    expect(verifyMonnifySignature(raw, secret, legacy)).toBe(true);
  });
});
