/* ============================================================
   AquaYantra — Overview Dashboard
   Marine Research / Underwater Survey Command Center Hero
   ============================================================ */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Compass,
  Clock,
  BarChart3,
  Waves,
} from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { DetectionPanel } from '../components/DetectionPanel';
import { StatusBadge } from '../components/StatusBadge';
import { SeabedSonarMap } from '../components/SeabedSonarMap';
import { TargetDrawer } from '../components/TargetDrawer';
import { useLiveStore, useMissionStore, useMapStore } from '../stores';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

function getAnomalyStatus(score: number): 'normal' | 'watch' | 'anomaly' | 'fault' {
  if (score > 0.75) return 'anomaly';
  if (score > 0.45) return 'watch';
  return 'normal';
}

export function OverviewPage() {
  const latest = useLiveStore((s) => s.latestReading);
  const telemetry = useLiveStore((s) => s.telemetry);
  const mission = useMissionStore((s) => s.selectedMission);
  const selectedTarget = useMapStore((s) => s.selectedTarget);
  const setSelectedTarget = useMapStore((s) => s.setSelectedTarget);

  const [activeCenterView, setActiveCenterView] = useState<'map' | 'chart'>('map');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toUTCString().replace('GMT', 'UTC'));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Chart data: last 80 readings
  const chartData = useMemo(() => {
    const slice = telemetry.slice(-80);
    return slice.map((t, i) => ({
      idx: i,
      magnitude: t.magnetic_magnitude,
      baseline: t.magnetic_baseline,
      anomaly: t.anomaly_score,
      deviation: t.magnetic_deviation,
      depth: t.depth,
      time: new Date(t.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        minute: '2-digit',
        second: '2-digit',
      }),
    }));
  }, [telemetry]);

  const r = latest;

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0">
      {/* Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Compass size={20} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-wide">
                AQUAYANTRA COMMAND CENTER
              </h1>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-mono px-2 py-0.5 rounded border border-cyan-500/30 uppercase">
                SEABED RECON
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase font-mono">
              Autonomous Low-Cost Underwater Seabed Sensing & Anomaly Mapping Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Clock size={13} className="text-cyan-400" />
            <span>{currentTime || 'SYNCHRONIZING...'}</span>
          </div>

          <div className="h-4 w-px bg-[var(--border-subtle)]" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">MISSION STATUS:</span>
            {mission ? (
              <StatusBadge status={mission.status} size="sm" pulse={mission.status === 'active'} />
            ) : (
              <StatusBadge status="active" size="sm" pulse />
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Center Area: Map / Signal Chart + Intelligence Panel */}
      <div className="flex gap-3.5 flex-1 min-h-0">
        {/* Left / Center Major Display (Tactical Map + Signal Tab) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex-1 card flex flex-col p-3 min-w-0"
        >
          {/* View Mode Toggle Header */}
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[var(--border-subtle)] shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveCenterView('map')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeCenterView === 'map'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Waves size={13} />
                <span>Seabed Tactical Map</span>
              </button>
              <button
                onClick={() => setActiveCenterView('chart')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeCenterView === 'chart'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Activity size={13} />
                <span>Magnetic Waveform Cascade</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
              {activeCenterView === 'map' ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  LIVE BATHYMETRY & GPS FIX
                </span>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-cyan-400 rounded" /> Total Field µT
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-emerald-500/80 rounded" /> Baseline µT
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Display Container */}
          <div className="flex-1 min-h-0 relative">
            {activeCenterView === 'map' ? (
              <SeabedSonarMap
                className="h-full w-full"
                onSelectTarget={(target) => setSelectedTarget(target)}
              />
            ) : (
              <div className="h-full w-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 9, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={{ stroke: '#1a2540' }}
                        interval="preserveStartEnd"
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
                          background: '#141c2e',
                          border: '1px solid #243352',
                          borderRadius: 6,
                          fontSize: 11,
                          fontFamily: 'JetBrains Mono',
                        }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        name="Baseline"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="magnitude"
                        name="Magnitude"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Secondary Deviation Bar Chart in Waveform View */}
                <div className="h-20 border-t border-[var(--border-subtle)] pt-1 shrink-0">
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider block mb-0.5">
                    Magnetic Residual Deviation (ΔB = ||B|| - B_baseline)
                  </span>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 2, right: 12, bottom: 2, left: -8 }}>
                      <YAxis
                        tick={{ fontSize: 8, fill: '#475569' }}
                        tickLine={false}
                        axisLine={false}
                        domain={[-10, 20]}
                      />
                      <Line
                        type="monotone"
                        dataKey="deviation"
                        name="Deviation (µT)"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column: Intelligent Detection Panel + Anomaly Stream */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="w-[300px] shrink-0 flex flex-col gap-3 min-h-0"
        >
          {/* 6-State Detection Intelligence Card */}
          <DetectionPanel
            status={r?.detection_status || 'BACKGROUND'}
            anomalyScore={r?.anomaly_score || 0}
            confidence={r?.confidence || 0}
            peakStrength={r?.magnetic_deviation}
            depth={r?.depth}
          />

          {/* Anomaly Score Stream & Feature Indicators */}
          <div className="card flex-1 flex flex-col p-3 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BarChart3 size={13} className="text-amber-400" />
                <span className="telemetry-label !text-[10px]">Anomaly Probability</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-amber-400">
                {((r?.anomaly_score ?? 0) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -26 }}>
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fontSize: 8, fill: '#475569' }}
                    tickLine={false}
                    axisLine={false}
                    ticks={[0, 0.5, 1]}
                  />
                  <Line
                    type="monotone"
                    dataKey="anomaly"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Scientific Diagnostics Footer */}
            <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] space-y-1.5 text-[10px] font-mono text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Sensor Payload:</span>
                <span className="text-cyan-300">QMC5883L / SEN0189</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Sampling Frequency:</span>
                <span>50.0 Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">ML Model:</span>
                <span className="text-emerald-400">Ensemble IsoForest v2.4</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Telemetry Strip (8-Metric Grid) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="grid grid-cols-4 xl:grid-cols-8 gap-2.5 shrink-0"
      >
        <MetricCard
          label="Depth"
          value={r?.depth?.toFixed(1) ?? '15.4'}
          unit="m"
          accent="cyan"
          size="sm"
          subtitle="Hydrostatic"
        />
        <MetricCard
          label="Magnetic Field"
          value={r?.magnetic_magnitude?.toFixed(1) ?? '45.2'}
          unit="µT"
          accent="cyan"
          size="sm"
          subtitle={`Base ${r?.magnetic_baseline?.toFixed(1) ?? '45.0'} µT`}
        />
        <MetricCard
          label="Deviation"
          value={r?.magnetic_deviation?.toFixed(2) ?? '0.18'}
          unit="µT"
          accent={
            Math.abs(r?.magnetic_deviation ?? 0) > 5
              ? 'amber'
              : Math.abs(r?.magnetic_deviation ?? 0) > 2
              ? 'amber'
              : 'default'
          }
          size="sm"
        />
        <MetricCard
          label="Anomaly Score"
          value={r?.anomaly_score?.toFixed(3) ?? '0.042'}
          status={getAnomalyStatus(r?.anomaly_score ?? 0)}
          accent={r?.anomaly_score && r.anomaly_score > 0.45 ? 'amber' : 'default'}
          size="sm"
        />
        <MetricCard
          label="Confidence"
          value={r?.confidence?.toFixed(3) ?? '0.940'}
          accent={(r?.confidence ?? 0.9) > 0.8 ? 'green' : 'default'}
          size="sm"
        />
        <MetricCard
          label="Turbidity"
          value={r?.turbidity?.toFixed(0) ?? '4.8'}
          unit="NTU"
          accent="default"
          size="sm"
          subtitle="Optical"
        />
        <MetricCard
          label="Battery"
          value={r?.battery_percent ?? 98}
          unit="%"
          accent={(r?.battery_percent ?? 100) < 20 ? 'red' : 'green'}
          status={(r?.battery_percent ?? 100) < 10 ? 'fault' : 'normal'}
          size="sm"
          subtitle={`${r?.battery_voltage?.toFixed(1) ?? '12.4'} V`}
        />
        <MetricCard
          label="Data Quality"
          value={r?.data_quality != null ? (r.data_quality * 100).toFixed(0) : '97'}
          unit="%"
          accent={
            (r?.data_quality ?? 1) < 0.5
              ? 'red'
              : (r?.data_quality ?? 1) < 0.8
              ? 'amber'
              : 'green'
          }
          size="sm"
        />
      </motion.div>

      {/* Target Candidate Drawer Modal */}
      <TargetDrawer
        target={selectedTarget}
        onClose={() => setSelectedTarget(null)}
      />
    </div>
  );
}
