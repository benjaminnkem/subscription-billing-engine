import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookDeliveryStatus, WebhookEventType } from '../../shared/enums';

export class WebhookResponseDto {
  @ApiProperty({ description: 'Webhook UUID' })
  id: string;

  @ApiProperty({ description: 'Webhook URL' })
  url: string;

  @ApiProperty({ description: 'Webhook secret (only returned on creation)' })
  secret: string;

  @ApiProperty({ description: 'Events to listen for', type: [String] })
  events: string[];

  @ApiProperty({ description: 'Whether the webhook is active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Webhook description' })
  description?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}

export class WebhookListResponseDto {
  @ApiProperty({ type: [WebhookResponseDto] })
  data: WebhookResponseDto[];

  @ApiProperty({ description: 'Total number of webhooks' })
  total: number;
}

export class WebhookDeliveryResponseDto {
  @ApiProperty({ description: 'Delivery UUID' })
  id: string;

  @ApiProperty({ description: 'Webhook UUID' })
  webhookId: string;

  @ApiProperty({ enum: WebhookEventType, description: 'Event type' })
  eventType: WebhookEventType;

  @ApiProperty({ description: 'Event payload' })
  payload: Record<string, unknown>;

  @ApiProperty({ enum: WebhookDeliveryStatus, description: 'Delivery status' })
  status: WebhookDeliveryStatus;

  @ApiProperty({ description: 'Number of delivery attempts' })
  attemptCount: number;

  @ApiPropertyOptional({ description: 'Response status code' })
  responseStatusCode?: number;

  @ApiPropertyOptional({ description: 'Response body' })
  responseBody?: string;

  @ApiPropertyOptional({ description: 'Next retry timestamp' })
  nextRetryAt?: Date | null;

  @ApiPropertyOptional({ description: 'Delivered at timestamp' })
  deliveredAt?: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;
}

export class WebhookDeliveryListResponseDto {
  @ApiProperty({ type: [WebhookDeliveryResponseDto] })
  data: WebhookDeliveryResponseDto[];

  @ApiProperty({ description: 'Total number of deliveries' })
  total: number;
}
