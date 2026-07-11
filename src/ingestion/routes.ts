import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { getDatabase } from '../db/connection.js';
import { getProvider } from '../providers/registry.js';
import { normalizeHeaders, parseBodyEventType, matchesEventFilter } from './parser.js';
import type { Source, Endpoint, SSEEvent } from '../types/index.js';

import { broadcastSSE } from '../api/sse.js';
// ─── Route Params / Types ───────────────────────────────────────
interface WebhookParams {
  source: string;
}

// ─── Fastify Plugin ─────────────────────────────────────────────
export default async function ingestionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Params: WebhookParams }>(
    '/webhook/:source',
    async (request: FastifyRequest<{ Params: WebhookParams }>, reply: FastifyReply) => {
      const { source: sourceName } = request.params;

      // ── 1. Get raw body ───────────────────────────────────────
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
      if (!rawBody) {
        return reply.status(400).send({
          error: 'Missing raw body. Ensure @fastify/raw-body is registered.',
        });
      }

      // ── 2. Look up source by name from DB ─────────────────────
      const db = getDatabase();
      const source = db
        .prepare('SELECT * FROM sources WHERE name = ? AND active = 1')
        .get(sourceName) as Source | undefined;

      if (!source) {
        return reply.status(404).send({
          error: `Unknown webhook source "${sourceName}".`,
        });
      }

      // ── 3. Normalize headers ──────────────────────────────────
      const headers = normalizeHeaders(
        request.headers as Record<string, string | string[] | undefined>,
      );

      // ── 4. Parse body and extract event type ──────────────────
      const { parsed: parsedBody } = parseBodyEventType(rawBody);

      // ── 5. Verify signature ───────────────────────────────────
      let signatureValid: boolean | null = null;

      if (source.signing_secret) {
        try {
          const provider = getProvider(source.provider);
          signatureValid = provider.verify(source.signing_secret, headers, rawBody);

          if (!signatureValid) {
            return reply.status(401).send({ error: 'Invalid webhook signature.' });
          }
        } catch (err) {
          fastify.log.error(err, `Provider verification error for source "${sourceName}"`);
          return reply.status(500).send({ error: 'Signature verification failed.' });
        }
      }

      // ── 6. Extract event type via provider ────────────────────
      let eventType: string | null = null;
      try {
        const provider = getProvider(source.provider);
        eventType = provider.extractEventType(headers, parsedBody ?? rawBody.toString('utf8'));
      } catch {
        // Non-fatal — event type is optional
      }

      // ── 7. Store event ────────────────────────────────────────
      const eventId = nanoid();
      const contentType = headers['content-type'] ?? null;

      db.prepare(
        `INSERT INTO events (id, source_id, event_type, headers, body, content_type, signature_valid)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        eventId,
        source.id,
        eventType,
        JSON.stringify(headers),
        rawBody.toString('utf8'),
        contentType,
        signatureValid === null ? null : signatureValid ? 1 : 0,
      );

      // ── 8. Find matching endpoints and create deliveries ──────
      const endpoints = db
        .prepare(
          'SELECT * FROM endpoints WHERE (source_id = ? OR source_id IS NULL) AND active = 1',
        )
        .all(source.id) as Endpoint[];

      const deliveryIds: string[] = [];

      const insertDelivery = db.prepare(
        `INSERT INTO deliveries (id, event_id, endpoint_id, status)
         VALUES (?, ?, ?, 'pending')`,
      );

      const createDeliveries = db.transaction(() => {
        for (const endpoint of endpoints) {
          // Check event filter
          let filterPatterns: string[] | null = null;
          if (endpoint.event_filter) {
            try {
              filterPatterns = JSON.parse(endpoint.event_filter) as string[];
            } catch {
              // Invalid filter JSON — skip filtering
            }
          }

          if (!matchesEventFilter(eventType, filterPatterns)) {
            continue;
          }

          const deliveryId = nanoid();
          insertDelivery.run(deliveryId, eventId, endpoint.id);
          deliveryIds.push(deliveryId);
        }
      });

      createDeliveries();

      // ── 9. Emit SSE event for real-time dashboard ─────────────
      broadcastSSE('event:new', {
        id: eventId,
        source_id: source.id,
        source_name: source.name,
        source_provider: source.provider,
        event_type: eventType,
        delivery_count: deliveryIds.length,
        received_at: new Date().toISOString(),
      });

      // ── 10. Return 202 Accepted ───────────────────────────────
      return reply.status(202).send({
        event_id: eventId,
        event_type: eventType,
        deliveries: deliveryIds.length,
      });
    },
  );
}
