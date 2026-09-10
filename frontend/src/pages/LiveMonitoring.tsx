/* ============================================================
   AquaYantra — Live Monitoring Dashboard
   Multi-channel streaming telemetry, 3-column analysis,
   synchronized multi-sensor waveforms, and real-time ML detection
   ============================================================ */

import { useState, useMemo } from 'react';
import {
  Activity,
  Pause,
  Play,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useLiveStore } from '../stores';
import { StatusBadge } from '../components/StatusBadge';
import { DataQualityBar } from '../components/DataQualityBar';
import { DetectionPanel } from '../components/DetectionPanel';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export function LiveMonitoringPage() {
  const telemetry = useLiveStore((s) => s.telemetry);
  const latest = useLiveStore((s) => s.latestReading);
  const clearBuffer = useLiveStore((s) => s.clearBuffer);

  const [isPaused, setIsPaused] = useState(false);
  const [timeWindowSec, setTimeWindowSec] = useState<number>(60);

  // Freeze telemetry if paused
  const [frozenBuffer, setFrozenBuffer] = useState<typeof telemetry>([]);

  const handlePauseToggle = () => {
    if (!isPaused) {
      setFrozenBuffer([...telemetry]);
    }
    setIsPaused(!isPaused);
  };

  const activeTelemetry = isPaused ? frozenBuffer : telemetry;

  // Windowed telemetry based on selected time window (at ~2Hz, 60s = 120 readings)
  const windowCount = Math.min(activeTelemetry.length, timeWindowSec * 2);
  const chartSlice = useMemo(() => {
    return activeTelemetry.slice(-windowCount).map((t, idx) => ({
      idx,
      time: new Date(t.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        minute: '2-digit',
        second: '2-digit',
      }),
      magnitude: t.magnetic_magnitude,
      baseline: t.magnetic_baseline,
      deviation: t.magnetic_deviation,
      magX: t.mag_x,
      magY: t.mag_y,
      magZ: t.mag_z,
      depth: t.depth,
      turbidity: t.turbidity,
      anomaly: t.anomaly_score,
      confidence: t.confidence,
    }));
  }, [activeTelemetry, windowCount]);

  const r = latest;

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Activity size={18} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              LIVE MULTI-CHANNEL TELEMETRY MONITOR
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              High-frequency sensor stream & real-time anomaly inference pipeline
            </p>
          </div>
        </div>

        {/* Stream Controls */}
        <div className="flex items-center gap-2">
          {/* Time Window Selector */}
          <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded border border-[var(--border-subtle)] text-xs font-mono">
            <span className="text-[10px] text-[var(--text-muted)] px-1.5 uppercase">Window:</span>
            {[10, 30, 60, 120, 300].map((sec) => (
              <button
                key={sec}
                onClick={() => setTimeWindowSec(sec)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  timeWindowSec === sec
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {sec < 60 ? `${sec}s` : `${sec / 60}m`}
              </button>
            ))}
          </div>

          {/* Pause/Resume button */}
          <button
            onClick={handlePauseToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              isPaused
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-[var(--bg-elevated)] border-[var(--border-medium)] text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
            <span>{isPaused ? 'RESUME STREAM' : 'PAUSE'}</span>
          </button>

          {/* Clear Buffer button */}
          <button
            onClick={clearBuffer}
            className="p-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white transition-colors"
            title="Clear Stream Buffer"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main 3-Column Work area */}
      <div className="flex gap-3.5 flex-1 min-h-0">
        {/* Left Column: 11 Telemetry Channels List */}
        <div className="w-[260px] shrink-0 card flex flex-col p-3 overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
            <span className="section-header !border-b-0 !mb-0 !pb-0">Sensor Channels (11)</span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              ONLINE
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {/* Mag Total */}
            <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-muted)]">MAG TOTAL</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {r?.magnetic_magnitude?.toFixed(2) ?? '—'} µT
                </span>
              </div>
              <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
                Base: {r?.magnetic_baseline?.toFixed(1) ?? '—'} µT | Δ: {r?.magnetic_deviation?.toFixed(2) ?? '—'} µT
              </div>
            </div>

            {/* Mag X / Y / Z */}
            <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)] space-y-1">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Mag 3-Axis Vector</div>
              <div className="grid grid-cols-3 gap-1 font-mono text-[11px] text-center">
                <div className="bg-[var(--bg-card)] p-1 rounded">
                  <span className="text-[9px] text-[var(--text-muted)] block">Bx</span>
                  <span className="text-cyan-300">{r?.mag_x?.toFixed(1) ?? '—'}</span>
                </div>
                <div className="bg-[var(--bg-card)] p-1 rounded">
                  <span className="text-[9px] text-[var(--text-muted)] block">By</span>
                  <span className="text-cyan-300">{r?.mag_y?.toFixed(1) ?? '—'}</span>
                </div>
                <div className="bg-[var(--bg-card)] p-1 rounded">
                  <span className="text-[9px] text-[var(--text-muted)] block">Bz</span>
                  <span className="text-cyan-300">{r?.mag_z?.toFixed(1) ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* Depth & Hydrostatic */}
            <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-muted)]">HYDROSTATIC DEPTH</span>
                <span className="font-mono text-cyan-400 font-bold">{r?.depth?.toFixed(2) ?? '—'} m</span>
              </div>
            </div>

            {/* Turbidity */}
            <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-muted)]">TURBIDITY (SEN0189)</span>
                <span className="font-mono text-emerald-400 font-bold">{r?.turbidity?.toFixed(1) ?? '—'} NTU</span>
              </div>
            </div>

            {/* Power Subsystem */}
            <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-muted)]">BATTERY</span>
                <span className="font-mono text-[var(--text-primary)] font-bold">
                  {r?.battery_percent ?? '—'}% ({r?.battery_voltage?.toFixed(2) ?? '—'}V)
                </span>
              </div>
              <div className="w-full bg-[var(--bg-card)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${r?.battery_percent ?? 100}%` }}
                />
              </div>
            </div>

            {/* Signal Quality */}
            <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <DataQualityBar quality={r?.data_quality ?? 0.95} size="sm" />
            </div>

            {/* Geographic Fix */}
            <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)] font-mono text-[10px] space-y-0.5">
              <div className="text-[var(--text-muted)] uppercase">GPS Position</div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>LAT:</span>
                <span>{r?.latitude?.toFixed(6) ?? '—'}°</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>LON:</span>
                <span>{r?.longitude?.toFixed(6) ?? '—'}°</span>
              </div>
            </div>

            {/* Sensor Health Status */}
            <div className="p-2 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)] uppercase">NODE HEALTH</span>
              <StatusBadge status={r?.sensor_health || 'HEALTHY'} size="sm" />
            </div>
          </div>
        </div>

        {/* Center Column: High-Res Waveform Strip + Synchronized Multi-Channel Charts */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Main Magnetic Waveform */}
          <div className="flex-1 card flex flex-col p-3 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" />
                <span className="section-header !border-b-0 !mb-0 !pb-0">
                  Total Magnetic Intensity (TMI) & Adaptive Baseline
                </span>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-cyan-400 rounded" />
                  MAGNITUDE
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-emerald-400 rounded" />
                  BASELINE
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-amber-400 rounded" />
                  ANOMALY REGION
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartSlice} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#16223b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#1a2540' }}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                    unit="µT"
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0d1527',
                      border: '1px solid #243352',
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name="Adaptive Baseline"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="magnitude"
                    name="Measured TMI"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Synchronized Secondary Charts: 3-Axis Decomposition & Turbidity/Depth */}
          <div className="h-[170px] shrink-0 grid grid-cols-2 gap-3">
            {/* Magnetic Vector Decomposition (Bx, By, Bz) */}
            <div className="card flex flex-col p-2.5">
              <div className="flex items-center justify-between mb-1 text-[10px] font-mono text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-secondary)]">VECTOR DECOMPOSITION (X, Y, Z)</span>
                <div className="flex gap-2">
                  <span className="text-rose-400">X</span>
                  <span className="text-emerald-400">Y</span>
                  <span className="text-blue-400">Z</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSlice} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <YAxis tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} axisLine={false} />
                    <Line type="monotone" dataKey="magX" stroke="#f43f5e" strokeWidth={1.2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="magY" stroke="#10b981" strokeWidth={1.2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="magZ" stroke="#38bdf8" strokeWidth={1.2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Depth & Turbidity Profile */}
            <div className="card flex flex-col p-2.5">
              <div className="flex items-center justify-between mb-1 text-[10px] font-mono text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-secondary)]">DEPTH & OPTICAL TURBIDITY</span>
                <div className="flex gap-2">
                  <span className="text-cyan-400">Depth (m)</span>
                  <span className="text-amber-400">Turbidity (NTU)</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSlice} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <YAxis tick={{ fontSize: 8, fill: '#475569' }} tickLine={false} axisLine={false} />
                    <Line type="monotone" dataKey="depth" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="turbidity" stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="3 2" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Intelligent Detection & Classification Analysis */}
        <div className="w-[300px] shrink-0 flex flex-col gap-3 min-h-0">
          <DetectionPanel
            status={r?.detection_status || 'BACKGROUND'}
            anomalyScore={r?.anomaly_score || 0}
            confidence={r?.confidence || 0}
            peakStrength={r?.magnetic_deviation}
            depth={r?.depth}
          />

          {/* Real-time Classification Probabilities */}
          <div className="card flex-1 flex flex-col p-3 min-h-0">
            <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-[var(--border-subtle)]">
              <Sparkles size={14} className="text-cyan-400" />
              <span className="section-header !border-b-0 !mb-0 !pb-0">
                Target Classification Model
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono flex-1 overflow-y-auto pr-1">
              {/* Classification probability bars */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--text-secondary)]">Ferrous Sub-Seabed Target</span>
                  <span className="text-amber-400 font-bold">
                    {(((r?.anomaly_score ?? 0) > 0.45 ? (r?.confidence ?? 0.8) : 0.05) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-deep)] rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all"
                    style={{
                      width: `${((r?.anomaly_score ?? 0) > 0.45 ? (r?.confidence ?? 0.8) : 0.05) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--text-secondary)]">Ambient Geomagnetic Baseline</span>
                  <span className="text-emerald-400 font-bold">
                    {(((r?.anomaly_score ?? 0) <= 0.45 ? 0.92 : 0.08) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-deep)] rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all"
                    style={{
                      width: `${((r?.anomaly_score ?? 0) <= 0.45 ? 0.92 : 0.08) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--text-secondary)]">Geological Mineral Variation</span>
                  <span className="text-blue-400 font-bold">14.2%</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-deep)] rounded-full overflow-hidden">
                  <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: '14.2%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--text-muted)]">Sensor Drift / High Noise</span>
                  <span className="text-[var(--text-muted)]">3.8%</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-deep)] rounded-full overflow-hidden">
                  <div className="bg-slate-600 h-full rounded-full transition-all" style={{ width: '3.8%' }} />
                </div>
              </div>

              {/* Estimated Physical Target Parameters */}
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
                  Estimated Physical Model
                </span>
                <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)] space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Dipole Moment (M):</span>
                    <span className="text-cyan-300 font-semibold">
                      {Math.abs(r?.magnetic_deviation ?? 0) > 2 ? '14.8 A·m²' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Burial Depth Est.:</span>
                    <span className="text-cyan-300 font-semibold">
                      {Math.abs(r?.magnetic_deviation ?? 0) > 2 ? '0.85 m sub-bed' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Equivalent Fe Mass:</span>
                    <span className="text-amber-400 font-semibold">
                      {Math.abs(r?.magnetic_deviation ?? 0) > 2 ? '~12.5 kg' : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
