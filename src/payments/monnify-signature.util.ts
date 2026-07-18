import * as crypto from 'crypto';

export function generateMonnifySignature(
  rawBody: string | object,
  secretKey: string,
): string {
  const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

  return crypto
    .createHash('sha512')
    .update(secretKey + body)
    .digest('hex');
}

export function verifyMonnifySignature(
  rawBody: string | object,
  secretKey: string,
  signature: string,
): boolean {
  if (!signature || !secretKey) {
    return false;
  }

  const expected = generateMonnifySignature(rawBody, secretKey).toLowerCase();
  const received = signature.toLowerCase();

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
