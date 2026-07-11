import { useState, useEffect } from 'react';
import { StatusBadge } from './StatusBadge.tsx';

interface EventListProps {
  events: any[];
  total: number;
  page: number;
  perPage: number;
  sources: any[];
  onPageChange: (page: number) => void;
  onFilterChange: (filters: any) => void;
  onSelectEvent: (id: string) => void;
}

export function EventList({
  events,
  total,
  page,
  perPage,
  sources,
  onPageChange,
  onFilterChange,
  onSelectEvent,
}: EventListProps) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [eventType, setEventType] = useState('');

  // Bounce filter updates back to parent
  useEffect(() => {
    const handler = setTimeout(() => {
      onFilterChange({ search, source, status, event_type: eventType });
    }, 300);

    return () => clearTimeout(handler);
  }, [search, source, status, eventType]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="glass animate-fade-in" style={{ padding: '24px', borderRadius: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Webhook Events</h2>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total: {total} event(s)</span>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <input
          type="text"
          className="input"
          placeholder="Search body or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        <select
          className="input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ cursor: 'pointer' }}
        >
          <option value="">All Sources</option>
          {sources.map((s: any) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>

        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ cursor: 'pointer' }}
        >
          <option value="">All Statuses</option>
          <option value="success">Delivered</option>
          <option value="pending">Pending</option>
          <option value="retrying">Retrying</option>
          <option value="failed">Failed</option>
          <option value="dead">Dead Letter</option>
        </select>

        <input
          type="text"
          className="input"
          placeholder="Event type (e.g. payment.*)"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>ID / Time</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Source</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Event Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Signature</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Deliveries</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px 16px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No webhook events received matching current filters.
                </td>
              </tr>
            ) : (
              events.map((ev: any) => {
                // Determine overall delivery status logic
                let overallStatus: 'pending' | 'success' | 'failed' | 'retrying' | 'dead' = 'pending';
                if (ev.success_count > 0 && ev.failed_count === 0) {
                  overallStatus = 'success';
                } else if (ev.failed_count > 0) {
                  overallStatus = 'failed';
                }
                
                const timeStr = new Date(ev.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const dateStr = new Date(ev.received_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

                return (
                  <tr
                    key={ev.id}
                    onClick={() => onSelectEvent(ev.id)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{ev.id}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{dateStr} at {timeStr}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                        {ev.source_name}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontWeight: 500 }}>
                      {ev.event_type || <span style={{ color: 'var(--text-muted)' }}>none</span>}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {ev.signature_valid === 1 ? (
                        <span style={{ color: 'var(--success-color)', fontSize: '13px' }}>🛡️ Valid</span>
                      ) : ev.signature_valid === 0 ? (
                        <span style={{ color: 'var(--error-color)', fontSize: '13px' }}>⚠️ Invalid</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Unchecked</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StatusBadge status={overallStatus} />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          ({ev.success_count}/{ev.delivery_count})
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              style={{ opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              style={{ opacity: page === totalPages ? 0.5 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
