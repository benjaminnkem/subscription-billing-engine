import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncomingRequestLog } from './entities/incoming-request-log.entity';
import { ServiceInfoController } from './service-info.controller';
import { ServiceInfoMiddleware } from './service-info.middleware';
import { ServiceInfoService } from './service-info.service';

@Module({
  imports: [TypeOrmModule.forFeature([IncomingRequestLog])],
  controllers: [ServiceInfoController],
  providers: [ServiceInfoService, ServiceInfoMiddleware],
  exports: [ServiceInfoService],
})
export class ServiceInfoModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ServiceInfoMiddleware)
      .forRoutes({ path: 'webhooks/*path', method: RequestMethod.ALL });
  }
}