import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookProvider } from '../types/index.js';

export const shopifyProvider: WebhookProvider = {
  name: 'shopify',

  verify(secret: string, headers: Record<string, string>, rawBody: Buffer): boolean {
    const sigHeader = headers['x-shopify-hmac-sha256'];
    if (!sigHeader) return false;

    // HMAC-SHA256, base64 encoded
    const expectedSig = createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    // Constant-time comparison (compare raw bytes from base64)
    const sigBuf = Buffer.from(sigHeader, 'base64');
    const expectedBuf = Buffer.from(expectedSig, 'base64');

    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  },

  extractEventType(headers: Record<string, string>, _body: unknown): string | null {
    return headers['x-shopify-topic'] ?? null;
  },
};
