import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import type { EventWithSource, PaginatedResponse, Delivery } from '../types/index.js';

export const eventRoutes: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  // GET /api/events
  fastify.get('/', async (request, reply) => {
    const query = request.query as any;
    const page = Math.max(1, parseInt(query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(query.per_page) || 20));
    const offset = (page - 1) * perPage;

    const conditions: string[] = [];
    const params: any[] = [];

    if (query.source) {
      conditions.push('s.name = ?');
      params.push(query.source);
    }

    if (query.event_type) {
      conditions.push('e.event_type = ?');
      params.push(query.event_type);
    }

    if (query.status) {
      conditions.push(`EXISTS (
        SELECT 1 FROM deliveries d
        WHERE d.event_id = e.id AND d.status = ?
      )`);
      params.push(query.status);
    }

    if (query.from) {
      conditions.push('e.received_at >= ?');
      params.push(query.from);
    }

    if (query.to) {
      conditions.push('e.received_at <= ?');
      params.push(query.to);
    }

    if (query.search) {
      conditions.push('(e.body LIKE ? OR e.event_type LIKE ? OR e.id LIKE ?)');
      const wild = `%${query.search}%`;
      params.push(wild, wild, wild);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const totalRow = db.prepare(`
      SELECT COUNT(DISTINCT e.id) as count
      FROM events e
      JOIN sources s ON e.source_id = s.id
      ${whereClause}
    `).get(...params) as { count: number };

    const total = totalRow?.count || 0;

    // Get paginated events with delivery statistics
    const eventsQuery = `
      SELECT e.id, e.event_type, e.received_at, e.signature_valid,
             s.name as source_name, s.provider as source_provider,
             COUNT(d.id) as delivery_count,
             SUM(CASE WHEN d.status = 'success' THEN 1 ELSE 0 END) as success_count,
             SUM(CASE WHEN d.status IN ('failed', 'retrying', 'dead') THEN 1 ELSE 0 END) as failed_count
      FROM events e
      JOIN sources s ON e.source_id = s.id
      LEFT JOIN deliveries d ON d.event_id = e.id
      ${whereClause}
      GROUP BY e.id
      ORDER BY e.received_at DESC
      LIMIT ? OFFSET ?
    `;

    const events = db.prepare(eventsQuery).all(...params, perPage, offset) as EventWithSource[];

    const response: PaginatedResponse<EventWithSource> = {
      data: events,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    };

    return response;
  });

  // GET /api/events/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const event = db.prepare(`
      SELECT e.*, s.name as source_name, s.provider as source_provider
      FROM events e
      JOIN sources s ON e.source_id = s.id
      WHERE e.id = ?
    `).get(id) as any;

    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const deliveries = db.prepare(`
      SELECT d.*, e.url as endpoint_url
      FROM deliveries d
      JOIN endpoints e ON d.endpoint_id = e.id
      WHERE d.event_id = ?
      ORDER BY d.created_at ASC
    `).all(id) as Delivery[];

    return {
      ...event,
      deliveries,
    };
  });

  // POST /api/events/:id/replay
  fastify.post('/:id/replay', async (request, reply) => {
    const { id } = request.params as { id: string };

    const event = db.prepare('SELECT id FROM events WHERE id = ?').get(id);
    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    // Get all endpoints configured for the source of this event
    const endpoints = db.prepare(`
      SELECT ep.id
      FROM endpoints ep
      JOIN events ev ON ev.source_id = ep.source_id
      WHERE ev.id = ? AND ep.active = 1
    `).all(id) as { id: string }[];

    const newDeliveryIds: string[] = [];

    const insertDelivery = db.prepare(`
      INSERT INTO deliveries (id, event_id, endpoint_id, status, attempts)
      VALUES (?, ?, ?, 'pending', 0)
    `);

    db.transaction(() => {
      for (const ep of endpoints) {
        const deliveryId = `del_${nanoid(12)}`;
        insertDelivery.run(deliveryId, id, ep.id);
        newDeliveryIds.push(deliveryId);
      }
    })();

    return {
      success: true,
      message: `Requeued ${newDeliveryIds.length} deliveries`,
      delivery_ids: newDeliveryIds,
    };
  });

  // DELETE /api/events/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = db.prepare('DELETE FROM events WHERE id = ?').run(id);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    return { success: true };
  });
};
