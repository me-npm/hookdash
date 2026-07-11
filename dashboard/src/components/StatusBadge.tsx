
interface StatusBadgeProps {
  status: 'pending' | 'success' | 'failed' | 'retrying' | 'dead';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let label: string = status;
  let bgClass = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  let dotClass = 'bg-gray-500';

  switch (status) {
    case 'success':
      label = 'Delivered';
      bgClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      dotClass = 'bg-emerald-500';
      break;
    case 'pending':
      label = 'Pending';
      bgClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      dotClass = 'bg-amber-500';
      break;
    case 'retrying':
      label = 'Retrying';
      bgClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      dotClass = 'bg-blue-500';
      break;
    case 'failed':
      label = 'Failed';
      bgClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      dotClass = 'bg-rose-500';
      break;
    case 'dead':
      label = 'Dead Letter';
      bgClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      dotClass = 'bg-purple-500';
      break;
  }

  return (
    <span
      className={`inline-flex align-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${bgClass}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          display: 'inline-block',
        }}
        className={dotClass}
      />
      {label}
    </span>
  );
}
