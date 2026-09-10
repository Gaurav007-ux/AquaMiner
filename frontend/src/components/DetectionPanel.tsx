/* ============================================================
   AquaYantra — DetectionPanel component
   Intelligent detection status card with 6 states
   ============================================================ */

import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Target, Radio, CircleAlert } from 'lucide-react';

type DetectionLevel = 'BACKGROUND' | 'WATCH' | 'CANDIDATE' | 'CONFIRMED_EVENT' | 'SENSOR_WARNING' | 'NO_MAG_DATA';

interface DetectionPanelProps {
  status: string;
  anomalyScore: number;
  confidence: number;
  peakStrength?: number | null;
  duration?: number | null;
  depth?: number | null;
  className?: string;
}

const PANEL_CONFIG: Record<DetectionLevel, {
  icon: typeof Shield;
  title: string;
  accent: string;
  border: string;
  bg: string;
  glow: string;
}> = {
  BACKGROUND: {
    icon: Shield,
    title: 'NORMAL OPERATIONS',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    glow: '',
  },
  WATCH: {
    icon: Radio,
    title: 'MONITORING ANOMALY',
    accent: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    glow: '',
  },
  CANDIDATE: {
    icon: Target,
    title: 'POTENTIAL TARGET DETECTED',
    accent: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    glow: 'glow-anomaly',
  },
  CONFIRMED_EVENT: {
    icon: Target,
    title: 'HIGH PRIORITY TARGET',
    accent: 'text-amber-300',
    border: 'border-amber-400/40',
    bg: 'bg-amber-500/8',
    glow: 'glow-anomaly',
  },
  SENSOR_WARNING: {
    icon: AlertTriangle,
    title: 'SENSOR WARNING',
    accent: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    glow: '',
  },
  NO_MAG_DATA: {
    icon: CircleAlert,
    title: 'SENSOR FAULT',
    accent: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    glow: 'glow-critical',
  },
};

function resolveLevel(status: string): DetectionLevel {
  if (status === 'CONFIRMED_EVENT') return 'CONFIRMED_EVENT';
  if (status === 'CANDIDATE') return 'CANDIDATE';
  if (status === 'WATCH') return 'WATCH';
  if (status === 'NO_MAG_DATA') return 'NO_MAG_DATA';
  if (status === 'SENSOR_WARNING') return 'SENSOR_WARNING';
  return 'BACKGROUND';
}

export function DetectionPanel({
  status,
  anomalyScore,
  confidence,
  peakStrength,
  duration,
  depth,
  className,
}: DetectionPanelProps) {
  const level = resolveLevel(status);
  const config = PANEL_CONFIG[level];
  const Icon = config.icon;

  const isTarget = level === 'CANDIDATE' || level === 'CONFIRMED_EVENT';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={level}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25 }}
        className={clsx(
          'rounded-lg border p-4',
          config.border,
          config.bg,
          config.glow,
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Icon size={16} className={config.accent} />
          <span className={clsx('text-xs font-semibold tracking-wider uppercase', config.accent)}>
            {config.title}
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="telemetry-label">Anomaly Score</div>
            <div className={clsx('font-mono text-lg font-semibold', anomalyScore > 0.65 ? 'text-amber-400' : 'text-[var(--text-primary)]')}>
              {anomalyScore.toFixed(3)}
            </div>
          </div>
          <div>
            <div className="telemetry-label">Confidence</div>
            <div className={clsx('font-mono text-lg font-semibold', confidence > 0.8 ? 'text-cyan-400' : 'text-[var(--text-primary)]')}>
              {confidence.toFixed(3)}
            </div>
          </div>
          {peakStrength != null && (
            <div>
              <div className="telemetry-label">Peak Strength</div>
              <div className="font-mono text-sm text-[var(--text-primary)]">
                {peakStrength > 0 ? '+' : ''}{peakStrength.toFixed(1)} <span className="telemetry-unit">µT</span>
              </div>
            </div>
          )}
          {duration != null && (
            <div>
              <div className="telemetry-label">Duration</div>
              <div className="font-mono text-sm text-[var(--text-primary)]">
                {duration.toFixed(1)} <span className="telemetry-unit">s</span>
              </div>
            </div>
          )}
          {depth != null && (
            <div>
              <div className="telemetry-label">Depth</div>
              <div className="font-mono text-sm text-[var(--text-primary)]">
                {depth.toFixed(1)} <span className="telemetry-unit">m</span>
              </div>
            </div>
          )}
        </div>

        {/* Interpretation */}
        {isTarget && (
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-amber-400/80 italic">
              Potential magnetic target — requires further investigation
            </p>
          </div>
        )}
        {level === 'NO_MAG_DATA' && (
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-red-400/80 italic">
              Magnetometer data unavailable — check sensor connection
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
