export enum ChaosScenario {
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CARD_EXPIRED = 'CARD_EXPIRED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  WEBHOOK_FAILURE = 'WEBHOOK_FAILURE',
  SLOW_GATEWAY = 'SLOW_GATEWAY',
}

export type ChaosMode = 'persistent' | 'one-shot';

export interface ChaosRule {
  enabled: boolean;
  scenario?: ChaosScenario | null;
  scenarioQueue?: ChaosScenario[];
  mode: ChaosMode;
  accelerateDunning?: boolean;
  failWebhooks?: boolean;
  slowGatewayMs?: number;
  expiresAt?: string | null;
  activeScenarioId?: string | null;
}

export const DEFAULT_CHAOS_RULE: ChaosRule = {
  enabled: false,
  mode: 'one-shot',
};

export interface ChaosScenarioDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const CHAOS_SCENARIO_CATALOG: ChaosScenarioDefinition[] = [
  {
    id: 'insufficient-funds',
    name: 'Insufficient Funds',
    description:
      'First charge fails, dunning retry schedules, second charge succeeds.',
    icon: 'credit-card',
  },
  {
    id: 'expired-card',
    name: 'Expired Card',
    description:
      'Every charge fails until the subscription is suspended after retries.',
    icon: 'credit-card',
  },
  {
    id: 'webhook-failure',
    name: 'Webhook Failure',
    description:
      'Outbound merchant webhooks fail delivery and enter retry/dead-letter.',
    icon: 'webhook',
  },
  {
    id: 'slow-gateway',
    name: 'Slow Payment Gateway',
    description: 'Artificial 5s latency on the next Monnify charge.',
    icon: 'clock',
  },
  {
    id: 'duplicate-webhook',
    name: 'Duplicate Webhook',
    description:
      'Replay the same Monnify SUCCESSFUL_TRANSACTION webhook to prove idempotency.',
    icon: 'repeat',
  },
];

export interface RunScenarioResult {
  scenarioId: string;
  subscriptionId?: string;
  paymentId?: string;
  correlationId?: string | null;
  message: string;
}
