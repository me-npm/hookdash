import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { configSchema } from './schema.js';
import type { HookdashConfig } from '../types/index.js';

/**
 * Interpolate ${ENV_VAR} references in strings with actual env values.
 */
function interpolateEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, envKey: string) => {
      const envValue = process.env[envKey.trim()];
      if (envValue === undefined) {
        console.warn(`[hookdash] Warning: Environment variable "${envKey}" is not set`);
        return '';
      }
      return envValue;
    });
  }
  if (Array.isArray(value)) {
    return value.map(interpolateEnvVars);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = interpolateEnvVars(v);
    }
    return result;
  }
  return value;
}

/**
 * Search for config file in standard locations.
 */
function findConfigFile(customPath?: string): string | null {
  if (customPath) {
    const resolved = resolve(customPath);
    if (existsSync(resolved)) return resolved;
    throw new Error(`Config file not found: ${resolved}`);
  }

  const candidates = [
    resolve('hookdash.config.yml'),
    resolve('hookdash.config.yaml'),
    resolve('.hookdash.yml'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Load and validate the hookdash configuration.
 * Priority: CLI args → config file → defaults
 */
export function loadConfig(options: {
  configPath?: string;
  port?: number;
  host?: string;
  dbPath?: string;
} = {}): HookdashConfig {
  let rawConfig: Record<string, unknown> = {};

  // Load from config file if found
  const configFile = findConfigFile(options.configPath);
  if (configFile) {
    const content = readFileSync(configFile, 'utf-8');
    const parsed = parseYaml(content);
    if (parsed && typeof parsed === 'object') {
      rawConfig = interpolateEnvVars(parsed) as Record<string, unknown>;
    }
    console.log(`[hookdash] Loaded config from ${configFile}`);
  }

  // CLI overrides
  if (options.port) {
    rawConfig.server = { ...(rawConfig.server as object || {}), port: options.port };
  }
  if (options.host) {
    rawConfig.server = { ...(rawConfig.server as object || {}), host: options.host };
  }
  if (options.dbPath) {
    rawConfig.database = { ...(rawConfig.database as object || {}), path: options.dbPath };
  }

  // Validate
  const result = configSchema.safeParse(rawConfig);
  if (!result.success) {
    const errors = result.error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  return result.data as HookdashConfig;
}
