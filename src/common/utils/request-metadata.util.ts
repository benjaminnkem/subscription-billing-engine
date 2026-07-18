import type { Request } from 'express';

const REDACTED_HEADERS = new Set(['authorization', 'cookie']);

export interface RequestMetadata {
  method: string;
  path: string;
  ipAddress?: string;
  userAgent?: string;
  headers: Record<string, string>;
  signature?: string;
  /** Monnify does not send a dedicated timestamp header; kept for request logging. */
  monnifyTimestamp?: string;
  body?: Record<string, unknown>;
}

export function extractClientIp(request: Request): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) {
    return realIp;
  }

  return request.ip ?? request.socket?.remoteAddress ?? undefined;
}

export function sanitizeRequestHeaders(
  headers: Request['headers'],
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (REDACTED_HEADERS.has(key.toLowerCase())) {
      sanitized[key] = '[redacted]';
      continue;
    }

    if (value === undefined) {
      continue;
    }

    sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  return sanitized;
}

export function extractRequestMetadata(request: Request): RequestMetadata {
  const headers = sanitizeRequestHeaders(request.headers);
  const signature =
    headers['monnify-signature'] ?? headers['Monnify-Signature'];
  const monnifyTimestamp =
    headers['monnify-timestamp'] ?? headers['Monnify-Timestamp'];

  return {
    method: request.method,
    path: request.originalUrl ?? request.url,
    ipAddress: extractClientIp(request),
    userAgent: headers['user-agent'],
    headers,
    signature,
    monnifyTimestamp,
    body:
      request.body && typeof request.body === 'object'
        ? (request.body as Record<string, unknown>)
        : undefined,
  };
}

export function buildPublicBaseUrl(request: Request): string {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0]?.trim()
      : request.protocol;

  const forwardedHost = request.headers['x-forwarded-host'];
  const host =
    typeof forwardedHost === 'string'
      ? forwardedHost.split(',')[0]?.trim()
      : request.headers.host;

  return `${protocol}://${host}`;
}
