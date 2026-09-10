/* ============================================================
   AquaYantra — TopBar
   Mission selector, connection status, calibration, notifications
   ============================================================ */

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Bell, User, Beaker, ChevronDown, Radio, Compass, Cable } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useDeviceStore, useMissionStore, useDemoStore, useLiveStore } from '../stores';
import { webSerial } from '../api/web_serial';

export function TopBar() {
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const mission = useMissionStore((s) => s.selectedMission);
  const deployment = useMissionStore((s) => s.selectedDeployment);
  const demoEnabled = useDemoStore((s) => s.enabled);
  const mode = useDemoStore((s) => s.mode);
  const setMode = useDemoStore((s) => s.setMode);
  const scenario = useDemoStore((s) => s.scenario);
  const setScenario = useDemoStore((s) => s.setScenario);
  const calibration = useLiveStore((s) => s.calibrationStatus);
  const latestReading = useLiveStore((s) => s.latestReading);

  const [comConnected, setComConnected] = useState(webSerial.isConnected);

  useEffect(() => {
    return webSerial.onStatus((connected) => {
      setComConnected(connected);
    });
  }, []);


  const isConnected = connectionStatus === 'connected';

  return (
    <header className="h-[52px] flex items-center justify-between px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] z-30 shrink-0">
      {/* Left: Mission info & Mode Switcher */}
      <div className="flex items-center gap-3">
        {/* Mission */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Mission</span>
          <span className="text-sm font-medium text-[var(--text-primary)] max-w-[200px] truncate">
            {mission?.name || 'AquaYantra Field Survey'}
          </span>
          {mission && <StatusBadge status={mission.status} />}
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-[var(--border-subtle)]" />

        {/* Deployment */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Deploy</span>
          <span className="text-sm text-[var(--text-secondary)]">
            {deployment ? `#${deployment.deployment_number}` : '#01'}
          </span>
          {deployment && <StatusBadge status={deployment.status} />}
        </div>

        {/* Real Mode vs Simulation Mode Switcher */}
        <div className="h-5 w-px bg-[var(--border-subtle)]" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'REAL' ? 'SIMULATION' : 'REAL')}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-bold tracking-wider transition-all border cursor-pointer",
              mode === 'REAL'
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                : "bg-amber-500/15 border-amber-500/40 text-amber-400"
            )}
            title="Switch between Real Hardware Mode and Simulation Mode"
          >
            <Radio size={12} className={mode === 'REAL' ? "animate-pulse text-emerald-400" : "text-amber-400"} />
            <span>{mode === 'REAL' ? 'REAL HARDWARE' : 'SIMULATION'}</span>
          </button>
        </div>

        {/* GPS Live Status Indicator (in Real Mode) */}
        {mode === 'REAL' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[10px] font-mono">
            <Compass size={12} className={latestReading?.latitude ? "text-emerald-400" : "text-amber-400 animate-spin"} />
            {latestReading?.latitude && latestReading?.longitude ? (
              <span className="text-emerald-400 font-semibold tracking-tight">
                GPS LOCK: {latestReading.latitude.toFixed(4)}°, {latestReading.longitude.toFixed(4)}°
              </span>
            ) : (
              <span className="text-amber-400 font-medium">
                NEO-6M: SEARCHING SATS
              </span>
            )}
          </div>
        )}

        {/* Wired USB Serial COM Port Button */}
        {mode === 'REAL' && (
          <button
            onClick={async () => {
              if (comConnected) {
                await webSerial.disconnect();
                setComConnected(false);
              } else {
                try {
                  await webSerial.connect();
                  setComConnected(true);
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Could not open COM port');
                }
              }
            }}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider transition-all border cursor-pointer",
              comConnected
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                : "bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white"
            )}
            title="Connect directly to ESP32 via USB COM Port (100% Wired)"
          >
            <Cable size={12} className={comConnected ? "text-cyan-400 animate-pulse" : ""} />
            <span>{comConnected ? 'USB COM CONNECTED' : 'CONNECT USB COM'}</span>
          </button>
        )}

        {mode === 'SIMULATION' && demoEnabled && (
          <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] px-2 py-0.5 rounded">
            <span className="text-[10px] text-amber-400 font-bold">SCENARIO:</span>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as typeof scenario)}
              className="bg-transparent text-[var(--text-secondary)] text-[11px] outline-none cursor-pointer"
            >
              <option value="NORMAL_SURVEY">Normal Survey</option>
              <option value="WEAK_ANOMALY">Weak Anomaly</option>
              <option value="STRONG_ANOMALY">Strong Anomaly</option>
              <option value="MULTIPLE_TARGETS">Multiple Targets</option>
              <option value="SENSOR_DRIFT">Sensor Drift</option>
              <option value="HIGH_NOISE">High Noise</option>
              <option value="PACKET_LOSS">Packet Loss</option>
              <option value="SENSOR_FAILURE">Sensor Failure</option>
            </select>
          </div>
        )}
      </div>


      {/* Right: Status indicators */}
      <div className="flex items-center gap-3">
        {/* Calibration */}
        <div className="flex items-center gap-1.5" title="Calibration Status">
          <Beaker size={14} className="text-[var(--text-muted)]" />
          <StatusBadge status={calibration?.status || 'uncalibrated'} size="sm" />
        </div>

        {/* Connection */}
        <div className="flex items-center gap-1.5" title={`Hardware Link: ${connectionStatus}`}>
          {isConnected ? (
            <Cable size={14} className="text-emerald-400" />
          ) : (
            <Cable size={14} className="text-[var(--text-muted)] opacity-50" />
          )}
          <span className={clsx(
            'text-[11px] font-medium',
            isConnected ? 'text-emerald-400' : 'text-[var(--text-muted)]',
          )}>
            {connectionStatus === 'connected' ? 'USB LINKED' : connectionStatus.toUpperCase()}
          </span>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-[var(--border-subtle)]" />

        {/* Notifications */}
        <button className="relative p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <Bell size={16} />
        </button>

        {/* User */}
        <button className="flex items-center gap-1.5 p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <User size={16} />
          <ChevronDown size={12} />
        </button>
      </div>
    </header>
  );
}
