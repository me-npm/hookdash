import { z } from 'zod';

const endpointConfigSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  timeout_ms: z.number().int().positive().optional(),
  max_retries: z.number().int().min(0).max(50).optional(),
});

const sourceConfigSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Source name must be lowercase alphanumeric with hyphens'),
  provider: z.enum(['stripe', 'github', 'twilio', 'shopify', 'generic']).default('generic'),
  signing_secret: z.string().optional(),
  endpoints: z.array(endpointConfigSchema).min(1),
});

export const configSchema = z.object({
  server: z.object({
    port: z.number().int().min(1).max(65535).default(9090),
    host: z.string().default('0.0.0.0'),
  }).default({}),

  database: z.object({
    path: z.string().default('./hookdash.db'),
  }).default({}),

  delivery: z.object({
    poll_interval: z.number().int().min(100).max(60000).default(1000),
    default_timeout: z.number().int().min(1000).max(120000).default(30000),
    default_max_retries: z.number().int().min(0).max(50).default(8),
  }).default({}),

  sources: z.array(sourceConfigSchema).default([]),
});

export type ValidatedConfig = z.infer<typeof configSchema>;
