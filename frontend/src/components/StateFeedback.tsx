/* ============================================================
   AquaYantra — StateFeedback components
   EmptyState, ErrorState, LoadingState
   ============================================================ */

import { AlertTriangle, Database, Loader2, RefreshCw } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Acquiring telemetry stream...', className = 'py-12' }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
      <Loader2 size={24} className="text-cyan-400 animate-spin" />
      <span className="text-xs text-[var(--text-secondary)] font-mono tracking-wide">{message}</span>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Sensor Telemetry Offline',
  message = 'Unable to establish link with underwater node or backend service.',
  onRetry,
  className = 'py-12',
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center p-6 card border-rose-500/30 bg-rose-950/10 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
        <AlertTriangle size={20} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-medium)] text-xs text-[var(--text-secondary)] hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
        >
          <RefreshCw size={13} />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title = 'No Data Available',
  message = 'No records match the current survey window or filter criteria.',
  actionLabel,
  onAction,
  className = 'py-12',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center p-6 ${className}`}>
      <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
        <Database size={18} />
      </div>
      <div>
        <h4 className="text-xs font-semibold text-[var(--text-primary)]">{title}</h4>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-xs">{message}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 px-3 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
