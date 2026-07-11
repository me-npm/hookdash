import { useState, useEffect } from 'react';
import { api } from '../api/client.ts';
import { StatusBadge } from './StatusBadge.tsx';

interface EventDetailProps {
  eventId: string;
  onBack: () => void;
}

export function EventDetail({ eventId, onBack }: EventDetailProps) {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const data = await api.getEvent(eventId);
      setEvent(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [eventId]);

  const handleReplay = async () => {
    if (!window.confirm('Are you sure you want to replay all deliveries for this event?')) return;
    try {
      setReplaying(true);
      await api.replayEvent(eventId);
      alert('Event deliveries queued successfully!');
      fetchDetail(); // Reload detail to see new attempts
    } catch (err: any) {
      alert(`Replay failed: ${err.message}`);
    } finally {
      setReplaying(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this event permanently? This cannot be undone.')) return;
    try {
      setDeleting(true);
      await api.deleteEvent(eventId);
      onBack();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
      setDeleting(false);
    }
  };

  // Syntax highlighter for JSON
  const highlightJSON = (jsonStr: string) => {
    if (!jsonStr) return '';
    try {
      const obj = JSON.parse(jsonStr);
      const pretty = JSON.stringify(obj, null, 2);
      return pretty
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
          let cls = 'json-number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'json-key';
            } else {
              cls = 'json-string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
          } else if (/null/.test(match)) {
            cls = 'json-null';
          }
          return `<span class="${cls}">${match}</span>`;
        });
    } catch (e) {
      return jsonStr; // fallback for raw text/form data
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading event details...</div>;
  }

  if (error || !event) {
    return (
      <div>
        <div style={{ color: 'var(--error-color)', marginBottom: '16px' }}>{error || 'Event not found'}</div>
        <button className="btn btn-secondary" onClick={onBack}>Back to Events</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Event <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{event.id}</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Received at {new Date(event.received_at).toLocaleString()}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={handleReplay} disabled={replaying}>
            🔄 {replaying ? 'Replaying...' : 'Replay Event'}
          </button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            🗑️ {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Left Side: Payloads */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metadata Card */}
          <div className="glass" style={{ padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Event Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Source</span>
                <span style={{ fontWeight: 500 }}>{event.source_name} ({event.source_provider})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Event Type</span>
                <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{event.event_type || 'none'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Signature Status</span>
                <span>
                  {event.signature_valid === 1 ? (
                    <span style={{ color: 'var(--success-color)' }}>🛡️ Valid</span>
                  ) : event.signature_valid === 0 ? (
                    <span style={{ color: 'var(--error-color)' }}>⚠️ Invalid Signature</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Unchecked</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Headers Card */}
          <div className="glass" style={{ padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Request Headers</h3>
            <pre
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                background: 'rgba(0,0,0,0.2)',
                padding: '12px',
                borderRadius: '6px',
                overflowX: 'auto',
                maxHeight: '220px',
              }}
            >
              {JSON.stringify(JSON.parse(event.headers), null, 2)}
            </pre>
          </div>

          {/* Payload Card */}
          <div className="glass" style={{ padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Payload Body</h3>
            <pre
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                background: 'rgba(0,0,0,0.2)',
                padding: '16px',
                borderRadius: '6px',
                overflowX: 'auto',
                maxHeight: '400px',
              }}
              dangerouslySetInnerHTML={{ __html: highlightJSON(event.body) }}
            />
          </div>
        </div>

        {/* Right Side: Delivery Timeline */}
        <div className="glass" style={{ padding: '20px', borderRadius: '12px', alignSelf: 'start' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Delivery Attempts</h3>
          {event.deliveries.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No deliveries triggered for this event.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {event.deliveries.map((del: any) => (
                <div
                  key={del.id}
                  style={{
                    borderLeft: '2px solid var(--border-color)',
                    paddingLeft: '16px',
                    position: 'relative',
                  }}
                >
                  {/* Status dot overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-5px',
                      top: '4px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: del.status === 'success' ? 'var(--success-color)' : del.status === 'dead' ? 'var(--error-color)' : 'var(--warning-color)',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-all', maxWidth: '70%' }}>
                      {del.endpoint_url}
                    </span>
                    <StatusBadge status={del.status} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div>
                      Attempts: <strong>{del.attempts}</strong>
                    </div>
                    {del.last_status_code && (
                      <div>
                        Response Status: <strong style={{ color: del.last_status_code >= 200 && del.last_status_code < 300 ? 'var(--success-color)' : 'var(--error-color)' }}>{del.last_status_code}</strong>
                      </div>
                    )}
                    {del.last_error && (
                      <div style={{ color: 'var(--error-color)', background: 'rgba(239, 68, 68, 0.05)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                        Error: {del.last_error}
                      </div>
                    )}
                    {del.next_retry_at && (
                      <div style={{ color: 'var(--warning-color)' }}>
                        Next retry scheduled: {new Date(del.next_retry_at).toLocaleString()}
                      </div>
                    )}
                    {del.completed_at && (
                      <div style={{ color: 'var(--text-muted)' }}>
                        Completed: {new Date(del.completed_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
