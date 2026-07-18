import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { extractRequestMetadata } from '../common/utils/request-metadata.util';
import { ServiceInfoService } from './service-info.service';

@Injectable()
export class ServiceInfoMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ServiceInfoMiddleware.name);

  constructor(private serviceInfoService: ServiceInfoService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const path = request.originalUrl ?? request.url;

    if (!path.startsWith('/webhooks')) {
      next();
      return;
    }

    const metadata = extractRequestMetadata(request);
    const category = path.includes('/monnify') ? 'monnify-webhook' : 'webhook';

    response.on('finish', () => {
      void this.serviceInfoService
        .logIncomingRequest({
          ...metadata,
          category,
          statusCode: response.statusCode,
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to persist incoming request log: ${message}`);
        });
    });

    next();
  }
}