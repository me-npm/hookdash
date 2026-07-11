import type { Database } from 'better-sqlite3';
import type { CircuitState } from '../types/index.js';

export class CircuitBreaker {
  private db: Database;
  private failureThreshold = 5;
  private cooldownMs = 60000; // 60 seconds

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Check if we can deliver to this endpoint.
   * If state is open, checks if cooldown has expired to transition to half-open.
   */
  canDeliver(endpointId: string): boolean {
    const row = this.db.prepare(
      'SELECT circuit_state, circuit_last_failure_at FROM endpoints WHERE id = ?'
    ).get(endpointId) as { circuit_state: CircuitState; circuit_last_failure_at: string | null } | undefined;

    if (!row) return false;

    if (row.circuit_state === 'closed' || row.circuit_state === 'half-open') {
      return true;
    }

    if (row.circuit_state === 'open' && row.circuit_last_failure_at) {
      const lastFailure = new Date(row.circuit_last_failure_at).getTime();
      const elapsed = Date.now() - lastFailure;

      if (elapsed >= this.cooldownMs) {
        // Transition to half-open to allow a probe request
        this.db.prepare(
          "UPDATE endpoints SET circuit_state = 'half-open' WHERE id = ?"
        ).run(endpointId);
        return true;
      }
    }

    return false;
  }

  /**
   * Reset circuit to closed on successful delivery.
   */
  recordSuccess(endpointId: string): void {
    this.db.prepare(`
      UPDATE endpoints
      SET circuit_state = 'closed',
          circuit_failure_count = 0,
          circuit_last_failure_at = NULL
      WHERE id = ?
    `).run(endpointId);
  }

  /**
   * Record failure. If consecutive failures exceed threshold, open the circuit.
   */
  recordFailure(endpointId: string): void {
    const row = this.db.prepare(
      'SELECT circuit_failure_count, circuit_state FROM endpoints WHERE id = ?'
    ).get(endpointId) as { circuit_failure_count: number; circuit_state: CircuitState } | undefined;

    if (!row) return;

    const newFailureCount = row.circuit_failure_count + 1;
    const nowStr = new Date().toISOString();

    if (newFailureCount >= this.failureThreshold || row.circuit_state === 'half-open') {
      // Open the circuit
      this.db.prepare(`
        UPDATE endpoints
        SET circuit_state = 'open',
            circuit_failure_count = ?,
            circuit_last_failure_at = ?
        WHERE id = ?
      `).run(newFailureCount, nowStr, endpointId);
    } else {
      // Just increment failure count
      this.db.prepare(`
        UPDATE endpoints
        SET circuit_failure_count = ?,
            circuit_last_failure_at = ?
        WHERE id = ?
      `).run(newFailureCount, nowStr, endpointId);
    }
  }
}
