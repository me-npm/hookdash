/**
 * Calculates exponential backoff delay with jitter.
 * Formula: min(BASE * 2^attempt + jitter, MAX_DELAY)
 */
export function getNextRetryDelay(attempt: number): number {
  const BASE_DELAY = 1000; // 1 second
  const MAX_DELAY = 3600_000; // 1 hour
  const JITTER_FACTOR = 0.25;

  const exponential = BASE_DELAY * Math.pow(2, attempt);
  const capped = Math.min(exponential, MAX_DELAY);
  const jitter = capped * JITTER_FACTOR * Math.random();

  return capped + jitter;
}

/**
 * Determines if a request should be retried based on status code.
 * Retry on 5xx server errors and network errors (e.g. status code 0 or -1).
 * Do NOT retry on 4xx client errors (unauthorized, bad request, etc.), except for 429 Too Many Requests.
 */
export function shouldRetry(statusCode: number): boolean {
  if (statusCode === 0 || statusCode === -1) return true; // network errors, timeouts
  if (statusCode === 429) return true; // rate limited, retry later
  if (statusCode >= 500 && statusCode < 600) return true; // server errors
  return false;
}
