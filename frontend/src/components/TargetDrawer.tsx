/* ============================================================
   AquaYantra — TargetDrawer component
   Detailed slide-over inspection drawer for seabed target candidates
   ============================================================ */

import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Compass, Gauge, AlertCircle, CheckCircle2, ShieldAlert, Layers } from 'lucide-react';
import type { TargetCandidate } from '../types';
import { StatusBadge } from './StatusBadge';

interface TargetDrawerProps {
  target: TargetCandidate | null;
  onClose: () => void;
  onStatusChange?: (targetId: string, newStatus: 'confirmed' | 'dismissed') => void;
}

export function TargetDrawer({ target, onClose, onStatusChange }: TargetDrawerProps) {
  if (!target) return null;

  const priorityColors: Record<string, string> = {
    LOW: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
    MEDIUM: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
    HIGH: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
    VERY_HIGH: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-medium)] h-full flex flex-col shadow-2xl overflow-y-auto"
        >
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Target size={18} />
              </div>
              <div>
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                  Target Identification
                </span>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] font-mono">
                  {target.target_id}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 flex-1">
            {/* Status & Priority Ribbon */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">Priority</span>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityColors[target.priority] || priorityColors.MEDIUM}`}>
                  {target.priority}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block text-right">Verification</span>
                <div className="mt-1">
                  <StatusBadge status={target.status} size="sm" />
                </div>
              </div>
            </div>

            {/* Geographic & Bathymetric Fix */}
            <div className="card space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium border-b border-[var(--border-subtle)] pb-2">
                <Compass size={14} className="text-cyan-400" />
                <span>Geographic Fix & Bathymetry</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Latitude</span>
                  <span className="text-[var(--text-primary)]">{target.latitude.toFixed(6)}° N</span>
                </div>
                <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Longitude</span>
                  <span className="text-[var(--text-primary)]">{target.longitude.toFixed(6)}° E</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Spatial Extent</span>
                  <span className="text-[var(--text-primary)]">
                    {target.spatial_extent_meters ? `~${target.spatial_extent_meters.toFixed(1)} m` : 'Point source (<2m)'}
                  </span>
                </div>
                <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Depth Range</span>
                  <span className="text-[var(--text-primary)]">
                    {target.depth_range ? `${target.depth_range[0]}m – ${target.depth_range[1]}m` : '15.2m (Seabed)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Anomaly Metrics */}
            <div className="card space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium border-b border-[var(--border-subtle)] pb-2">
                <Gauge size={14} className="text-amber-400" />
                <span>Magnetic Anomaly Characteristics</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Peak Score</span>
                  <span className="text-sm font-semibold text-amber-400">
                    {(target.peak_anomaly_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Mean Score</span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {(target.mean_anomaly_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Confidence</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    {(target.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)] flex items-start gap-2">
                <Layers size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  Observed across <span className="font-mono text-cyan-300 font-semibold">{target.observation_count}</span> sensor sampling passes with consistent bipolar dipole curvature.
                </div>
              </div>
            </div>

            {/* Scientific Interpretation */}
            <div className="card space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium border-b border-[var(--border-subtle)] pb-2">
                <ShieldAlert size={14} className="text-cyan-400" />
                <span>Classification & Hypothesis</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Magnetic deviation indicates a localized ferromagnetic anomaly with high magnetic susceptibility contrast relative to regional background baseline. Consistent with sub-seabed ferrous infrastructure, metallic wreckage, or dense mineral aggregate.
              </p>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex gap-2">
            <button
              onClick={() => onStatusChange?.(target.target_id, 'confirmed')}
              className="flex-1 py-2 px-3 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              <span>Confirm Target</span>
            </button>
            <button
              onClick={() => onStatusChange?.(target.target_id, 'dismissed')}
              className="py-2 px-3 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-rose-400 hover:border-rose-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <AlertCircle size={14} />
              <span>Dismiss</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
