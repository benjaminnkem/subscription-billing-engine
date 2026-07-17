import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy, OnApplicationShutdown {
  readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('redis.url');

    const commonOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    } as const;

    if (url) {
      this.client = new Redis(url, commonOptions);
      return;
    }

    const password = this.config.get<string>('redis.password');
    const tls = this.config.get<boolean>('redis.tls');

    this.client = new Redis({
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: password || undefined,
      ...(tls ? { tls: {} } : {}),
      ...commonOptions,
    });
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async onApplicationShutdown() {
    await this.disconnect();
  }

  private async disconnect() {
    if (this.client.status === 'end' || this.client.status === 'close') {
      return;
    }

    await this.client.quit();
  }
}
