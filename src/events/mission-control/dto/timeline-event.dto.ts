export type TimelineEventStatus = 'new' | 'processed';

export interface TimelineEventPresentation {
  title: string;
  icon: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  color: string;
  description: string;
  summary?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  merchantId: string;
  correlationId: string | null;
  category: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  processed: boolean;
  status: TimelineEventStatus;
  presentation: TimelineEventPresentation;
}

export interface TimelineEventsResponse {
  data: TimelineEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}
