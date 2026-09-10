/* ============================================================
   AquaYantra — MetricCard component
   Displays a single telemetry metric with value, unit, trend,
   status indicator, and optional label/subtitle.
   ============================================================ */

import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  subtitle?: string;
  trend?: number | null;       // positive = up, negative = down, 0/null = neutral
  status?: 'normal' | 'watch' | 'anomaly' | 'fault' | 'offline';
  accent?: 'cyan' | 'green' | 'amber' | 'red' | 'default';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ACCENT_BORDER: Record<string, string> = {
  cyan: 'border-l-cyan-500',
  green: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
  default: 'border-l-[var(--border-medium)]',
};

const STATUS_DOT: Record<string, string> = {
  normal: 'bg-emerald-400',
  watch: 'bg-amber-400',
  anomaly: 'bg-amber-400 animate-dot-pulse',
  fault: 'bg-red-400 animate-dot-pulse',
  offline: 'bg-slate-500',
};

const VALUE_SIZE: Record<string, string> = {
  sm: 'telemetry-value-sm',
  md: 'telemetry-value',
  lg: 'telemetry-value-lg',
};

export function MetricCard({
  label,
  value,
  unit,
  subtitle,
  trend,
  status = 'normal',
  accent = 'default',
  size = 'md',
  className,
}: MetricCardProps) {
  const displayValue = value === null || value === undefined ? '—' : String(value);

  return (
    <div
      className={clsx(
        'card border-l-2 flex flex-col gap-1.5',
        ACCENT_BORDER[accent],
        status === 'anomaly' && 'glow-anomaly',
        status === 'fault' && 'glow-critical',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="telemetry-label">{label}</span>
        <span className={clsx('h-2 w-2 rounded-full', STATUS_DOT[status])} />
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className={clsx('font-mono', VALUE_SIZE[size])}>{displayValue}</span>
        {unit && <span className="telemetry-unit">{unit}</span>}
      </div>

      {/* Subtitle + Trend */}
      <div className="flex items-center justify-between min-h-[16px]">
        {subtitle && (
          <span className="text-[11px] text-[var(--text-muted)]">{subtitle}</span>
        )}
        {trend !== null && trend !== undefined && (
          <span
            className={clsx(
              'flex items-center gap-0.5 text-[11px] font-mono',
              trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-[var(--text-muted)]',
            )}
          >
            {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
