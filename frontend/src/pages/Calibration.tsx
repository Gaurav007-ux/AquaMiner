/* ============================================================
   AquaYantra — Calibration Dashboard
   Magnetometer hard/soft-iron matrix calibration, 7-state lifecycle,
   adaptive baseline tracker, and interactive calibration routine triggers
   ============================================================ */

import { useState } from 'react';
import {
  Activity,
  Beaker,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useLiveStore } from '../stores';

export function CalibrationPage() {
  const calibration = useLiveStore((s) => s.calibrationStatus);
  const setCalibration = useLiveStore((s) => s.setCalibration);

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calProgress, setCalProgress] = useState(0);

  // Trigger simulated Figure-8 Calibration Routine
  const handleStartCalibration = () => {
    setIsCalibrating(true);
    setCalProgress(0);

    const interval = setInterval(() => {
      setCalProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsCalibrating(false);
          setCalibration({
            device_id: 'AQUAYANTRA-SIM-001',
            status: 'calibrated',
            calibration_quality: 0.96,
            baseline: 45.8,
            noise_level: 0.32,
            sample_count: 2400,
            hard_iron_offset: [0.28, -0.12, 0.19],
            message: 'Figure-8 routine completed. Offsets updated.',
          });
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  const handleTareBaseline = () => {
    if (calibration) {
      setCalibration({
        ...calibration,
        baseline: 45.2,
        message: 'Baseline retared to current regional field.',
      });
    }
  };

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Beaker size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              MAGNETOMETER CALIBRATION & BASELINE DRIFT ENGINE
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              QMC5883L 3-Axis Hard-Iron & Soft-Iron Ellipsoid Correction + Dynamic Baseline Estimator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={calibration?.status || 'calibrated'} size="md" pulse={isCalibrating} />
        </div>
      </div>

      {/* Calibration Lifecycle & Active Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 font-mono">
          <span className="telemetry-label">Calibration State</span>
          <div className="text-sm font-bold text-cyan-300 mt-1 uppercase">
            {calibration?.status || 'CALIBRATED'}
          </div>
          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
            Quality Score: {((calibration?.calibration_quality ?? 0.92) * 100).toFixed(1)}%
          </span>
        </div>

        <div className="card p-3 font-mono">
          <span className="telemetry-label">Regional Baseline (B0)</span>
          <div className="text-base font-bold text-emerald-400 mt-1">
            {calibration?.baseline?.toFixed(2) ?? '45.00'} µT
          </div>
          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
            Earth field at survey lat/lon
          </span>
        </div>

        <div className="card p-3 font-mono">
          <span className="telemetry-label">Residual Noise (1σ)</span>
          <div className="text-base font-bold text-cyan-400 mt-1">
            {calibration?.noise_level?.toFixed(3) ?? '0.412'} µT
          </div>
          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
            Gaussian sensor noise floor
          </span>
        </div>

        <div className="card p-3 font-mono">
          <span className="telemetry-label">Fitting Samples</span>
          <div className="text-base font-bold text-[var(--text-primary)] mt-1">
            {calibration?.sample_count ?? 1240}
          </div>
          <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
            Sphere regression points
          </span>
        </div>
      </div>

      {/* Interactive Calibration Actions Bar */}
      <div className="card p-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">
            Sensor Calibration & Bias Alignment Operations
          </h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            Perform in-situ rotation maneuvers to eliminate underwater vehicle ferromagnetic interference.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={isCalibrating}
            onClick={handleStartCalibration}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={isCalibrating ? 'animate-spin' : ''} />
            <span>{isCalibrating ? `CALIBRATING (${calProgress}%)` : 'RUN FIGURE-8 CALIBRATION'}</span>
          </button>

          <button
            onClick={handleTareBaseline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-medium)] text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            <RotateCcw size={13} />
            <span>TARE BASELINE</span>
          </button>
        </div>
      </div>

      {/* Hard-Iron & Soft-Iron Correction Matrices */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Hard Iron Bias Offsets */}
        <div className="card p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Hard-Iron Magnetic Offsets (Vector V)
            </span>
            <span className="text-[10px] font-mono text-cyan-400">UNBIASED</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-3 leading-relaxed">
            Constant magnetic fields produced by onboard ferromagnetic chassis elements, battery casing, and thruster brackets. Subtracted directly from raw vector.
          </p>

          <div className="grid grid-cols-3 gap-2 font-mono text-center">
            <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Vx (Offset)</span>
              <span className="text-sm font-semibold text-cyan-300">
                {calibration?.hard_iron_offset?.[0]?.toFixed(3) ?? '+0.280'} µT
              </span>
            </div>
            <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Vy (Offset)</span>
              <span className="text-sm font-semibold text-cyan-300">
                {calibration?.hard_iron_offset?.[1]?.toFixed(3) ?? '-0.120'} µT
              </span>
            </div>
            <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Vz (Offset)</span>
              <span className="text-sm font-semibold text-cyan-300">
                {calibration?.hard_iron_offset?.[2]?.toFixed(3) ?? '+0.190'} µT
              </span>
            </div>
          </div>
        </div>

        {/* Soft Iron Correction Matrix */}
        <div className="card p-3">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Soft-Iron 3×3 Orthogonal Matrix (W)
            </span>
            <span className="text-[10px] font-mono text-emerald-400">ORTHONORMALIZED</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-2 leading-relaxed">
            Distortion of ambient geomagnetic field by permeable materials. Corrects sphere ellipticity and axis non-orthogonality.
          </p>

          <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)] font-mono text-xs">
            <div className="grid grid-cols-3 gap-1 text-center text-cyan-300">
              <div className="bg-[var(--bg-card)] p-1 rounded">1.024</div>
              <div className="bg-[var(--bg-card)] p-1 rounded">-0.012</div>
              <div className="bg-[var(--bg-card)] p-1 rounded">0.005</div>
              <div className="bg-[var(--bg-card)] p-1 rounded">-0.012</div>
              <div className="bg-[var(--bg-card)] p-1 rounded">0.985</div>
              <div className="bg-[var(--bg-card)] p-1 rounded">0.008</div>
              <div className="bg-[var(--bg-card)] p-1 rounded">0.005</div>
              <div className="bg-[var(--bg-card)] p-1 rounded">0.008</div>
              <div className="bg-[var(--bg-card)] p-1 rounded">1.011</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2D/3D Sphere Projection Visualization */}
      <div className="card p-3 flex-1 min-h-[220px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-cyan-400" />
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Magnetometer Ellipsoid vs Corrected Spherical Manifold
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full border border-rose-400/80"></span> Raw Uncalibrated Ellipsoid
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400/40 border border-cyan-400"></span> Calibrated Sphere (|B| = B0)
            </span>
          </div>
        </div>

        <div className="h-[180px] w-full flex items-center justify-center relative bg-[var(--bg-deep)] rounded border border-[var(--border-subtle)]">
          <svg viewBox="0 0 400 160" className="h-full w-auto">
            {/* Center axes */}
            <line x1="200" y1="10" x2="200" y2="150" stroke="#1c2b48" strokeDasharray="3 3" />
            <line x1="20" y1="80" x2="380" y2="80" stroke="#1c2b48" strokeDasharray="3 3" />

            {/* Raw uncalibrated distorted ellipse (shifted and stretched) */}
            <ellipse cx="215" cy="72" rx="72" ry="54" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6" />
            
            {/* Calibrated perfect sphere */}
            <circle cx="200" cy="80" r="60" fill="#0891b2" fillOpacity="0.08" stroke="#22d3ee" strokeWidth="2" />
            
            {/* Center point */}
            <circle cx="200" cy="80" r="2.5" fill="#22d3ee" />
            <circle cx="215" cy="72" r="2" fill="#f43f5e" />

            {/* Offset arrow */}
            <line x1="200" y1="80" x2="215" y2="72" stroke="#fbbf24" strokeWidth="1" />
            <text x="220" y="68" fill="#fbbf24" fontSize="8" fontFamily="JetBrains Mono">Bias Offset (V)</text>
          </svg>
        </div>
      </div>
    </div>
  );
}
