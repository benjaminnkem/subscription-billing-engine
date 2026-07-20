import * as crypto from 'crypto';

/**
 * Monnify webhook signature verification.
 *
 * Sandbox (and current production behaviour observed in the field) signs with:
 *   HMAC-SHA512(secretKey, rawBody) → hex
 *
 * Older Monnify docs also describe:
 *   SHA-512(secretKey + rawBody) → hex
 *
 * We accept either so verification works across environments.
 */
export function generateMonnifySignature(
  rawBody: string | object,
  secretKey: string,
): string {
  const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

  // Prefer the HMAC form Monnify sandbox actually uses
  return crypto.createHmac('sha512', secretKey).update(body).digest('hex');
}

/** Legacy concatenate form documented as SHA-512(clientSecret + body). */
export function generateMonnifyLegacySignature(
  rawBody: string | object,
  secretKey: string,
): string {
  const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

  return crypto
    .createHash('sha512')
    .update(secretKey + body)
    .digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const expected = a.toLowerCase();
  const received = b.toLowerCase();
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function verifyMonnifySignature(
  rawBody: string | object,
  secretKey: string,
  signature: string,
): boolean {
  if (!signature || !secretKey) {
    return false;
  }

  const hmac = generateMonnifySignature(rawBody, secretKey);
  if (safeEqualHex(hmac, signature)) {
    return true;
  }

  const legacy = generateMonnifyLegacySignature(rawBody, secretKey);
  return safeEqualHex(legacy, signature);
}
