import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiWrappedResponse } from '../common/dto/api-response.dto';
import { CurrentMerchant } from '../common/decorators/current-merchant.decorator';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsActivityQueryDto,
  AnalyticsTrendQueryDto,
} from './dto/analytics-query.dto';
import {
  ActivityListResponseDto,
  AnalyticsMetricsResponseDto,
  AnalyticsOverviewResponseDto,
  CustomerAnalyticsDto,
  DunningAnalyticsDto,
  PaymentAnalyticsDto,
  PlanAnalyticsDto,
  RevenueTrendPointDto,
  SubscriptionTrendPointDto,
  WebhookAnalyticsDto,
} from './dto/analytics-response.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get core subscription and revenue metrics' })
  @ApiWrappedResponse({
    status: 200,
    type: AnalyticsMetricsResponseDto,
    description: 'Core analytics metrics snapshot',
  })
  getMetrics(@CurrentMerchant() merchantId: string) {
    return this.analyticsService.getMetrics(merchantId);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get full analytics overview for merchant dashboard',
  })
  @ApiWrappedResponse({
    status: 200,
    type: AnalyticsOverviewResponseDto,
    description: 'Comprehensive analytics overview',
  })
  getOverview(@CurrentMerchant() merchantId: string) {
    return this.analyticsService.getOverview(merchantId);
  }

  @Get('revenue-trend')
  @ApiOperation({ summary: 'Get revenue trend over a date range' })
  @ApiWrappedResponse({
    status: 200,
    type: RevenueTrendPointDto,
    isArray: true,
    description: 'Revenue trend data points',
  })
  getRevenueTrend(
    @CurrentMerchant() merchantId: string,
    @Query() query: AnalyticsTrendQueryDto,
  ) {
    return this.analyticsService.getRevenueTrend(
      merchantId,
      query.from,
      query.to,
      query.granularity,
    );
  }

  @Get('subscriptions/trend')
  @ApiOperation({ summary: 'Get subscription growth trend over a date range' })
  @ApiWrappedResponse({
    status: 200,
    type: SubscriptionTrendPointDto,
    isArray: true,
    description: 'Subscription trend data points',
  })
  getSubscriptionTrend(
    @CurrentMerchant() merchantId: string,
    @Query() query: AnalyticsTrendQueryDto,
  ) {
    return this.analyticsService.getSubscriptionTrend(
      merchantId,
      query.from,
      query.to,
      query.granularity,
    );
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get revenue and subscriber breakdown by plan' })
  @ApiWrappedResponse({
    status: 200,
    type: PlanAnalyticsDto,
    isArray: true,
    description: 'Per-plan analytics breakdown',
  })
  getPlanBreakdown(@CurrentMerchant() merchantId: string) {
    return this.analyticsService.getPlanBreakdown(merchantId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get payment performance metrics' })
  @ApiWrappedResponse({
    status: 200,
    type: PaymentAnalyticsDto,
    description: 'Payment analytics',
  })
  getPaymentAnalytics(@CurrentMerchant() merchantId: string) {
    return this.analyticsService.getPaymentAnalytics(merchantId);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get customer analytics and top customers' })
  @ApiWrappedResponse({
    status: 200,
    type: CustomerAnalyticsDto,
    description: 'Customer analytics',
  })
  getCustomerAnalytics(@CurrentMerchant() merchantId: string) {
    return this.analyticsService.getCustomerAnalytics(merchantId);
  }

  @Get('dunning')
  @ApiOperation({ summary: 'Get dunning and payment recovery metrics' })
  @ApiWrappedResponse({
    status: 200,
    type: DunningAnalyticsDto,
    description: 'Dunning analytics',
  })
  getDunningAnalytics(@CurrentMerchant() merchantId: string) {
    return this.analyticsService.getDunningAnalytics(merchantId);
  }

  @Get('webhooks')
  @ApiOperation({ summary: 'Get webhook delivery health metrics' })
  @ApiWrappedResponse({
    status: 200,
    type: WebhookAnalyticsDto,
    description: 'Webhook delivery analytics',
  })
  getWebhookAnalytics(@CurrentMerchant() merchantId: string) {
    return this.analyticsService.getWebhookAnalytics(merchantId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get paginated merchant activity from event store' })
  @ApiWrappedResponse({
    status: 200,
    type: ActivityListResponseDto,
    description: 'Paginated activity events',
  })
  getActivity(
    @CurrentMerchant() merchantId: string,
    @Query() query: AnalyticsActivityQueryDto,
  ) {
    return this.analyticsService.getActivity(
      merchantId,
      query.page,
      query.limit,
    );
  }
}
