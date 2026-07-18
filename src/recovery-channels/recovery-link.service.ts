import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateRandomToken } from '../shared/utils';
import { RecoveryLink } from './entities/recovery-link.entity';
import { RecoveryAction } from './recovery-action.enum';

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface RecoveryLinkUrls {
  retryUrl: string;
  pauseUrl: string;
  cancelUrl: string;
}

export interface RedeemedRecoveryLink {
  merchantId: string;
  subscriptionId: string;
  action: RecoveryAction;
}

@Injectable()
export class RecoveryLinkService {
  constructor(
    @InjectRepository(RecoveryLink)
    private recoveryLinkRepo: Repository<RecoveryLink>,
    private config: ConfigService,
  ) {}

  async createLinks(target: {
    merchantId: string;
    subscriptionId: string;
  }): Promise<RecoveryLinkUrls> {
    const [retryUrl, pauseUrl, cancelUrl] = await Promise.all([
      this.createLink(target, RecoveryAction.RETRY),
      this.createLink(target, RecoveryAction.PAUSE),
      this.createLink(target, RecoveryAction.CANCEL),
    ]);

    return { retryUrl, pauseUrl, cancelUrl };
  }

  private async createLink(
    target: { merchantId: string; subscriptionId: string },
    action: RecoveryAction,
  ): Promise<string> {
    const link = this.recoveryLinkRepo.create({
      merchantId: target.merchantId,
      subscriptionId: target.subscriptionId,
      action,
      token: generateRandomToken(24),
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    });
    const saved = await this.recoveryLinkRepo.save(link);

    const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000';
    return `${appUrl}/recovery/email?token=${saved.token}`;
  }

  async redeem(token: string): Promise<RedeemedRecoveryLink> {
    const result = await this.recoveryLinkRepo
      .createQueryBuilder()
      .update(RecoveryLink)
      .set({ usedAt: new Date() })
      .where('token = :token', { token })
      .andWhere('usedAt IS NULL')
      .andWhere('expiresAt > :now', { now: new Date() })
      .returning(['id', 'merchantId', 'subscriptionId', 'action'])
      .execute();

    const rawRows = result.raw as Array<{
      id: string;
      merchantId: string;
      subscriptionId: string;
      action: RecoveryAction;
    }>;
    const row = rawRows[0] as (typeof rawRows)[0] | undefined;

    if (!row) {
      throw new BadRequestException(
        'This link has already been used or has expired.',
      );
    }

    return {
      merchantId: row.merchantId,
      subscriptionId: row.subscriptionId,
      action: row.action,
    };
  }
}
