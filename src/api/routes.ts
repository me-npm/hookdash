import type { FastifyPluginAsync } from 'fastify';
import { eventRoutes } from './events.js';
import { endpointRoutes } from './endpoints.js';
import { statsRoutes } from './stats.js';
import { sseRoutes } from './sse.js';

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Register sub-routes
  await fastify.register(eventRoutes, { prefix: '/events' });
  await fastify.register(endpointRoutes, { prefix: '/endpoints' });
  await fastify.register(statsRoutes, { prefix: '/stats' });
  await fastify.register(sseRoutes);

  // Health check route
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });
};
