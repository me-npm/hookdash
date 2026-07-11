import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookProvider } from '../types/index.js';

export const twilioProvider: WebhookProvider = {
  name: 'twilio',

  verify(secret: string, headers: Record<string, string>, rawBody: Buffer): boolean {
    const sigHeader = headers['x-twilio-signature'];
    if (!sigHeader) return false;

    // HMAC-SHA1, base64 encoded
    const expectedSig = createHmac('sha1', secret)
      .update(rawBody)
      .digest('base64');

    // Constant-time comparison (compare as raw bytes from base64)
    const sigBuf = Buffer.from(sigHeader, 'base64');
    const expectedBuf = Buffer.from(expectedSig, 'base64');

    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  },

  extractEventType(_headers: Record<string, string>, body: unknown): string | null {
    // Twilio doesn't have a standard event type header — try to extract from body
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      // Twilio status callbacks include an EventType or similar field
      if (typeof b.EventType === 'string') return b.EventType;
      if (typeof b.event_type === 'string') return b.event_type;
      if (typeof b.type === 'string') return b.type;
    }
    return null;
  },
};
