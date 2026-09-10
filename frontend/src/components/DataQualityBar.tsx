/* ============================================================
   AquaYantra — DataQualityBar component
   Displays sensor signal data quality score (0 - 100%)
   with scientific color ramp and status label
   ============================================================ */

import { clsx } from 'clsx';

interface DataQualityBarProps {
  quality: number | null; // 0 to 1 or 0 to 100
  label?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function DataQualityBar({
  quality,
  label = 'Quality',
  showPercent = true,
  size = 'md',
  className,
}: DataQualityBarProps) {
  if (quality === null || quality === undefined) {
    return (
      <div className={clsx('flex flex-col gap-1', className)}>
        {label && <span className="telemetry-label">{label}</span>}
        <span className="text-xs text-[var(--text-muted)] font-mono">—</span>
      </div>
    );
  }

  // Normalize to 0-100
  const normalized = quality <= 1 ? Math.round(quality * 100) : Math.round(quality);
  const clamped = Math.max(0, Math.min(100, normalized));

  const getColorClass = (val: number) => {
    if (val >= 85) return 'bg-emerald-400 text-emerald-400';
    if (val >= 65) return 'bg-cyan-400 text-cyan-400';
    if (val >= 40) return 'bg-amber-400 text-amber-400';
    return 'bg-rose-500 text-rose-500';
  };

  const getStatusText = (val: number) => {
    if (val >= 85) return 'Optimal';
    if (val >= 65) return 'Good';
    if (val >= 40) return 'Degraded';
    return 'Critical';
  };

  const colorCls = getColorClass(clamped);

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        {label && <span className="telemetry-label">{label}</span>}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)]">{getStatusText(clamped)}</span>
          {showPercent && (
            <span className={clsx('font-mono font-medium', size === 'sm' ? 'text-[11px]' : 'text-xs')}>
              {clamped}%
            </span>
          )}
        </div>
      </div>

      <div
        className={clsx(
          'w-full bg-[var(--bg-deep)] rounded-full overflow-hidden border border-[var(--border-subtle)]',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-300', colorCls.split(' ')[0])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
