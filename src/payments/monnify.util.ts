/** Monnify amounts are in major units (naira), not kobo. */

export function buildPaymentReference(
  paymentId: string,
  attemptNumber: number,
): string {
  return `sub_${paymentId}_attempt_${attemptNumber}`;
}

export function parsePaymentIdFromReference(
  reference: string | undefined,
): string | undefined {
  if (!reference) return undefined;

  const merchantTxMatch = reference.match(
    /^sub_([0-9a-f-]{36})_attempt_\d+$/i,
  );
  if (merchantTxMatch) {
    return merchantTxMatch[1];
  }

  const uuidMatch = reference.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  if (uuidMatch) {
    return reference;
  }

  return undefined;
}
