/* ============================================================
   AquaYantra — Detection Analytics Page
   Signal processing cascade (Raw -> Calibrated -> Baseline -> Deviation -> Anomaly),
   historical anomaly events, and target candidate promotion
   ============================================================ */

import { useState, useMemo } from 'react';
import {
  Target,
  Activity,
  Layers,
  Sparkles,
  Download,
} from 'lucide-react';
import { useLiveStore } from '../stores';
import { StatusBadge } from '../components/StatusBadge';
import { TargetDrawer } from '../components/TargetDrawer';
import type { DetectionEvent, TargetCandidate } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// Realistic sample detection history
const HISTORICAL_DETECTIONS: DetectionEvent[] = [
  {
    id: 'evt-001',
    deployment_id: 'demo-deploy-001',
    timestamp: '2026-09-04T13:45:12Z',
    end_timestamp: '2026-09-04T13:45:32Z',
    latitude: 28.6142,
    longitude: 77.2094,
    depth: 15.6,
    anomaly_score: 0.88,
    confidence: 0.94,
    peak_strength: 18.4,
    mean_strength: 12.1,
    duration_seconds: 20,
    sample_count: 40,
    classification: 'CONFIRMED_EVENT',
    explanation: null,
    status: 'confirmed',
  },
  {
    id: 'evt-002',
    deployment_id: 'demo-deploy-001',
    timestamp: '2026-09-04T13:40:02Z',
    end_timestamp: '2026-09-04T13:40:24Z',
    latitude: 28.6136,
    longitude: 77.2086,
    depth: 15.1,
    anomaly_score: 0.65,
    confidence: 0.82,
    peak_strength: 7.8,
    mean_strength: 5.4,
    duration_seconds: 22,
    sample_count: 44,
    classification: 'CANDIDATE',
    explanation: null,
    status: 'detected',
  },
  {
    id: 'evt-003',
    deployment_id: 'demo-deploy-001',
    timestamp: '2026-09-04T13:32:40Z',
    end_timestamp: '2026-09-04T13:33:05Z',
    latitude: 28.6146,
    longitude: 77.2088,
    depth: 16.3,
    anomaly_score: 0.51,
    confidence: 0.71,
    peak_strength: 4.2,
    mean_strength: 2.8,
    duration_seconds: 25,
    sample_count: 50,
    classification: 'WATCH',
    explanation: null,
    status: 'detected',
  },
  {
    id: 'evt-004',
    deployment_id: 'demo-deploy-001',
    timestamp: '2026-09-04T13:25:10Z',
    end_timestamp: '2026-09-04T13:25:30Z',
    latitude: 28.6132,
    longitude: 77.2098,
    depth: 14.8,
    anomaly_score: 0.44,
    confidence: 0.65,
    peak_strength: 3.1,
    mean_strength: 2.1,
    duration_seconds: 20,
    sample_count: 40,
    classification: 'WATCH',
    explanation: null,
    status: 'detected',
  },
];

export function DetectionAnalyticsPage() {
  const telemetry = useLiveStore((s) => s.telemetry);
  const [selectedTarget, setSelectedTarget] = useState<TargetCandidate | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Cascade chart data
  const cascadeData = useMemo(() => {
    const slice = telemetry.slice(-60);
    return slice.map((t, idx) => ({
      idx,
      time: new Date(t.timestamp).toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' }),
      raw: (t.magnetic_magnitude ?? 45) + (Math.sin(idx) * 0.3),
      calibrated: t.magnetic_magnitude ?? 45,
      baseline: t.magnetic_baseline ?? 45,
      residual: t.magnetic_deviation ?? 0,
      anomaly: (t.anomaly_score ?? 0) * 20,
    }));
  }, [telemetry]);

  const handleInspect = (evt: DetectionEvent) => {
    const lat = evt.latitude ?? 28.6139;
    const lon = evt.longitude ?? 77.2090;
    const depthVal = evt.depth ?? 15.0;
    setSelectedTarget({
      target_id: `TRG-${evt.id.slice(-3).toUpperCase()}`,
      latitude: lat,
      longitude: lon,
      observation_count: 12,
      peak_anomaly_score: evt.anomaly_score,
      mean_anomaly_score: evt.anomaly_score * 0.85,
      confidence: evt.confidence,
      spatial_extent_meters: 2.8,
      depth_range: [depthVal - 0.5, depthVal + 0.5],
      priority: evt.anomaly_score > 0.75 ? 'VERY_HIGH' : evt.anomaly_score > 0.5 ? 'HIGH' : 'MEDIUM',
      status: evt.status === 'confirmed' ? 'confirmed' : 'candidate',
    });
  };

  const filteredEvents = HISTORICAL_DETECTIONS.filter((evt) => {
    if (filterStatus === 'ALL') return true;
    return evt.classification === filterStatus;
  });

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Target size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              DETECTION PIPELINE & ANOMALY ANALYTICS
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              Signal processing cascade: Raw ADC → Hard/Soft Iron → Adaptive Baseline → Anomaly Deviation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => alert('Exporting Detection Log CSV...')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-medium)] text-xs text-[var(--text-secondary)] hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
          >
            <Download size={13} />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Signal Cascade Pipeline Diagram */}
      <div className="card p-3 shrink-0">
        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[var(--border-subtle)]">
          <Layers size={14} className="text-cyan-400" />
          <span className="section-header !border-b-0 !mb-0 !pb-0">Signal Processing Cascade</span>
        </div>

        <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
          <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block">STAGE 1</span>
            <span className="text-cyan-300 font-semibold block mt-0.5">Raw Magnetometer</span>
            <span className="text-[9px] text-[var(--text-muted)]">50Hz QMC5883L I2C</span>
          </div>
          <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block">STAGE 2</span>
            <span className="text-cyan-300 font-semibold block mt-0.5">Hard/Soft Iron</span>
            <span className="text-[9px] text-[var(--text-muted)]">Matrix Bias Correct</span>
          </div>
          <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block">STAGE 3</span>
            <span className="text-emerald-400 font-semibold block mt-0.5">Adaptive Baseline</span>
            <span className="text-[9px] text-[var(--text-muted)]">EMA Regional Drift</span>
          </div>
          <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block">STAGE 4</span>
            <span className="text-amber-400 font-semibold block mt-0.5">Magnetic Residual</span>
            <span className="text-[9px] text-[var(--text-muted)]">ΔB = ||B|| - B_base</span>
          </div>
          <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block">STAGE 5</span>
            <span className="text-rose-400 font-semibold block mt-0.5">ML Classification</span>
            <span className="text-[9px] text-[var(--text-muted)]">IsoForest + Confidence</span>
          </div>
        </div>
      </div>

      {/* Synchronized Cascade Waveform Chart */}
      <div className="flex-1 card flex flex-col p-3 min-h-[220px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-cyan-400" />
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Live Cascade Signal Streams
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-slate-400 rounded" /> RAW ADC
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-cyan-400 rounded" /> CALIBRATED
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-400 rounded" /> BASELINE
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-amber-400 rounded" /> RESIDUAL ΔB
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cascadeData} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#16223b" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#1a2540' }} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} unit="µT" />
              <Tooltip contentStyle={{ background: '#0d1527', border: '1px solid #243352', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <Line type="monotone" dataKey="raw" stroke="#64748b" strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="calibrated" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="baseline" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="residual" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Detection Log Table */}
      <div className="h-[220px] shrink-0 card flex flex-col p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Recorded Anomaly Events ({filteredEvents.length})
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {['ALL', 'CONFIRMED_EVENT', 'CANDIDATE', 'WATCH'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  filterStatus === status
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {status.replace('ANOMALY_', '')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-card)]">
              <tr>
                <th className="pb-2">Event ID</th>
                <th className="pb-2">Time (UTC)</th>
                <th className="pb-2">Classification</th>
                <th className="pb-2">Anomaly Score</th>
                <th className="pb-2">Confidence</th>
                <th className="pb-2">Peak Strength</th>
                <th className="pb-2">Depth</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="py-2 text-cyan-300 font-semibold">{evt.id}</td>
                  <td className="py-2 text-[var(--text-secondary)]">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2">
                    <StatusBadge status={(evt.classification ?? 'WATCH').toLowerCase()} size="sm" />
                  </td>
                  <td className="py-2 font-bold text-amber-400">
                    {(evt.anomaly_score * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 text-emerald-400">
                    {(evt.confidence * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 text-cyan-400">+{evt.peak_strength?.toFixed(1) ?? '—'} µT</td>
                  <td className="py-2 text-[var(--text-secondary)]">{evt.depth?.toFixed(1) ?? '—'} m</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleInspect(evt)}
                      className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] hover:bg-cyan-500/20 transition-colors"
                    >
                      Inspect Target
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Target Inspection Drawer */}
      <TargetDrawer
        target={selectedTarget}
        onClose={() => setSelectedTarget(null)}
      />
    </div>
  );
}
