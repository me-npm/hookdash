import type { FastifyPluginAsync } from 'fastify';
import { deliveryEvents } from '../delivery/worker.js';

// Global registry of active SSE connections
const activeClients = new Set<(event: string, data: any) => void>();

/**
 * Broadcast an event to all active dashboard SSE connections.
 */
export function broadcastSSE(event: string, data: any): void {
  for (const send of activeClients) {
    send(event, data);
  }
}

export const sseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stream', async (request, reply) => {
    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const send = (event: string, data: any) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    activeClients.add(send);

    // Heartbeat every 15 seconds to keep connection alive
    const heartbeatId = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 15000);

    // Initial message
    send('connected', { timestamp: new Date().toISOString() });

    // Listen to delivery worker events
    const onDeliveryUpdate = (data: any) => {
      send('delivery:update', data);
    };

    deliveryEvents.on('delivery:update', onDeliveryUpdate);

    // Cleanup on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeatId);
      activeClients.delete(send);
      deliveryEvents.off('delivery:update', onDeliveryUpdate);
    });

    // Tell Fastify not to send standard response
    reply.sent = true;
  });
};
