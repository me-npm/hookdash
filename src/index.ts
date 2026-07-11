import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { createServer } from './server.js';
import { DeliveryWorker } from './delivery/worker.js';
import { closeDatabase } from './db/connection.js';

const program = new Command();

program
  .name('hookdash')
  .description('Zero-config, self-hosted webhook gateway with a beautiful dashboard')
  .version('0.1.0');

program
  .command('start')
  .description('Start the hookdash server')
  .option('-p, --port <port>', 'Server port', parseInt)
  .option('-h, --host <host>', 'Server host')
  .option('-c, --config <path>', 'Path to config file')
  .option('-d, --db <path>', 'Database file path')
  .action(async (options) => {
    try {
      console.log('');
      console.log('  ∿  hookdash v0.1.0');
      console.log('  ─────────────────────');
      console.log('');

      // Load config
      const config = loadConfig({
        configPath: options.config,
        port: options.port,
        host: options.host,
        dbPath: options.db,
      });

      // Create and start server
      const app = await createServer(config);

      // Start delivery worker
      const worker = new DeliveryWorker(config);
      worker.start();

      // Graceful shutdown
      const shutdown = async (signal: string) => {
        console.log(`\n[hookdash] ${signal} received, shutting down...`);
        worker.stop();
        await app.close();
        closeDatabase();
        console.log('[hookdash] Goodbye! 👋');
        process.exit(0);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      // Start listening
      await app.listen({
        port: config.server.port,
        host: config.server.host,
      });

      console.log('');
      console.log(`  🪝 Webhook endpoint: http://${config.server.host === '0.0.0.0' ? 'localhost' : config.server.host}:${config.server.port}/webhook/:source`);
      console.log(`  📊 Dashboard:        http://${config.server.host === '0.0.0.0' ? 'localhost' : config.server.host}:${config.server.port}`);
      console.log(`  📡 API:              http://${config.server.host === '0.0.0.0' ? 'localhost' : config.server.host}:${config.server.port}/api/health`);
      console.log('');

      if (config.sources.length === 0) {
        console.log('  ℹ  No sources configured. Create a hookdash.config.yml to get started.');
        console.log('     See: https://github.com/hookdash/hookdash#configuration');
        console.log('');
      }
    } catch (err) {
      console.error('[hookdash] Failed to start:', (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create an example hookdash.config.yml in the current directory')
  .action(async () => {
    const { writeFileSync, existsSync } = await import('node:fs');
    const configPath = 'hookdash.config.yml';

    if (existsSync(configPath)) {
      console.log(`[hookdash] ${configPath} already exists. Skipping.`);
      return;
    }

    const exampleConfig = `# hookdash configuration
# Docs: https://github.com/hookdash/hookdash#configuration

server:
  port: 9090
  host: 0.0.0.0

database:
  path: ./hookdash.db

delivery:
  poll_interval: 1000        # ms between delivery polls
  default_timeout: 30000     # ms per delivery attempt
  default_max_retries: 8     # max retries before dead letter

sources:
  # Stripe webhooks
  # - name: stripe
  #   provider: stripe
  #   signing_secret: \${STRIPE_WEBHOOK_SECRET}
  #   endpoints:
  #     - url: http://localhost:3000/api/webhooks/stripe
  #       events: ["payment_intent.*", "charge.*"]

  # GitHub webhooks
  # - name: github
  #   provider: github
  #   signing_secret: \${GITHUB_WEBHOOK_SECRET}
  #   endpoints:
  #     - url: http://localhost:3000/api/webhooks/github

  # Generic webhooks (HMAC-SHA256)
  - name: my-service
    provider: generic
    signing_secret: my-secret-key
    endpoints:
      - url: http://localhost:3000/hooks
`;

    writeFileSync(configPath, exampleConfig);
    console.log(`[hookdash] Created ${configPath}`);
    console.log('[hookdash] Edit it and run: hookdash start');
  });

// Parse CLI args
program.parse();
