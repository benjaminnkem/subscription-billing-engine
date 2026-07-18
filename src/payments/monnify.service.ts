import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildPaymentReference } from './monnify.util';

export interface MonnifyChargeRequest {
  amountNaira: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  cardToken: string;
  paymentId: string;
  attemptNumber: number;
  paymentDescription?: string;
}

export interface MonnifyChargeResponse {
  success: boolean;
  transactionReference?: string;
  paymentReference: string;
  failureReason?: string;
  raw?: Record<string, unknown>;
}

export interface MonnifyCheckoutRequest {
  paymentReference: string;
  amountNaira: number;
  currency: string;
  redirectUrl: string;
  customerName: string;
  customerEmail: string;
  paymentDescription?: string;
}

export interface MonnifyCheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  transactionReference?: string;
  paymentReference?: string;
  failureReason?: string;
  raw?: Record<string, unknown>;
}

export interface MonnifyTransactionStatus {
  success: boolean;
  paymentStatus?: string;
  transactionReference?: string;
  paymentReference?: string;
  cardToken?: string;
  amountPaid?: number;
  raw?: Record<string, unknown>;
}

export interface MonnifyBank {
  name: string;
  code: string;
  ussdTemplate?: string | null;
  baseUssdCode?: string | null;
  transferUssdTemplate?: string | null;
}

export interface MonnifyAccountLookupResult {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

interface CachedAccessToken {
  accessToken: string;
  expiresAt: number;
}

interface MonnifyApiEnvelope {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: Record<string, unknown> | unknown[];
}

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

@Injectable()
export class MonnifyService {
  private readonly logger = new Logger(MonnifyService.name);
  private cachedToken: CachedAccessToken | null = null;

  constructor(private config: ConfigService) {}

  async charge(request: MonnifyChargeRequest): Promise<MonnifyChargeResponse> {
    const paymentReference = buildPaymentReference(
      request.paymentId,
      request.attemptNumber,
    );

    if (!this.isConfigured()) {
      this.logger.warn(
        { paymentReference },
        'Monnify credentials not configured — simulating tokenized charge',
      );
      return this.simulateCharge(paymentReference);
    }

    try {
      const response = await this.request<MonnifyApiEnvelope>(
        'POST',
        '/api/v1/merchant/cards/charge-card-token',
        {
          cardToken: request.cardToken,
          amount: request.amountNaira,
          customerName: request.customerName,
          customerEmail: request.customerEmail,
          paymentReference,
          paymentDescription:
            request.paymentDescription ??
            `Subscription payment ${paymentReference}`,
          currencyCode: request.currency,
          contractCode: this.config.get<string>('monnify.contractCode'),
          apiKey: this.config.get<string>('monnify.apiKey'),
        },
        paymentReference,
      );

      const body = this.asObjectBody(response.data?.responseBody);
      const transactionReference =
        (body.transactionReference as string | undefined) ??
        (body.transaction_reference as string | undefined);
      const success =
        response.ok &&
        response.data?.requestSuccessful === true &&
        this.isPaidStatus(body.paymentStatus as string | undefined);

      return {
        success,
        transactionReference,
        paymentReference,
        failureReason: success
          ? undefined
          : (response.data?.responseMessage ??
            (body.message as string | undefined) ??
            'Tokenized charge failed'),
        raw: response.data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      this.logger.error(
        { paymentReference, error },
        'Monnify tokenized charge failed',
      );
      return {
        success: false,
        failureReason: 'Payment gateway unavailable',
        paymentReference,
      };
    }
  }

  async createCheckout(
    request: MonnifyCheckoutRequest,
  ): Promise<MonnifyCheckoutResponse> {
    if (!this.isConfigured()) {
      this.logger.warn(
        { paymentReference: request.paymentReference },
        'Monnify credentials not configured — simulating checkout',
      );
      return {
        success: true,
        checkoutUrl: `https://sandbox.sdk.monnify.com/checkout/${request.paymentReference}`,
        transactionReference: `MNFY_SIM_${Date.now()}`,
        paymentReference: request.paymentReference,
        raw: { simulated: true },
      };
    }

    try {
      const response = await this.request<MonnifyApiEnvelope>(
        'POST',
        '/api/v1/merchant/transactions/init-transaction',
        {
          amount: request.amountNaira,
          customerName: request.customerName,
          customerEmail: request.customerEmail,
          paymentReference: request.paymentReference,
          paymentDescription:
            request.paymentDescription ??
            `Invoice payment ${request.paymentReference}`,
          currencyCode: request.currency,
          contractCode: this.config.get<string>('monnify.contractCode'),
          redirectUrl: request.redirectUrl,
          paymentMethods: ['CARD', 'ACCOUNT_TRANSFER'],
        },
        request.paymentReference,
      );

      const body = this.asObjectBody(response.data?.responseBody);
      const checkoutUrl = body.checkoutUrl as string | undefined;
      const transactionReference = body.transactionReference as
        string | undefined;
      const paymentReference =
        (body.paymentReference as string | undefined) ??
        request.paymentReference;
      const success =
        response.ok &&
        response.data?.requestSuccessful === true &&
        Boolean(checkoutUrl);

      return {
        success,
        checkoutUrl,
        transactionReference,
        paymentReference,
        failureReason: success
          ? undefined
          : (response.data?.responseMessage ??
            'Checkout session creation failed'),
        raw: response.data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      this.logger.error(
        { paymentReference: request.paymentReference, error },
        'Monnify checkout creation failed',
      );
      return {
        success: false,
        failureReason: 'Payment gateway unavailable',
      };
    }
  }

  async fetchBanks(): Promise<MonnifyBank[]> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Monnify credentials not configured — returning empty bank list',
      );
      return [];
    }

    try {
      const response = await this.request<MonnifyApiEnvelope>(
        'GET',
        '/api/v1/sdk/transactions/banks',
        undefined,
        'banks',
      );

      const body = response.data?.responseBody;
      if (
        !response.ok ||
        !response.data?.requestSuccessful ||
        !Array.isArray(body)
      ) {
        this.logger.warn(
          { message: response.data?.responseMessage },
          'Monnify bank list request failed',
        );
        return [];
      }

      return body.map((bank) => {
        const item = bank as Record<string, unknown>;
        return {
          name: String(item.name ?? item.bankName ?? ''),
          code: String(item.code ?? item.bankCode ?? ''),
          ussdTemplate:
            (item.ussdTemplate as string | null | undefined) ?? null,
          baseUssdCode:
            (item.baseUssdCode as string | null | undefined) ?? null,
          transferUssdTemplate:
            (item.transferUssdTemplate as string | null | undefined) ?? null,
        };
      });
    } catch (error) {
      this.logger.error({ error }, 'Monnify fetchBanks failed');
      return [];
    }
  }

  async lookupAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<MonnifyAccountLookupResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Monnify credentials not configured — simulating account lookup',
      );
      return {
        accountNumber,
        accountName: 'SIMULATED ACCOUNT NAME',
        bankCode,
      };
    }

    const params = new URLSearchParams({
      accountNumber,
      bankCode,
    });

    const response = await this.request<MonnifyApiEnvelope>(
      'GET',
      `/api/v1/disbursements/account/validate?${params.toString()}`,
      undefined,
      accountNumber,
    );

    const body = this.asObjectBody(response.data?.responseBody);
    if (!response.ok || !response.data?.requestSuccessful) {
      throw new Error(
        response.data?.responseMessage ?? 'Account lookup failed',
      );
    }

    return {
      accountNumber: String(body.accountNumber ?? accountNumber),
      accountName: String(body.accountName ?? ''),
      bankCode: String(body.bankCode ?? bankCode),
    };
  }

  async getTransactionStatus(options: {
    paymentReference?: string;
    transactionReference?: string;
  }): Promise<MonnifyTransactionStatus> {
    if (!this.isConfigured()) {
      return { success: false };
    }

    const params = new URLSearchParams();
    if (options.paymentReference) {
      params.set('paymentReference', options.paymentReference);
    }
    if (options.transactionReference) {
      params.set('transactionReference', options.transactionReference);
    }

    try {
      const response = await this.request<MonnifyApiEnvelope>(
        'GET',
        `/api/v2/merchant/transactions/query?${params.toString()}`,
        undefined,
        options.paymentReference ?? options.transactionReference ?? 'status',
      );

      const body = this.asObjectBody(response.data?.responseBody);
      const cardDetails = (body.cardDetails ?? {}) as Record<string, unknown>;
      const success = response.ok && response.data?.requestSuccessful === true;

      return {
        success,
        paymentStatus: body.paymentStatus as string | undefined,
        transactionReference: body.transactionReference as string | undefined,
        paymentReference: body.paymentReference as string | undefined,
        cardToken: cardDetails.cardToken as string | undefined,
        amountPaid: body.amountPaid
          ? parseFloat(String(body.amountPaid))
          : undefined,
        raw: response.data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      this.logger.error({ options, error }, 'Monnify transaction query failed');
      return { success: false };
    }
  }

  private isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('monnify.apiKey') &&
      this.config.get<string>('monnify.secretKey'),
      // &&
      // this.config.get<string>('monnify.contractCode'),
    );
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.cachedToken &&
      Date.now() < this.cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS
    ) {
      return this.cachedToken.accessToken;
    }

    const apiUrl = this.config.get<string>('monnify.apiUrl');
    const apiKey = this.config.get<string>('monnify.apiKey');
    const secretKey = this.config.get<string>('monnify.secretKey');
    const basic = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

    const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
    });

    const body = (await response.json()) as MonnifyApiEnvelope;
    const tokenBody = this.asObjectBody(body.responseBody);
    const accessToken = tokenBody.accessToken as string | undefined;
    const expiresIn = (tokenBody.expiresIn as number | undefined) ?? 3600;

    if (!response.ok || !body.requestSuccessful || !accessToken) {
      throw new Error(
        body.responseMessage ?? 'Failed to issue Monnify access token',
      );
    }

    this.cachedToken = {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return accessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body: Record<string, unknown> | undefined,
    logRef: string,
  ): Promise<{ ok: boolean; data: T }> {
    const apiUrl = this.config.get<string>('monnify.apiUrl');
    const accessToken = await this.getAccessToken();

    this.logger.log({
      msg: 'Monnify API request',
      method,
      path,
      logRef,
    });

    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as T;

    this.logger.log({
      msg: 'Monnify API response',
      method,
      path,
      logRef,
      status: response.status,
      ok: response.ok,
    });

    return { ok: response.ok, data };
  }

  private simulateCharge(paymentReference: string): MonnifyChargeResponse {
    const simulatedSuccess = Math.random() > 0.15;
    return {
      success: simulatedSuccess,
      transactionReference: simulatedSuccess
        ? `MNFY_SIM_${Date.now()}`
        : undefined,
      failureReason: simulatedSuccess ? undefined : 'Insufficient funds',
      paymentReference,
      raw: { simulated: true },
    };
  }

  private isPaidStatus(status: string | undefined): boolean {
    if (!status) {
      // Some charge-token responses omit paymentStatus and rely on requestSuccessful
      return true;
    }
    const normalized = status.toUpperCase();
    return (
      normalized === 'PAID' ||
      normalized === 'SUCCESS' ||
      normalized === 'SUCCESSFUL'
    );
  }

  private asObjectBody(
    body: MonnifyApiEnvelope['responseBody'],
  ): Record<string, unknown> {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body;
    }
    return {};
  }
}
