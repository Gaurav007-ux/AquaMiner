/* ============================================================
   AquaYantra — StatusBadge component
   ============================================================ */

import { clsx } from 'clsx';

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  // Health
  HEALTHY:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  healthy:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  active:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  connected:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  calibrated:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },

  // Warning
  WARNING:      { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  warning:      { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  adapting:     { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  DEGRADED:     { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  degraded:     { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  reconnecting: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  initializing: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  paused:       { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },

  // Danger
  FAULT:        { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  fault:        { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  sensor_fault: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  error:        { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  unhealthy:    { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  failed:       { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  OFFLINE:      { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },

  // Info
  frozen:        { bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  connecting:    { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  training:      { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  validating:    { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  planned:       { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
  uncalibrated:  { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
  disconnected:  { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
  completed:     { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
  retired:       { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
};

const DEFAULT_STYLE = { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' };

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'sm', pulse = false, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || DEFAULT_STYLE;
  const label = status.replace(/_/g, ' ').toUpperCase();

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        style.bg,
        style.text,
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
    >
      <span
        className={clsx(
          'rounded-full',
          style.dot,
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          pulse && 'animate-dot-pulse',
        )}
      />
      {label}
    </span>
  );
}
