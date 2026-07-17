import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        connection: redis as never,
        forceDisconnectOnShutdown: true,
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.DUNNING },
      { name: QUEUE_NAMES.WEBHOOKS },
      {
        name: QUEUE_NAMES.NOTIFICATIONS,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60_000,
          },
          removeOnComplete: true,
        },
      },
      { name: QUEUE_NAMES.EVENTS },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
