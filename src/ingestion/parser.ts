/**
 * Normalize headers to lowercase keys.
 * HTTP headers are case-insensitive, so we standardize for consistent lookup.
 */
export function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return normalized;
}

/**
 * Safely parse a raw body as JSON and attempt to extract the event type.
 * Returns the parsed body and event type (if found).
 */
export function parseBodyEventType(rawBody: Buffer): {
  parsed: unknown;
  eventType: string | null;
} {
  let parsed: unknown = null;
  let eventType: string | null = null;

  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch {
    // Body is not JSON — that's fine, return null
    return { parsed: null, eventType: null };
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    // Try common event type field names in priority order
    for (const field of ['event', 'type', 'event_type', 'eventType', 'action']) {
      if (typeof obj[field] === 'string') {
        eventType = obj[field] as string;
        break;
      }
    }
  }

  return { parsed, eventType };
}

/**
 * Match an event type against a list of glob patterns.
 * Supported patterns:
 *   - `*`         → matches everything
 *   - `order.*`   → matches `order.created`, `order.updated`, etc.
 *   - `push`      → exact match
 *   - `issues.*`  → matches `issues.opened`, `issues.closed`
 *
 * Returns true if eventType matches ANY of the patterns, or if the
 * filter list is empty/null (meaning "accept all").
 */
export function matchesEventFilter(
  eventType: string | null,
  filterPatterns: string[] | null,
): boolean {
  // No filter = accept everything
  if (!filterPatterns || filterPatterns.length === 0) return true;

  // No event type but filters exist — can't match
  if (!eventType) return false;

  return filterPatterns.some((pattern) => globMatch(pattern, eventType));
}

/**
 * Simple glob matching for webhook event types.
 * Converts glob pattern to regex:
 *   `*`   → `[^.]*` (single segment)
 *   `**`  → `.*`    (any number of segments)
 *   `.`   → `\.`    (literal dot)
 */
function globMatch(pattern: string, value: string): boolean {
  // Shortcut: universal wildcard
  if (pattern === '*' || pattern === '**') return true;

  // Escape regex specials except * and ?
  let regexStr = '';
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches across dots
        regexStr += '.*';
        i += 2;
      } else {
        // * matches within a single segment (no dots)
        regexStr += '[^.]*';
        i += 1;
      }
    } else if (char === '?') {
      regexStr += '[^.]';
      i += 1;
    } else if ('.+^${}()|[]\\'.includes(char)) {
      regexStr += `\\${char}`;
      i += 1;
    } else {
      regexStr += char;
      i += 1;
    }
  }

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(value);
}
