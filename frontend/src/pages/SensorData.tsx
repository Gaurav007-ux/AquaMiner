/* ============================================================
   AquaYantra — Sensor Data Explorer Page
   Raw multi-channel tabular inspection, range filtering,
   and scientific CSV data export
   ============================================================ */

import { useState } from 'react';
import {
  Database,
  Download,
  Filter,
} from 'lucide-react';
import { useLiveStore } from '../stores';

export function SensorDataPage() {
  const telemetry = useLiveStore((s) => s.telemetry);
  const [filterThreshold, setFilterThreshold] = useState<number>(0);

  // Filtered readings
  const filteredReadings = telemetry.filter((t) => {
    if (filterThreshold > 0 && (t.anomaly_score ?? 0) < filterThreshold) {
      return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    if (!telemetry.length) {
      alert('No sensor telemetry in buffer to export.');
      return;
    }
    const headers = [
      'timestamp',
      'depth_m',
      'mag_total_uT',
      'baseline_uT',
      'deviation_uT',
      'mag_x_uT',
      'mag_y_uT',
      'mag_z_uT',
      'anomaly_score',
      'confidence',
      'turbidity_ntu',
      'battery_voltage',
      'quality_score',
      'lat',
      'lon',
    ];
    const rows = telemetry.map((t) => [
      t.timestamp,
      t.depth,
      t.magnetic_magnitude,
      t.magnetic_baseline,
      t.magnetic_deviation,
      t.mag_x,
      t.mag_y,
      t.mag_z,
      t.anomaly_score,
      t.confidence,
      t.turbidity,
      t.battery_voltage,
      t.data_quality,
      t.latitude,
      t.longitude,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aquayantra_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Database size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              MULTI-CHANNEL SENSOR DATA EXPLORER
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              Raw sensor packet telemetry logs & scientific export ({telemetry.length} buffered frames)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-colors"
          >
            <Download size={13} />
            <span>EXPORT FULL CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-2.5 flex items-center justify-between gap-3 text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-cyan-400" />
          <span className="text-[10px] text-[var(--text-muted)] uppercase">Threshold Filter:</span>
          <select
            value={filterThreshold}
            onChange={(e) => setFilterThreshold(Number(e.target.value))}
            className="bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
          >
            <option value={0}>All Readings (100%)</option>
            <option value={0.3}>Watch Threshold (&gt;0.30)</option>
            <option value={0.5}>Candidate Threshold (&gt;0.50)</option>
            <option value={0.75}>Confirmed Anomalies (&gt;0.75)</option>
          </select>
        </div>

        <div className="text-[11px] text-[var(--text-muted)]">
          Displaying <span className="text-cyan-300 font-semibold">{filteredReadings.length}</span> of {telemetry.length} readings
        </div>
      </div>

      {/* Raw Data Table */}
      <div className="card flex-1 min-h-0 flex flex-col p-3">
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-card)]">
              <tr>
                <th className="pb-2 whitespace-nowrap">Timestamp</th>
                <th className="pb-2 whitespace-nowrap">Depth (m)</th>
                <th className="pb-2 whitespace-nowrap">Mag Total (µT)</th>
                <th className="pb-2 whitespace-nowrap">Baseline (µT)</th>
                <th className="pb-2 whitespace-nowrap">Δ Deviation</th>
                <th className="pb-2 whitespace-nowrap">Mag X</th>
                <th className="pb-2 whitespace-nowrap">Mag Y</th>
                <th className="pb-2 whitespace-nowrap">Mag Z</th>
                <th className="pb-2 whitespace-nowrap">Anomaly Score</th>
                <th className="pb-2 whitespace-nowrap">Confidence</th>
                <th className="pb-2 whitespace-nowrap">Turbidity</th>
                <th className="pb-2 whitespace-nowrap">Battery</th>
                <th className="pb-2 whitespace-nowrap">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredReadings.slice(-100).reverse().map((r, idx) => (
                <tr key={idx} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="py-1.5 text-[var(--text-secondary)] whitespace-nowrap">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-1.5 text-cyan-300 font-semibold">{r.depth?.toFixed(2) ?? '—'}</td>
                  <td className="py-1.5 text-[var(--text-primary)] font-bold">{r.magnetic_magnitude?.toFixed(2) ?? '—'}</td>
                  <td className="py-1.5 text-emerald-400">{r.magnetic_baseline?.toFixed(1) ?? '—'}</td>
                  <td className="py-1.5 text-amber-400">{r.magnetic_deviation?.toFixed(2) ?? '—'}</td>
                  <td className="py-1.5 text-slate-400">{r.mag_x?.toFixed(1) ?? '—'}</td>
                  <td className="py-1.5 text-slate-400">{r.mag_y?.toFixed(1) ?? '—'}</td>
                  <td className="py-1.5 text-slate-400">{r.mag_z?.toFixed(1) ?? '—'}</td>
                  <td className="py-1.5 font-bold text-amber-300">{((r.anomaly_score ?? 0) * 100).toFixed(1)}%</td>
                  <td className="py-1.5 text-emerald-400">{((r.confidence ?? 0) * 100).toFixed(0)}%</td>
                  <td className="py-1.5 text-[var(--text-secondary)]">{r.turbidity?.toFixed(1) ?? '—'} NTU</td>
                  <td className="py-1.5 text-[var(--text-secondary)]">{r.battery_percent ?? '—'}%</td>
                  <td className="py-1.5 text-cyan-400">{((r.data_quality ?? 0.95) * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
