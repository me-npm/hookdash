import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyRawBody from 'fastify-raw-body';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HookdashConfig } from './types/index.js';
import { getDatabase, seedFromConfig } from './db/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createServer(config: HookdashConfig) {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB max webhook payload
  });

  // ─── Plugins ──────────────────────────────────────────
  await app.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  await app.register(fastifyRawBody, {
    field: 'rawBody',
    global: true,
    encoding: false, // Return Buffer
    runFirst: true,
  });

  // ─── Database ─────────────────────────────────────────
  const db = getDatabase(config);
  seedFromConfig(config);

  // Make config and db accessible via decorators
  app.decorate('hookdashConfig', config);
  app.decorate('db', db);

  // ─── API Routes ───────────────────────────────────────
  // These are registered as Fastify plugins
  const ingestionRoutes = (await import('./ingestion/routes.js')).default;
  await app.register(ingestionRoutes);

  const { apiRoutes } = await import('./api/routes.js');
  await app.register(apiRoutes, { prefix: '/api' });

  // ─── Dashboard Static Files ───────────────────────────
  // Try multiple possible dashboard locations
  const dashboardPaths = [
    resolve(__dirname, '../dashboard/dist'),       // Dev: source tree
    resolve(__dirname, '../../dashboard/dist'),     // Built: dist/
    resolve(dirname(__dirname), 'dashboard/dist'),  // npm package
  ];

  let dashboardPath: string | null = null;
  for (const p of dashboardPaths) {
    if (existsSync(p)) {
      dashboardPath = p;
      break;
    }
  }

  if (dashboardPath) {
    await app.register(fastifyStatic, {
      root: dashboardPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: serve index.html for all non-API, non-webhook routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/webhook/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });

    console.log(`[hookdash] Dashboard serving from ${dashboardPath}`);
  } else {
    console.log('[hookdash] Dashboard not found (run `npm run build:dashboard` to enable)');

    // Basic fallback page
    app.get('/', async (_request, reply) => {
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <head><title>hookdash</title></head>
          <body style="font-family:system-ui;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div style="text-align:center">
              <h1>∿ hookdash</h1>
              <p style="color:#888">Dashboard not built. Run <code style="background:#1e1e2e;padding:2px 8px;border-radius:4px">npm run build:dashboard</code></p>
              <p style="color:#888;margin-top:20px">API available at <a href="/api/health" style="color:#3b82f6">/api/health</a></p>
            </div>
          </body>
        </html>
      `);
    });
  }

  return app;
}

// ─── Fastify Type Augmentation ──────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    hookdashConfig: HookdashConfig;
    db: import('better-sqlite3').Database;
  }

  interface FastifyRequest {
    rawBody?: Buffer;
  }
}
