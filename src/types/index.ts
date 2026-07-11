// ─── Event Status ───────────────────────────────────────────────
export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying' | 'dead';
export type CircuitState = 'closed' | 'open' | 'half-open';

// ─── Database Models ────────────────────────────────────────────
export interface Source {
  id: string;
  name: string;
  provider: string;
  signing_secret: string | null;
  active: number; // SQLite boolean
  created_at: string;
}

export interface Endpoint {
  id: string;
  url: string;
  source_id: string | null;
  event_filter: string | null;   // JSON array of glob patterns
  headers: string | null;         // JSON object of custom headers
  timeout_ms: number;
  max_retries: number;
  active: number;
  circuit_state: CircuitState;
  circuit_failure_count: number;
  circuit_last_failure_at: string | null;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  source_id: string;
  event_type: string | null;
  headers: string;    // JSON
  body: string;       // Raw body
  content_type: string | null;
  signature_valid: number | null;  // 1, 0, or null
  received_at: string;
}

export interface Delivery {
  id: string;
  event_id: string;
  endpoint_id: string;
  status: DeliveryStatus;
  attempts: number;
  next_retry_at: string | null;
  last_status_code: number | null;
  last_response_body: string | null;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
}

// ─── API Response Types ─────────────────────────────────────────
export interface EventWithSource extends WebhookEvent {
  source_name: string;
  source_provider: string;
  delivery_count: number;
  success_count: number;
  failed_count: number;
}

export interface DeliveryWithDetails extends Delivery {
  endpoint_url: string;
  event_type: string | null;
  source_name: string;
}

export interface Stats {
  total_events: number;
  events_today: number;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  dead_deliveries: number;
  pending_deliveries: number;
  success_rate: number;
  events_per_hour: { hour: string; count: number }[];
  top_sources: { name: string; count: number }[];
  top_event_types: { type: string; count: number }[];
}

// ─── Config Types ───────────────────────────────────────────────
export interface SourceConfig {
  name: string;
  provider: string;
  signing_secret?: string;
  endpoints: EndpointConfig[];
}

export interface EndpointConfig {
  url: string;
  events?: string[];
  headers?: Record<string, string>;
  timeout_ms?: number;
  max_retries?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface DatabaseConfig {
  path: string;
}

export interface DeliveryConfig {
  poll_interval: number;
  default_timeout: number;
  default_max_retries: number;
}

export interface HookdashConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  delivery: DeliveryConfig;
  sources: SourceConfig[];
}

// ─── Provider Interface ─────────────────────────────────────────
export interface WebhookProvider {
  name: string;
  verify(secret: string, headers: Record<string, string>, rawBody: Buffer): boolean;
  extractEventType(headers: Record<string, string>, body: unknown): string | null;
}

// ─── SSE Event ──────────────────────────────────────────────────
export interface SSEEvent {
  type: 'event:new' | 'delivery:update' | 'stats:update';
  data: unknown;
}

// ─── Pagination ─────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface PaginationQuery {
  page?: number;
  per_page?: number;
  source?: string;
  status?: string;
  event_type?: string;
  from?: string;
  to?: string;
  search?: string;
}
