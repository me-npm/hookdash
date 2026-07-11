import type { FastifyPluginAsync } from 'fastify';
import type { Stats } from '../types/index.js';

export const statsRoutes: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  // GET /api/stats
  fastify.get('/', async (request, reply) => {
    const todayStr = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';

    // 1. Total & Today event count
    const eventCounts = db.prepare(`
      SELECT
        COUNT(id) as total,
        SUM(CASE WHEN received_at >= ? THEN 1 ELSE 0 END) as today
      FROM events
    `).get(todayStr) as { total: number; today: number | null };

    const totalEvents = eventCounts?.total || 0;
    const eventsToday = eventCounts?.today || 0;

    // 2. Deliveries by status
    const deliveryStats = db.prepare(`
      SELECT
        status,
        COUNT(id) as count
      FROM deliveries
      GROUP BY status
    `).all() as { status: string; count: number }[];

    let totalDeliveries = 0;
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    let deadDeliveries = 0;
    let pendingDeliveries = 0;

    for (const row of deliveryStats) {
      totalDeliveries += row.count;
      if (row.status === 'success') {
        successfulDeliveries = row.count;
      } else if (row.status === 'failed' || row.status === 'retrying') {
        failedDeliveries += row.count;
      } else if (row.status === 'dead') {
        deadDeliveries = row.count;
      } else if (row.status === 'pending') {
        pendingDeliveries = row.count;
      }
    }

    const successRate = totalDeliveries > 0
      ? Math.round((successfulDeliveries / (successfulDeliveries + deadDeliveries + failedDeliveries || 1)) * 1000) / 10
      : 100.0;

    // 3. Events per hour (last 24 hours)
    const activeHours: { hour: string; count: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 3600 * 1000);
      d.setMinutes(0, 0, 0);
      const isoStr = d.toISOString();
      // Format to YYYY-MM-DD HH:00
      const formatted = isoStr.replace('T', ' ').substring(0, 16);
      activeHours.push({ hour: formatted, count: 0 });
    }

    // Query events in last 24 hours
    const last24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const dbHours = db.prepare(`
      SELECT strftime('%Y-%m-%d %H:00', received_at) as hour_bucket, COUNT(id) as count
      FROM events
      WHERE received_at >= ?
      GROUP BY hour_bucket
      ORDER BY hour_bucket ASC
    `).all(last24h) as { hour_bucket: string; count: number }[];

    for (const dbHour of dbHours) {
      const match = activeHours.find(h => h.hour === dbHour.hour_bucket);
      if (match) {
        match.count = dbHour.count;
      }
    }

    // 4. Top sources
    const topSources = db.prepare(`
      SELECT s.name, COUNT(e.id) as count
      FROM events e
      JOIN sources s ON e.source_id = s.id
      GROUP BY s.name
      ORDER BY count DESC
      LIMIT 5
    `).all() as { name: string; count: number }[];

    // 5. Top event types
    const topEventTypes = db.prepare(`
      SELECT event_type as type, COUNT(id) as count
      FROM events
      WHERE event_type IS NOT NULL
      GROUP BY event_type
      ORDER BY count DESC
      LIMIT 10
    `).all() as { type: string; count: number }[];

    const stats: Stats = {
      total_events: totalEvents,
      events_today: eventsToday,
      total_deliveries: totalDeliveries,
      successful_deliveries: successfulDeliveries,
      failed_deliveries: failedDeliveries,
      dead_deliveries: deadDeliveries,
      pending_deliveries: pendingDeliveries,
      success_rate: successRate,
      events_per_hour: activeHours,
      top_sources: topSources,
      top_event_types: topEventTypes,
    };

    return stats;
  });
};
