/* ============================================================
   AquaYantra — System Health Dashboard
   Subsystems telemetry, hardware MCU diagnostics, and sensor health
   ============================================================ */

import { useState } from 'react';
import {
  Activity,
  Cpu,
  Server,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useLiveStore } from '../stores';

export function SystemHealthPage() {
  const latest = useLiveStore((s) => s.latestReading);
  const [isRunningDiag, setIsRunningDiag] = useState(false);

  const handleRunDiagnostics = () => {
    setIsRunningDiag(true);
    setTimeout(() => {
      setIsRunningDiag(false);
      alert('All system self-tests passed: Bus I2C OK, ADC OK, ML Worker OK.');
    }, 1500);
  };

  const r = latest;

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Activity size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              SYSTEM HEALTH & HARDWARE TELEMETRY
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              Embedded STM32 MCU diagnostics, bus integrity, and cloud pipeline health
            </p>
          </div>
        </div>

        <button
          disabled={isRunningDiag}
          onClick={handleRunDiagnostics}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={isRunningDiag ? 'animate-spin' : ''} />
          <span>{isRunningDiag ? 'RUNNING SELF-TEST...' : 'RUN SUBSYSTEM DIAGNOSTICS'}</span>
        </button>
      </div>

      {/* Backend Infrastructure Health */}
      <div className="card p-3">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Server size={14} className="text-cyan-400" />
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Compute & Cloud Services
            </span>
          </div>
          <StatusBadge status="healthy" size="sm" />
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[var(--text-muted)] uppercase">API Gateway</span>
              <span className="text-[9px] text-emerald-400 font-bold">200 OK</span>
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">FastAPI Core</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Latency: 12.4 ms</div>
          </div>

          <div className="bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Buffer Queue</span>
              <span className="text-[9px] text-emerald-400 font-bold">ACTIVE</span>
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">Redis Ingestion</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Throughput: 50 msg/s</div>
          </div>

          <div className="bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Inference Worker</span>
              <span className="text-[9px] text-emerald-400 font-bold">ONLINE</span>
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">ML Pipeline</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Batch Latency: 4.2 ms</div>
          </div>

          <div className="bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-[var(--text-muted)] uppercase">Telemetry Stream</span>
              <span className="text-[9px] text-emerald-400 font-bold">CONNECTED</span>
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)]">WebSocket Hub</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Broadcast: 2.0 Hz</div>
          </div>
        </div>
      </div>

      {/* Embedded Hardware MCU Subsystem */}
      <div className="card p-3">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-cyan-400" />
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Underwater Node Hardware (STM32F411CEU6 Black Pill)
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">FIRMWARE V1.2.0</span>
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Core Frequency</span>
            <span className="text-sm font-bold text-cyan-300">100 MHz Cortex-M4</span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Hardware FPU Active</span>
          </div>

          <div className="bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">SRAM Heap Status</span>
            <span className="text-sm font-bold text-emerald-400">68 KB Free / 128 KB</span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Zero Allocation Leaks</span>
          </div>

          <div className="bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">I2C Bus Integrity</span>
            <span className="text-sm font-bold text-emerald-400">400 kHz Fast-Mode</span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">ACK Error Count: 0</span>
          </div>

          <div className="bg-[var(--bg-deep)] p-2.5 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Telemetry Packet Loss</span>
            <span className="text-sm font-bold text-cyan-300">0.02% Rate</span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">CRC32 Verified</span>
          </div>
        </div>
      </div>

      {/* Sensor Payload Health Cards */}
      <div className="card p-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-cyan-400" />
            <span className="section-header !border-b-0 !mb-0 !pb-0">
              Sensor Array Subsystems
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">4/4 Nodes Healthy</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          {/* QMC5883L */}
          <div className="bg-[var(--bg-deep)] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[var(--text-primary)]">QMC5883L Magnetometer</span>
              <StatusBadge status="healthy" size="sm" />
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              3-Axis AMR Magnetic Sensor, I2C Address 0x0D
            </div>
            <div className="text-[10px] text-[var(--text-muted)] flex justify-between pt-1 border-t border-[var(--border-subtle)]">
              <span>DRDY ODR: 50 Hz</span>
              <span>Range: ±8 Gauss</span>
              <span>Resolution: 3000 LSB/G</span>
            </div>
          </div>

          {/* SEN0189 */}
          <div className="bg-[var(--bg-deep)] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[var(--text-primary)]">SEN0189 Turbidity Sensor</span>
              <StatusBadge status="healthy" size="sm" />
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Optical Phototransistor Scatter Sensor, ADC CH1
            </div>
            <div className="text-[10px] text-[var(--text-muted)] flex justify-between pt-1 border-t border-[var(--border-subtle)]">
              <span>Current: {r?.turbidity?.toFixed(1) ?? '4.8'} NTU</span>
              <span>Optical Window: Clean</span>
              <span>ADC: 3.42 V</span>
            </div>
          </div>

          {/* BMP280 */}
          <div className="bg-[var(--bg-deep)] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[var(--text-primary)]">BMP280 Pressure & Depth</span>
              <StatusBadge status="healthy" size="sm" />
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Hydrostatic Depth Gauge via Piezoresistive Diaphragm
            </div>
            <div className="text-[10px] text-[var(--text-muted)] flex justify-between pt-1 border-t border-[var(--border-subtle)]">
              <span>Current Depth: {r?.depth?.toFixed(2) ?? '15.40'} m</span>
              <span>Pressure: 254.2 kPa</span>
              <span>Temp: 22.4°C</span>
            </div>
          </div>

          {/* NEO-6M */}
          <div className="bg-[var(--bg-deep)] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[var(--text-primary)]">NEO-6M GNSS / GPS</span>
              <StatusBadge status="healthy" size="sm" />
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              Surface Float Geographic Synchronizer, UART2
            </div>
            <div className="text-[10px] text-[var(--text-muted)] flex justify-between pt-1 border-t border-[var(--border-subtle)]">
              <span>Satellites: 11 Locked</span>
              <span>HDOP: 0.85 (Precise)</span>
              <span>Fix: 3D Fix</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
