import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookProvider } from '../types/index.js';

const TIMESTAMP_TOLERANCE_SEC = 300; // 5 minutes

export const stripeProvider: WebhookProvider = {
  name: 'stripe',

  verify(secret: string, headers: Record<string, string>, rawBody: Buffer): boolean {
    const sigHeader = headers['stripe-signature'];
    if (!sigHeader) return false;

    // Parse "t=timestamp,v1=signature" format
    const parts = new Map<string, string>();
    for (const pair of sigHeader.split(',')) {
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      parts.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }

    const timestamp = parts.get('t');
    const signature = parts.get('v1');
    if (!timestamp || !signature) return false;

    // Validate timestamp within tolerance
    const ts = parseInt(timestamp, 10);
    if (Number.isNaN(ts)) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SEC) return false;

    // Signed payload: "${timestamp}.${rawBody}"
    const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expectedSig = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison
    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  },

  extractEventType(_headers: Record<string, string>, body: unknown): string | null {
    if (body && typeof body === 'object' && 'type' in body) {
      const t = (body as Record<string, unknown>).type;
      return typeof t === 'string' ? t : null;
    }
    return null;
  },
};
