import type { WebhookProvider } from '../types/index.js';
import { stripeProvider } from './stripe.js';
import { githubProvider } from './github.js';
import { twilioProvider } from './twilio.js';
import { shopifyProvider } from './shopify.js';
import { genericProvider } from './generic.js';

const providers = new Map<string, WebhookProvider>();

function register(provider: WebhookProvider): void {
  providers.set(provider.name, provider);
}

// Register all built-in providers
register(stripeProvider);
register(githubProvider);
register(twilioProvider);
register(shopifyProvider);
register(genericProvider);

/**
 * Retrieve a webhook provider by name.
 * @throws Error if the provider is not registered.
 */
export function getProvider(name: string): WebhookProvider {
  const provider = providers.get(name);
  if (!provider) {
    const available = [...providers.keys()].join(', ');
    throw new Error(
      `Unknown webhook provider "${name}". Available providers: ${available}`,
    );
  }
  return provider;
}
