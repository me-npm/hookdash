import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookProvider } from '../types/index.js';

export const genericProvider: WebhookProvider = {
  name: 'generic',

  verify(secret: string, headers: Record<string, string>, rawBody: Buffer): boolean {
    // Check both common signature headers
    const sigHeader = headers['x-webhook-signature'] ?? headers['x-signature'];
    if (!sigHeader) return false;

    // HMAC-SHA256, hex encoded
    const expectedSig = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison
    const sigBuf = Buffer.from(sigHeader, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  },

  extractEventType(_headers: Record<string, string>, body: unknown): string | null {
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      // Try common event type field names
      if (typeof b.event === 'string') return b.event;
      if (typeof b.type === 'string') return b.type;
    }
    return null;
  },
};
