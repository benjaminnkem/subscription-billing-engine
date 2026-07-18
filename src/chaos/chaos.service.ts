import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import {
  MonnifyChargeResponse,
  MonnifyCheckoutResponse,
} from '../payments/monnify.service';
import { ChaosRule, ChaosScenario, DEFAULT_CHAOS_RULE } from './chaos.types';
import { UpdateChaosRuleDto } from './dto/chaos.dto';

const REDIS_KEY_PREFIX = 'chaos:merchant:';
const ACCELERATED_DUNNING_MS = 5_000;

@Injectable()
export class ChaosService {
  private readonly logger = new Logger(ChaosService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('nodeEnv') !== 'production';
  }

  assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ForbiddenException('Chaos mode is disabled in production');
    }
  }

  async getRules(merchantId: string): Promise<ChaosRule> {
    const raw = await this.redis.client.get(this.redisKey(merchantId));
    if (!raw) return { ...DEFAULT_CHAOS_RULE };
    return { ...DEFAULT_CHAOS_RULE, ...JSON.parse(raw) };
  }

  async setRules(
    merchantId: string,
    patch: Partial<ChaosRule>,
  ): Promise<ChaosRule> {
    this.assertEnabled();
    const current = await this.getRules(merchantId);
    const next: ChaosRule = {
      ...current,
      ...patch,
      enabled: patch.enabled ?? true,
    };
    await this.redis.client.set(
      this.redisKey(merchantId),
      JSON.stringify(next),
    );
    this.logger.warn({ merchantId, rule: next }, 'Chaos rules updated');
    return next;
  }

  async updateRules(
    merchantId: string,
    dto: UpdateChaosRuleDto,
  ): Promise<ChaosRule> {
    this.assertEnabled();
    const current = await this.getRules(merchantId);
    const next: ChaosRule = { ...current, ...dto };
    await this.redis.client.set(
      this.redisKey(merchantId),
      JSON.stringify(next),
    );
    return next;
  }

  async disable(merchantId: string): Promise<ChaosRule> {
    this.assertEnabled();
    const next: ChaosRule = { ...DEFAULT_CHAOS_RULE };
    await this.redis.client.set(
      this.redisKey(merchantId),
      JSON.stringify(next),
    );
    return next;
  }

  async getEventMetadata(merchantId: string): Promise<Record<string, unknown>> {
    const rules = await this.getRules(merchantId);
    if (!rules.enabled) return {};

    return {
      chaos: true,
      chaosScenario: rules.activeScenarioId ?? rules.scenario ?? null,
      chaosMode: rules.mode,
    };
  }

  async resolveDunningDelay(
    merchantId: string,
    defaultDelay: number,
  ): Promise<number> {
    const rules = await this.getRules(merchantId);
    if (rules.enabled && rules.accelerateDunning) {
      return ACCELERATED_DUNNING_MS;
    }
    return defaultDelay;
  }

  async shouldFailWebhook(merchantId: string): Promise<boolean> {
    const rules = await this.getRules(merchantId);
    return rules.enabled && Boolean(rules.failWebhooks);
  }

  async interceptCharge(
    merchantId: string,
    paymentReference: string,
  ): Promise<MonnifyChargeResponse | null> {
    if (!this.isEnabled()) return null;

    const rules = await this.getRules(merchantId);
    if (!rules.enabled) return null;

    if (rules.slowGatewayMs && rules.slowGatewayMs > 0) {
      await this.sleep(rules.slowGatewayMs);
    }

    const scenario = await this.consumeScenario(merchantId, rules);
    if (!scenario) return null;

    return this.buildChargeOutcome(scenario, paymentReference);
  }

  async interceptCheckout(
    merchantId: string,
    paymentReference: string,
  ): Promise<MonnifyCheckoutResponse | null> {
    if (!this.isEnabled()) return null;

    const rules = await this.getRules(merchantId);
    if (!rules.enabled) return null;

    const scenario = await this.consumeScenario(merchantId, rules);
    if (!scenario) return null;

    if (scenario === ChaosScenario.NETWORK_TIMEOUT) {
      return {
        success: false,
        failureReason: 'Payment gateway timeout (chaos)',
      };
    }

    if (
      scenario === ChaosScenario.INSUFFICIENT_FUNDS ||
      scenario === ChaosScenario.CARD_EXPIRED
    ) {
      return {
        success: false,
        failureReason:
          scenario === ChaosScenario.CARD_EXPIRED
            ? 'Card expired (chaos)'
            : 'Insufficient funds (chaos)',
      };
    }

    return {
      success: true,
      checkoutUrl: `https://sandbox.sdk.monnify.com/checkout/${paymentReference}`,
      paymentReference,
      transactionReference: `MNFY_CHAOS_${Date.now()}`,
      raw: { simulated: true, chaos: true, scenario },
    };
  }

  private async consumeScenario(
    merchantId: string,
    rules: ChaosRule,
  ): Promise<ChaosScenario | null> {
    let scenario: ChaosScenario | null = null;
    let nextRules = { ...rules };

    if (rules.scenarioQueue && rules.scenarioQueue.length > 0) {
      const [head, ...rest] = rules.scenarioQueue;
      scenario = head;

      if (rest.length === 0 && rules.mode === 'one-shot') {
        await this.redis.client.set(
          this.redisKey(merchantId),
          JSON.stringify({ ...DEFAULT_CHAOS_RULE }),
        );
      } else {
        nextRules.scenarioQueue = rest;
        await this.redis.client.set(
          this.redisKey(merchantId),
          JSON.stringify(nextRules),
        );
      }
      return scenario;
    }

    if (rules.scenario) {
      scenario = rules.scenario;
      if (rules.mode === 'one-shot') {
        await this.redis.client.set(
          this.redisKey(merchantId),
          JSON.stringify({ ...DEFAULT_CHAOS_RULE }),
        );
      }
      return scenario;
    }

    return null;
  }

  private buildChargeOutcome(
    scenario: ChaosScenario,
    paymentReference: string,
  ): MonnifyChargeResponse {
    switch (scenario) {
      case ChaosScenario.PAYMENT_SUCCESS:
        return {
          success: true,
          transactionReference: `MNFY_CHAOS_${Date.now()}`,
          paymentReference,
          raw: { simulated: true, chaos: true, scenario },
        };
      case ChaosScenario.INSUFFICIENT_FUNDS:
        return {
          success: false,
          failureReason: 'Insufficient funds (chaos)',
          paymentReference,
          raw: { simulated: true, chaos: true, scenario },
        };
      case ChaosScenario.CARD_EXPIRED:
        return {
          success: false,
          failureReason: 'Card expired (chaos)',
          paymentReference,
          raw: { simulated: true, chaos: true, scenario },
        };
      case ChaosScenario.NETWORK_TIMEOUT:
        return {
          success: false,
          failureReason: 'Payment gateway timeout (chaos)',
          paymentReference,
          raw: { simulated: true, chaos: true, scenario },
        };
      case ChaosScenario.SLOW_GATEWAY:
        return {
          success: true,
          transactionReference: `MNFY_CHAOS_${Date.now()}`,
          paymentReference,
          raw: { simulated: true, chaos: true, scenario },
        };
      default:
        return {
          success: false,
          failureReason: `Chaos scenario: ${scenario}`,
          paymentReference,
          raw: { simulated: true, chaos: true, scenario },
        };
    }
  }

  private redisKey(merchantId: string): string {
    return `${REDIS_KEY_PREFIX}${merchantId}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
