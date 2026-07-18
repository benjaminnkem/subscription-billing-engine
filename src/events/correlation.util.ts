import { randomUUID } from 'crypto';

export function generateCorrelationId(): string {
  return `flow_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}
