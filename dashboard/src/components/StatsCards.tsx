
interface StatsCardsProps {
  stats: any;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) return null;

  // Compute Sparkline Path
  const events = stats.events_per_hour || [];
  const counts = events.map((h: any) => h.count);
  const maxCount = Math.max(...counts, 1);
  const chartHeight = 60;
  const chartWidth = 320;
  
  const points = events.map((h: any, i: number) => {
    const x = (i / Math.max(events.length - 1, 1)) * chartWidth;
    const y = chartHeight - (h.count / maxCount) * (chartHeight - 10);
    return `${x},${y}`;
  }).join(' ');

  const filledPoints = events.length > 0 
    ? `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        {/* Card 1: Total Events */}
        <div className="glass animate-fade-in" style={{ padding: '24px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Total Webhooks</span>
            <span style={{ fontSize: '20px' }}>🪝</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', letterSpacing: '-1px' }}>
            {stats.total_events.toLocaleString()}
          </div>
          <div style={{ color: 'var(--success-color)', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⚡</span> +{stats.events_today} received today
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="glass animate-fade-in" style={{ padding: '24px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Delivery Rate</span>
            <span style={{ fontSize: '20px' }}>🎯</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', letterSpacing: '-1px', color: stats.success_rate >= 95 ? 'var(--success-color)' : 'var(--warning-color)' }}>
            {stats.success_rate}%
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
            Successful / total deliveries
          </div>
        </div>

        {/* Card 3: Pending Queued */}
        <div className="glass animate-fade-in" style={{ padding: '24px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Pending Queue</span>
            <span style={{ fontSize: '20px' }}>⏳</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', letterSpacing: '-1px', color: stats.pending_deliveries > 0 ? 'var(--warning-color)' : 'var(--text-primary)' }}>
            {stats.pending_deliveries}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
            Currently in retry loop
          </div>
        </div>

        {/* Card 4: Dead Letter */}
        <div className="glass animate-fade-in" style={{ padding: '24px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Dead Letter Queue</span>
            <span style={{ fontSize: '20px' }}>💀</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', letterSpacing: '-1px', color: stats.dead_deliveries > 0 ? 'var(--error-color)' : 'var(--text-primary)' }}>
            {stats.dead_deliveries}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
            Exceeded retry limit
          </div>
        </div>
      </div>

      {/* Sparkline Chart */}
      {events.length > 0 && (
        <div className="glass" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>Webhook Ingestion (Last 24h)</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Max: {maxCount} / hr</span>
          </div>
          <div style={{ width: '100%', height: '80px', position: 'relative' }}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <line x1="0" y1={chartHeight - 1} x2={chartWidth} y2={chartHeight - 1} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              
              {/* Fill area */}
              {points && <polygon points={filledPoints} fill="url(#chartGradient)" />}
              {/* Sparkline line */}
              {points && <polyline points={points} fill="none" stroke="var(--accent-color)" strokeWidth="2" />}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
