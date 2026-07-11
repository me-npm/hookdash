import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';

export const endpointRoutes: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  // GET /api/endpoints
  fastify.get('/', async (request, reply) => {
    const endpoints = db.prepare(`
      SELECT e.*, s.name as source_name, s.provider as source_provider
      FROM endpoints e
      LEFT JOIN sources s ON e.source_id = s.id
      ORDER BY e.created_at DESC
    `).all();

    return endpoints.map((ep: any) => ({
      ...ep,
      event_filter: ep.event_filter ? JSON.parse(ep.event_filter) : null,
      headers: ep.headers ? JSON.parse(ep.headers) : null,
    }));
  });

  // POST /api/endpoints
  fastify.post('/', async (request, reply) => {
    const body = request.body as any;

    if (!body.url) {
      return reply.status(400).send({ error: 'url is required' });
    }

    const id = `ep_${nanoid(12)}`;
    const eventFilter = body.event_filter ? JSON.stringify(body.event_filter) : null;
    const customHeaders = body.headers ? JSON.stringify(body.headers) : null;

    db.prepare(`
      INSERT INTO endpoints (
        id, url, source_id, event_filter, headers, timeout_ms, max_retries, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.url,
      body.source_id || null,
      eventFilter,
      customHeaders,
      body.timeout_ms ?? 30000,
      body.max_retries ?? 8,
      body.active !== undefined ? (body.active ? 1 : 0) : 1
    );

    const created = db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as any;
    return {
      ...created,
      event_filter: created.event_filter ? JSON.parse(created.event_filter) : null,
      headers: created.headers ? JSON.parse(created.headers) : null,
    };
  });

  // PUT /api/endpoints/:id
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = db.prepare('SELECT id FROM endpoints WHERE id = ?').get(id);
    if (!existing) {
      return reply.status(404).send({ error: 'Endpoint not found' });
    }

    const eventFilter = body.event_filter ? JSON.stringify(body.event_filter) : null;
    const customHeaders = body.headers ? JSON.stringify(body.headers) : null;

    db.prepare(`
      UPDATE endpoints
      SET url = COALESCE(?, url),
          source_id = COALESCE(?, source_id),
          event_filter = ?,
          headers = ?,
          timeout_ms = COALESCE(?, timeout_ms),
          max_retries = COALESCE(?, max_retries),
          active = COALESCE(?, active)
      WHERE id = ?
    `).run(
      body.url,
      body.source_id,
      eventFilter,
      customHeaders,
      body.timeout_ms,
      body.max_retries,
      body.active !== undefined ? (body.active ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as any;
    return {
      ...updated,
      event_filter: updated.event_filter ? JSON.parse(updated.event_filter) : null,
      headers: updated.headers ? JSON.parse(updated.headers) : null,
    };
  });

  // DELETE /api/endpoints/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = db.prepare('DELETE FROM endpoints WHERE id = ?').run(id);

    if (result.changes === 0) {
      return reply.status(404).send({ error: 'Endpoint not found' });
    }

    return { success: true };
  });

  // POST /api/endpoints/:id/test
  fastify.post('/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string };

    const ep = db.prepare('SELECT url, headers, timeout_ms FROM endpoints WHERE id = ?').get(id) as any;
    if (!ep) {
      return reply.status(404).send({ error: 'Endpoint not found' });
    }

    const customHeaders = ep.headers ? JSON.parse(ep.headers) : {};
    const timeout = ep.timeout_ms || 30000;

    const testPayload = {
      event: 'hookdash.test',
      timestamp: new Date().toISOString(),
      test: true,
      message: 'This is a test webhook from hookdash dashboard',
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hookdash-test': 'true',
          ...customHeaders,
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      const responseText = await response.text();

      return {
        success: response.ok,
        status_code: response.status,
        response: responseText.substring(0, 1000),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === 'AbortError' ? `Timeout after ${timeout}ms` : err.message,
      };
    } finally {
      clearTimeout(timer);
    }
  });
};
