import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, ApiKeyEnvironment } from '../shared/enums';
import {
  generateApiKeyPrefix,
  generateRandomToken,
  hashValue,
} from '../shared/utils';
import { AuditService } from '../audit/audit.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKey } from './entities/api-key.entity';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey) private apiKeyRepo: Repository<ApiKey>,
    private auditService: AuditService,
  ) {}

  async create(
    merchantId: string,
    dto: CreateApiKeyDto,
    actor: string,
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const prefix = generateApiKeyPrefix(
      dto.environment === ApiKeyEnvironment.LIVE ? 'live' : 'test',
    );
    const secret = generateRandomToken(24);
    const rawKey = `${prefix}${secret}`;
    const lastFour = secret.slice(-4);

    const apiKey = this.apiKeyRepo.create({
      merchantId,
      prefix,
      keyHash: hashValue(rawKey),
      lastFour,
      environment: dto.environment,
      name: dto.name,
    });
    const saved = await this.apiKeyRepo.save(apiKey);

    await this.auditService.log({
      merchantId,
      actor,
      action: AuditAction.CREATE,
      resourceType: 'api_key',
      resourceId: saved.id,
    });

    return { apiKey: saved, rawKey };
  }

  async findAll(merchantId: string): Promise<ApiKey[]> {
    return this.apiKeyRepo.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(
    merchantId: string,
    keyId: string,
    actor: string,
  ): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepo.findOne({
      where: { id: keyId, merchantId },
    });
    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }
    apiKey.isActive = false;
    apiKey.revokedAt = new Date();
    const updated = await this.apiKeyRepo.save(apiKey);

    await this.auditService.log({
      merchantId,
      actor,
      action: AuditAction.DELETE,
      resourceType: 'api_key',
      resourceId: keyId,
    });

    return updated;
  }

  async rotate(
    merchantId: string,
    keyId: string,
    actor: string,
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    await this.revoke(merchantId, keyId, actor);
    const oldKey = await this.apiKeyRepo.findOne({
      where: { id: keyId, merchantId },
    });
    return this.create(
      merchantId,
      {
        environment: oldKey!.environment,
        name: oldKey?.name,
      },
      actor,
    );
  }

  async validateKey(rawKey: string): Promise<ApiKey | null> {
    const keyHash = hashValue(rawKey);
    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash, isActive: true },
    });
    if (apiKey) {
      apiKey.lastUsedAt = new Date();
      await this.apiKeyRepo.save(apiKey);
    }
    return apiKey;
  }
}
