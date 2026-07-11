import { EventEmitter } from 'node:events';
import type { Database } from 'better-sqlite3';
import type { HookdashConfig, Delivery, Endpoint, WebhookEvent } from '../types/index.js';
import { getDatabase } from '../db/connection.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { getNextRetryDelay, shouldRetry } from './retry.js';

export const deliveryEvents = new EventEmitter();

export class DeliveryWorker {
  private db: Database;
  private intervalId: NodeJS.Timeout | null = null;
  private pollInterval: number;
  private defaultTimeout: number;
  private circuitBreaker: CircuitBreaker;
  private isProcessing = false;

  constructor(config: HookdashConfig) {
    this.db = getDatabase(config);
    this.pollInterval = config.delivery.poll_interval;
    this.defaultTimeout = config.delivery.default_timeout;
    this.circuitBreaker = new CircuitBreaker(this.db);
  }

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.processQueue();
      } catch (err) {
        console.error('[hookdash-worker] Error processing queue:', err);
      } finally {
        this.isProcessing = false;
      }
    }, this.pollInterval);

    console.log(`[hookdash-worker] Started queue worker (poll: ${this.pollInterval}ms)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[hookdash-worker] Stopped queue worker');
    }
  }

  private async processQueue(): Promise<void> {
    const now = new Date().toISOString();

    // Select pending and retrying deliveries that are due
    const dueDeliveries = this.db.prepare(`
      SELECT d.*, e.url as endpoint_url, e.headers as endpoint_headers, e.timeout_ms as endpoint_timeout,
             e.max_retries as endpoint_max_retries, ev.body as event_body, ev.headers as event_headers,
             ev.content_type as event_content_type
      FROM deliveries d
      JOIN endpoints e ON d.endpoint_id = e.id
      JOIN events ev ON d.event_id = ev.id
      WHERE (d.status = 'pending' OR (d.status = 'retrying' AND d.next_retry_at <= ?))
      LIMIT 10
    `).all(now) as any[];

    if (dueDeliveries.length === 0) return;

    for (const d of dueDeliveries) {
      // 1. Check Circuit Breaker
      if (!this.circuitBreaker.canDeliver(d.endpoint_id)) {
        // Skip for now, check next time
        continue;
      }

      await this.deliver(d);
    }
  }

  private async deliver(d: any): Promise<void> {
    const endpointHeaders = d.endpoint_headers ? JSON.parse(d.endpoint_headers) : {};
    const eventHeaders = d.event_headers ? JSON.parse(d.event_headers) : {};

    // Build headers to send
    const headers = {
      'content-type': d.event_content_type || 'application/json',
      ...eventHeaders,
      ...endpointHeaders,
      'x-hookdash-delivery-id': d.id,
      'x-hookdash-event-id': d.event_id,
      'x-hookdash-attempt': (d.attempts + 1).toString(),
    };

    // Remove hop-by-hop or signature verification headers that don't apply,
    // but keep custom signing headers if needed.
    delete headers['connection'];
    delete headers['host'];
    delete headers['content-length'];

    const timeout = d.endpoint_timeout || this.defaultTimeout;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const startTime = Date.now();
    let status: Delivery['status'] = 'failed';
    let statusCode: number | null = null;
    let responseBody = '';
    let errorMsg: string | null = null;

    try {
      const response = await fetch(d.endpoint_url, {
        method: 'POST',
        headers,
        body: d.event_body,
        signal: controller.signal,
      });

      statusCode = response.status;
      responseBody = await response.text();

      if (response.ok) {
        status = 'success';
        this.circuitBreaker.recordSuccess(d.endpoint_id);
      } else {
        status = 'failed';
        this.circuitBreaker.recordFailure(d.endpoint_id);
      }
    } catch (err: any) {
      this.circuitBreaker.recordFailure(d.endpoint_id);
      if (err.name === 'AbortError') {
        errorMsg = `Timeout after ${timeout}ms`;
      } else {
        errorMsg = err.message || 'Network error';
      }
    } finally {
      clearTimeout(id);
    }

    const attempts = d.attempts + 1;
    const completedAt = new Date().toISOString();
    let nextRetryAt: string | null = null;

    if (status === 'failed') {
      const maxRetries = d.endpoint_max_retries ?? 8;
      const shouldRetryRequest = shouldRetry(statusCode ?? -1);

      if (attempts < maxRetries && shouldRetryRequest) {
        status = 'retrying';
        const delay = getNextRetryDelay(attempts);
        nextRetryAt = new Date(Date.now() + delay).toISOString();
      } else {
        status = 'dead'; // Move to DLQ
      }
    }

    // Update database
    this.db.prepare(`
      UPDATE deliveries
      SET status = ?,
          attempts = ?,
          next_retry_at = ?,
          last_status_code = ?,
          last_response_body = ?,
          last_error = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      status,
      attempts,
      nextRetryAt,
      statusCode,
      responseBody.substring(0, 10000), // Cap payload response length
      errorMsg,
      completedAt,
      d.id
    );

    // Emit event for real-time dashboard updates
    deliveryEvents.emit('delivery:update', {
      id: d.id,
      event_id: d.event_id,
      endpoint_id: d.endpoint_id,
      endpoint_url: d.endpoint_url,
      status,
      attempts,
      next_retry_at: nextRetryAt,
      last_status_code: statusCode,
      last_error: errorMsg,
      completed_at: completedAt,
    });
  }
}
