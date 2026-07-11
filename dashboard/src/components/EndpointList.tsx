import React, { useState, useEffect } from 'react';
import { api } from '../api/client.ts';

interface EndpointListProps {
  sources: any[];
}

export function EndpointList({ sources }: EndpointListProps) {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [url, setUrl] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [eventFilterStr, setEventFilterStr] = useState('');
  const [headersStr, setHeadersStr] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [maxRetries, setMaxRetries] = useState(8);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingEndpointId, setTestingEndpointId] = useState<string | null>(null);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const data = await api.getEndpoints();
      setEndpoints(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load endpoints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return alert('URL is required');

    try {
      setIsSubmitting(true);
      
      let event_filter = null;
      if (eventFilterStr.trim()) {
        event_filter = eventFilterStr.split(',').map(s => s.trim()).filter(Boolean);
      }

      let headers = null;
      if (headersStr.trim()) {
        try {
          headers = JSON.parse(headersStr.trim());
        } catch (err) {
          alert('Custom Headers must be valid JSON');
          setIsSubmitting(false);
          return;
        }
      }

      await api.createEndpoint({
        url,
        source_id: sourceId || null,
        event_filter,
        headers,
        timeout_ms: timeoutMs,
        max_retries: maxRetries,
      });

      // Reset Form
      setUrl('');
      setSourceId('');
      setEventFilterStr('');
      setHeadersStr('');
      setTimeoutMs(30000);
      setMaxRetries(8);

      fetchEndpoints();
      alert('Endpoint created successfully!');
    } catch (err: any) {
      alert(`Failed to create: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this endpoint?')) return;
    try {
      await api.deleteEndpoint(id);
      fetchEndpoints();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleToggleActive = async (ep: any) => {
    try {
      await api.updateEndpoint(ep.id, { active: !ep.active });
      fetchEndpoints();
    } catch (err: any) {
      alert(`Failed to toggle status: ${err.message}`);
    }
  };

  const handleTestEndpoint = async (id: string) => {
    try {
      setTestingEndpointId(id);
      const res = await api.testEndpoint(id);
      if (res.success) {
        alert(`Test Success! Endpoint responded with ${res.status_code}\nResponse: ${res.response}`);
      } else {
        alert(`Test Failed!\nError: ${res.error || `HTTP ${res.status_code}`}`);
      }
    } catch (err: any) {
      alert(`Test request failed: ${err.message}`);
    } finally {
      setTestingEndpointId(null);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading endpoints...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      {/* List Endpoints */}
      <div className="glass" style={{ padding: '24px', borderRadius: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Configured Endpoints</h2>

        {error && <div style={{ color: 'var(--error-color)', marginBottom: '16px' }}>{error}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Target URL</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Bound Source</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Circuit State</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No forwarding endpoints configured yet.
                  </td>
                </tr>
              ) : (
                endpoints.map((ep) => (
                  <tr key={ep.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '14px' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500 }}>{ep.url}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '12px' }}>
                        <span>Timeout: {ep.timeout_ms}ms</span>
                        <span>Max Retries: {ep.max_retries}</span>
                      </div>
                      {ep.event_filter && (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {ep.event_filter.map((filter: string, idx: number) => (
                            <span key={idx} style={{ fontSize: '10px', background: 'rgba(59,130,246,0.1)', color: 'var(--accent-color)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.2)' }}>
                              {filter}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {ep.source_name ? (
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                          {ep.source_name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Universal (Any)</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span
                        style={{
                          textTransform: 'capitalize',
                          color: ep.circuit_state === 'closed' ? 'var(--success-color)' : ep.circuit_state === 'open' ? 'var(--error-color)' : 'var(--warning-color)',
                          fontWeight: 500,
                        }}
                      >
                        {ep.circuit_state}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <button
                        onClick={() => handleToggleActive(ep)}
                        style={{
                          background: ep.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid',
                          borderColor: ep.active ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)',
                          color: ep.active ? 'var(--success-color)' : 'var(--text-secondary)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        {ep.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleTestEndpoint(ep.id)}
                          disabled={testingEndpointId === ep.id}
                        >
                          {testingEndpointId === ep.id ? 'Testing...' : 'Test connection'}
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => handleDelete(ep.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Endpoint Form */}
      <div className="glass" style={{ padding: '24px', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Add Target Endpoint</h3>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Target URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://my-app.com/api/webhooks"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Bound Source</label>
              <select
                className="input"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="">Universal (Deliver any webhook source)</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.provider})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Event Filters (comma separated)</label>
              <input
                type="text"
                className="input"
                placeholder="payment.*, invoice.created"
                value={eventFilterStr}
                onChange={(e) => setEventFilterStr(e.target.value)}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Optional. Restricts webhook forwarding. Globs are supported.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Custom Headers (JSON)</label>
              <textarea
                className="input"
                placeholder='{ "x-custom-key": "my-secret-val" }'
                value={headersStr}
                onChange={(e) => setHeadersStr(e.target.value)}
                rows={2}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Timeout (ms)</label>
              <input
                type="number"
                className="input"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 30000)}
                min={1000}
                max={120000}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Max Retries</label>
              <input
                type="number"
                className="input"
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value) || 8)}
                min={0}
                max={50}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '8px' }} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Add Endpoint'}
          </button>
        </form>
      </div>
    </div>
  );
}
