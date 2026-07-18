import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import {
  buildPublicBaseUrl,
  extractRequestMetadata,
  type RequestMetadata,
} from '../common/utils/request-metadata.util';
import { IncomingRequestLog } from './entities/incoming-request-log.entity';

const MAX_STORED_LOGS = 500;

export interface LogIncomingRequestInput extends RequestMetadata {
  category: string;
  statusCode?: number;
}

export interface ServiceInfoSnapshot {
  serviceName: string;
  environment: string;
  serverTime: string;
  nodeVersion: string;
  monnifyWebhookUrl: string;
  webhookSecretConfigured: boolean;
  monnifyApiUrl: string;
}

@Injectable()
export class ServiceInfoService {
  private readonly logger = new Logger(ServiceInfoService.name);

  constructor(
    @InjectRepository(IncomingRequestLog)
    private requestLogRepo: Repository<IncomingRequestLog>,
    private config: ConfigService,
  ) {}

  async logIncomingRequest(
    input: LogIncomingRequestInput,
  ): Promise<IncomingRequestLog> {
    const log = await this.requestLogRepo.save(
      this.requestLogRepo.create({
        category: input.category,
        method: input.method,
        path: input.path,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        headers: input.headers,
        signature: input.signature,
        body: input.body,
        statusCode: input.statusCode,
      }),
    );

    void this.pruneOldLogs().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to prune incoming request logs: ${message}`);
    });

    this.logger.log(
      [
        `[INCOMING] ${input.method} ${input.path}`,
        `ip=${input.ipAddress ?? 'unknown'}`,
        `agent=${input.userAgent ?? 'unknown'}`,
        `signature=${input.signature ?? 'none'}`,
        `status=${input.statusCode ?? 'pending'}`,
      ].join(' | '),
    );

    return log;
  }

  async findRequestLogs(
    page = 1,
    limit = 20,
    category?: string,
  ): Promise<{ data: IncomingRequestLog[]; total: number }> {
    const [data, total] = await this.requestLogRepo.findAndCount({
      where: category ? { category } : undefined,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  getServiceInfo(request: Request): ServiceInfoSnapshot {
    const baseUrl = buildPublicBaseUrl(request);

    return {
      serviceName:
        this.config.get<string>('appName') ?? 'Monnify Subscription Engine',
      environment: this.config.get<string>('nodeEnv') ?? 'development',
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      monnifyWebhookUrl: `${baseUrl}/webhooks/monnify`,
      webhookSecretConfigured: Boolean(
        this.config.get<string>('monnify.webhookSecret'),
      ),
      monnifyApiUrl: this.config.get<string>('monnify.apiUrl') ?? '',
    };
  }

  captureRequest(
    request: Request,
    category: string,
    statusCode?: number,
  ): Promise<IncomingRequestLog> {
    const metadata = extractRequestMetadata(request);

    return this.logIncomingRequest({
      ...metadata,
      category,
      statusCode,
    });
  }

  private async pruneOldLogs(): Promise<void> {
    const total = await this.requestLogRepo.count();
    if (total <= MAX_STORED_LOGS) {
      return;
    }

    const excess = total - MAX_STORED_LOGS;
    const oldest = await this.requestLogRepo.find({
      order: { createdAt: 'ASC' },
      take: excess,
      select: { id: true },
    });

    if (oldest.length === 0) {
      return;
    }

    await this.requestLogRepo.delete(oldest.map((log) => log.id));
  }
}
