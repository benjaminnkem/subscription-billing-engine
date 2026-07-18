export type MonnifyWebhookEventType =
  | 'SUCCESSFUL_TRANSACTION'
  | 'SUCCESSFUL_REFUND'
  | 'FAILED_REFUND'
  | 'SETTLEMENT'
  | 'DISBURSEMENT'
  | 'FAILED_DISBURSEMENT'
  | 'REVERSED_DISBURSEMENT'
  | 'MANDATE_STATUS_CHANGE'
  | 'REJECTED_PAYMENT'
  | string;

export interface MonnifyWebhookCustomer {
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface MonnifyWebhookCardDetails {
  cardToken?: string;
  cardType?: string;
  last4?: string;
  expMonth?: string;
  expYear?: string;
  bin?: string;
  reusable?: boolean;
  supportsTokenization?: boolean;
  [key: string]: unknown;
}

export interface MonnifyWebhookProduct {
  reference?: string;
  type?: string;
}

export interface MonnifyWebhookEventData {
  product?: MonnifyWebhookProduct;
  transactionReference?: string;
  paymentReference?: string;
  paidOn?: string;
  paymentDescription?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  currency?: string;
  amountPaid?: string | number;
  totalPayable?: string | number;
  settlementAmount?: string | number;
  paymentSourceInformation?: unknown[];
  destinationAccountInformation?: Record<string, unknown>;
  customer?: MonnifyWebhookCustomer;
  cardDetails?: MonnifyWebhookCardDetails;
  metaData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MonnifyWebhookPayload {
  eventType: MonnifyWebhookEventType;
  eventData: MonnifyWebhookEventData;
}

export interface MonnifyWebhookHeaders {
  signature?: string;
  rawBody?: string;
}
