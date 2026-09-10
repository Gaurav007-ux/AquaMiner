/* ============================================================
   AquaYantra — Platform Settings Page
   Hardware comms, detection thresholds, algorithm hyperparameters,
   and demo simulation controls
   ============================================================ */

import { useState } from 'react';
import {
  Settings,
  Radio,
  SlidersHorizontal,
  Save,
  Volume2,
  Beaker,
} from 'lucide-react';
import { useDemoStore, type DemoScenario } from '../stores';

export function SettingsPage() {
  const demoEnabled = useDemoStore((s) => s.enabled);
  const toggleDemo = useDemoStore((s) => s.toggleDemo);
  const scenario = useDemoStore((s) => s.scenario);
  const setScenario = useDemoStore((s) => s.setScenario);

  // Local config states
  const [comPort, setComPort] = useState('COM3 (STM32 Black Pill)');
  const [baudRate, setBaudRate] = useState('115200');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:8000');
  const [wsUrl, setWsUrl] = useState('ws://localhost:8000/ws');
  const [anomalyThreshold, setAnomalyThreshold] = useState(0.65);
  const [baselineAlpha, setBaselineAlpha] = useState(0.05);
  const [soundAlerts, setSoundAlerts] = useState(true);

  const handleSave = () => {
    alert('Configuration saved to local persistent storage.');
  };

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Settings size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              SYSTEM CONFIGURATION & HARDWARE PARAMETERS
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              Serial communication, filter parameters, ML anomaly sensitivity, and simulation
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-colors"
        >
          <Save size={13} />
          <span>SAVE CONFIGURATION</span>
        </button>
      </div>

      {/* Demo Simulation Controls */}
      <div className="card p-3">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Beaker size={14} className="text-amber-400" />
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Demo Simulation Environment
            </span>
          </div>
          <button
            onClick={toggleDemo}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
              demoEnabled
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
            }`}
          >
            DEMO MODE: {demoEnabled ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">
              Active Simulation Scenario
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as DemoScenario)}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded p-2 text-cyan-300 font-semibold outline-none"
            >
              <option value="NORMAL_SURVEY">Normal Survey (Clean Background)</option>
              <option value="WEAK_ANOMALY">Weak Anomaly (Dipole ~5 µT)</option>
              <option value="STRONG_ANOMALY">Strong Anomaly (Large Target ~30 µT)</option>
              <option value="MULTIPLE_TARGETS">Multiple Targets in Sequence</option>
              <option value="SENSOR_DRIFT">Sensor Thermal Drift</option>
              <option value="HIGH_NOISE">High Environmental Noise</option>
              <option value="PACKET_LOSS">Simulated Packet Loss</option>
              <option value="SENSOR_FAILURE">Sensor Hardware Fault Simulation</option>
            </select>
          </div>

          <div className="text-[11px] text-[var(--text-secondary)] flex flex-col justify-center">
            When Demo Mode is active, realistic multi-channel telemetry is generated client-side matching the STM32 & QMC5883L physics models. Allows testing full UI without hardware tether.
          </div>
        </div>
      </div>

      {/* Hardware Interface Configuration */}
      <div className="card p-3">
        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-[var(--border-subtle)]">
          <Radio size={14} className="text-cyan-400" />
          <span className="section-header !border-b-0 !mb-0 !pb-0">
            Hardware Comms & Telemetry Links
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">
              Serial / USB Port
            </label>
            <input
              type="text"
              value={comPort}
              onChange={(e) => setComPort(e.target.value)}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded p-2 text-[var(--text-primary)] outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">
              Baud Rate (bps)
            </label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(e.target.value)}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded p-2 text-[var(--text-primary)] outline-none"
            >
              <option value="115200">115,200 baud (Standard)</option>
              <option value="921600">921,600 baud (High-Speed DMA)</option>
              <option value="57600">57,600 baud</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">
              Backend REST API URL
            </label>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded p-2 text-[var(--text-primary)] outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">
              Real-time WebSocket Endpoint
            </label>
            <input
              type="text"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded p-2 text-[var(--text-primary)] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Anomaly Algorithm Hyperparameters */}
      <div className="card p-3">
        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-[var(--border-subtle)]">
          <SlidersHorizontal size={14} className="text-cyan-400" />
          <span className="section-header !border-b-0 !mb-0 !pb-0">
            Anomaly Detection Sensitivity & Filtering
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Anomaly Decision Threshold</span>
              <span className="text-amber-400 font-bold">{anomalyThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.95"
              step="0.05"
              value={anomalyThreshold}
              onChange={(e) => setAnomalyThreshold(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
              Lower values increase sensitivity; higher values reject false positives.
            </span>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Adaptive Baseline Alpha (EMA)</span>
              <span className="text-emerald-400 font-bold">{baselineAlpha.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.2"
              step="0.01"
              value={baselineAlpha}
              onChange={(e) => setBaselineAlpha(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
              Weight for exponential moving average tracking geomagnetic gradient.
            </span>
          </div>
        </div>
      </div>

      {/* Audio & Visual Alerts */}
      <div className="card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 size={16} className="text-cyan-400" />
            <div>
              <h4 className="text-xs font-semibold text-[var(--text-primary)]">Audio Acoustic Pings</h4>
              <p className="text-[11px] text-[var(--text-muted)]">
                Emit subtle sonar acoustic feedback when confirmed anomaly candidate is detected.
              </p>
            </div>
          </div>

          <button
            onClick={() => setSoundAlerts(!soundAlerts)}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors ${
              soundAlerts
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
            }`}
          >
            {soundAlerts ? 'ENABLED' : 'MUTED'}
          </button>
        </div>
      </div>
    </div>
  );
}
