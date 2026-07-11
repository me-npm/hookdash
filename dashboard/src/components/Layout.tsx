import React from 'react';

interface LayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  sseConnected: boolean;
  children: React.ReactNode;
}

export function Layout({ currentPage, onNavigate, sseConnected, children }: LayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        className="glass"
        style={{
          width: 'var(--sidebar-width)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          top: 0,
          left: 0,
          zIndex: 10,
          padding: '24px 16px',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px', padding: '0 8px' }}>
          <span style={{ fontSize: '24px', color: 'var(--accent-color)', fontWeight: 'bold' }}>∿</span>
          <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.5px' }}>hookdash</span>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button
            onClick={() => onNavigate('events')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: currentPage === 'events' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: currentPage === 'events' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: currentPage === 'events' ? 500 : 400,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <span>🪝</span> Events
          </button>

          <button
            onClick={() => onNavigate('endpoints')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: currentPage === 'endpoints' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: currentPage === 'endpoints' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: currentPage === 'endpoints' ? 500 : 400,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <span>📡</span> Endpoints
          </button>

          <button
            onClick={() => onNavigate('stats')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              background: currentPage === 'stats' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: currentPage === 'stats' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: currentPage === 'stats' ? 500 : 400,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <span>📊</span> Statistics
          </button>
        </nav>

        {/* Live Status indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '13px',
            color: sseConnected ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          <span className={sseConnected ? 'live-indicator' : ''} style={{ background: sseConnected ? undefined : '#4b5563', boxShadow: sseConnected ? undefined : 'none', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} />
          {sseConnected ? 'Real-time Feed Connected' : 'Connecting Feed...'}
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        style={{
          marginLeft: 'var(--sidebar-width)',
          flex: 1,
          padding: '40px',
          maxWidth: '1200px',
        }}
      >
        {children}
      </main>
    </div>
  );
}
