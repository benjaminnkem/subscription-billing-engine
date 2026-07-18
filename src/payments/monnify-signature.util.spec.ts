import {
  generateMonnifySignature,
  verifyMonnifySignature,
} from './monnify-signature.util';

describe('monnify-signature.util', () => {
  const secret = '91MUDL9N6U3BQRXBQ2PJ9M0PW4J22M1Y';
  const payload = {
    eventType: 'SUCCESSFUL_TRANSACTION',
    eventData: {
      paymentReference: 'ORDER_001',
      transactionReference: 'MNFY|01|0001',
      paymentStatus: 'PAID',
      amountPaid: '1000.00',
    },
  };

  it('generates a stable SHA-512 signature for a JSON body string', () => {
    const raw = JSON.stringify(payload);
    const signature = generateMonnifySignature(raw, secret);
    expect(signature).toHaveLength(128);
    expect(signature).toBe(generateMonnifySignature(raw, secret));
  });

  it('verifies a valid Monnify signature', () => {
    const raw = JSON.stringify(payload);
    const signature = generateMonnifySignature(raw, secret);
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
});
