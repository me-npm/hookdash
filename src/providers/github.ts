import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookProvider } from '../types/index.js';

export const githubProvider: WebhookProvider = {
  name: 'github',

  verify(secret: string, headers: Record<string, string>, rawBody: Buffer): boolean {
    const sigHeader = headers['x-hub-signature-256'];
    if (!sigHeader) return false;

    // Format: "sha256=hexsignature"
    const prefix = 'sha256=';
    if (!sigHeader.startsWith(prefix)) return false;

    const signature = sigHeader.slice(prefix.length);

    const expectedSig = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison
    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  },

  extractEventType(headers: Record<string, string>, _body: unknown): string | null {
    return headers['x-github-event'] ?? null;
  },
};
