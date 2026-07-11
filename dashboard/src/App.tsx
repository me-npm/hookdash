import { useState, useEffect } from 'react';
import { Layout } from './components/Layout.tsx';
import { StatsCards } from './components/StatsCards.tsx';
import { EventList } from './components/EventList.tsx';
import { EventDetail } from './components/EventDetail.tsx';
import { EndpointList } from './components/EndpointList.tsx';
import { api, connectSSE } from './api/client.ts';

export default function App() {
  const [currentPage, setCurrentPage] = useState('events'); // events | endpoints | stats
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  // SSE Connection
  const [sseConnected, setSseConnected] = useState(false);

  // Shared Data States
  const [sources, setSources] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // Events pagination & filters
  const [events, setEvents] = useState<any[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    source: '',
    status: '',
    event_type: '',
  });

  // Load basic components context
  const loadSharedData = async () => {
    try {
      const statsRes = await api.getStats();
      setStats(statsRes);
      
      const endpointsRes = await api.getEndpoints();
      // Extract unique source definitions from endpoints
      const uniqueSourcesMap = new Map();
      endpointsRes.forEach((ep: any) => {
        if (ep.source_id && ep.source_name) {
          uniqueSourcesMap.set(ep.source_id, {
            id: ep.source_id,
            name: ep.source_name,
            provider: ep.source_provider,
          });
        }
      });
      setSources(Array.from(uniqueSourcesMap.values()));
    } catch (err) {
      console.error('Failed to load dashboard context data:', err);
    }
  };

  // Load events list on page/filter change
  const loadEvents = async () => {
    try {
      const res = await api.getEvents({
        page,
        per_page: 20,
        ...filters,
      });
      setEvents(res.data);
      setTotalEvents(res.total);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  useEffect(() => {
    loadSharedData();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [page, filters]);

  // Connect SSE for Real-time events pipeline updates
  useEffect(() => {
    const disconnect = connectSSE((event, _data) => {
      if (event === 'connected') {
        setSseConnected(true);
      }
      
      // On new webhook event incoming
      if (event === 'event:new') {
        // Trigger a reload of lists and stats
        loadSharedData();
        // If we are on page 1, pull down new events immediately
        if (page === 1) {
          loadEvents();
        }
      }

      // On delivery attempt completed / state update
      if (event === 'delivery:update') {
        loadSharedData();
        loadEvents();
      }
    });

    return () => {
      disconnect();
      setSseConnected(false);
    };
  }, [page, filters]);

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setCurrentPage('event-detail');
  };

  const handleBackToEvents = () => {
    setSelectedEventId(null);
    setCurrentPage('events');
  };

  const handleNavigate = (page: string) => {
    setSelectedEventId(null);
    setCurrentPage(page);
  };

  return (
    <Layout
      currentPage={selectedEventId ? 'events' : currentPage}
      onNavigate={handleNavigate}
      sseConnected={sseConnected}
    >
      {/* 1. Event Detail View */}
      {selectedEventId && (
        <EventDetail eventId={selectedEventId} onBack={handleBackToEvents} />
      )}

      {/* 2. Primary Dashboard Landing */}
      {!selectedEventId && currentPage === 'events' && (
        <>
          <StatsCards stats={stats} />
          <EventList
            events={events}
            total={totalEvents}
            page={page}
            perPage={20}
            sources={sources}
            onPageChange={setPage}
            onFilterChange={setFilters}
            onSelectEvent={handleSelectEvent}
          />
        </>
      )}

      {/* 3. Endpoint Configuration Panel */}
      {!selectedEventId && currentPage === 'endpoints' && (
        <EndpointList sources={sources} />
      )}

      {/* 4. Deep Metrics panel */}
      {!selectedEventId && currentPage === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <StatsCards stats={stats} />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
            {/* Top Sources */}
            <div className="glass" style={{ padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Top Sources</h3>
              {stats?.top_sources.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>No source data available.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {stats?.top_sources.map((s: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        {s.name}
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{s.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Event Types */}
            <div className="glass" style={{ padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Top Event Types</h3>
              {stats?.top_event_types.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>No event type data available.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats?.top_event_types.map((et: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                        {et.type}
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{et.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
