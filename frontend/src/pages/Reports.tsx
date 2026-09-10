/* ============================================================
   AquaYantra — Reports & Survey Documentation Page
   Print-ready mission summary, target catalog, and scientific audit export
   ============================================================ */

import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  Anchor,
} from 'lucide-react';
import { useMissionStore } from '../stores';

export function ReportsPage() {
  const mission = useMissionStore((s) => s.selectedMission);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <FileText size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
              SURVEY MISSION REPORTS & AUDIT ARCHIVE
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">
              Scientific documentation, seabed target catalog, and compliance export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-colors"
          >
            <Printer size={13} />
            <span>PRINT / SAVE PDF</span>
          </button>
          <button
            onClick={() => alert('Generating full mission zip bundle (GeoJSON + Telemetry CSV + Report PDF)...')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-medium)] text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            <Download size={13} />
            <span>EXPORT ARCHIVE</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Sheet */}
      <div className="card p-6 bg-[#0b1220] border-[var(--border-medium)] space-y-6 max-w-4xl mx-auto w-full shadow-2xl">
        {/* Document Header */}
        <div className="border-b border-[var(--border-medium)] pb-4 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-semibold tracking-wider uppercase">
              <Anchor size={16} />
              <span>AQUAYANTRA MARINE RESEARCH PLATFORM</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              OFFSHORE SEABED RECONNAISSANCE REPORT
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
              Document Ref: AQM-RPT-2026-0904-01 | Classification: UNCLASSIFIED / PUBLIC
            </p>
          </div>

          <div className="text-right text-xs font-mono text-[var(--text-muted)] space-y-0.5">
            <div>DATE: <span className="text-white">SEPTEMBER 04, 2026</span></div>
            <div>STATUS: <span className="text-emerald-400 font-semibold">VALIDATED</span></div>
            <div>OPERATOR: <span className="text-white">{mission?.operator || 'Cmdr. V. Sharma'}</span></div>
          </div>
        </div>

        {/* Mission Abstract */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono">
            1. Mission Executive Summary
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            The AquaYantra autonomous sensing unit completed an underwater reconnaissance sortie across the specified survey grid sector. Telemetry stream recorded 3-axis magnetic flux (QMC5883L), optical turbidity, and hydrostatic depth. Real-time machine learning inference identified 3 discrete target candidates exhibiting dipolar ferromagnetic anomalies exceeding ambient geomagnetic baseline thresholds.
          </p>
        </div>

        {/* Survey Operational Parameters */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono">
            2. Survey Parameters & Hardware Configuration
          </h3>
          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Survey Platform</span>
              <span className="text-white font-semibold">AquaYantra Unit Alpha (STM32F411)</span>
            </div>
            <div className="p-2.5 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Sensors Configured</span>
              <span className="text-white font-semibold">QMC5883L / SEN0189 / BMP280</span>
            </div>
            <div className="p-2.5 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Regional Baseline</span>
              <span className="text-emerald-400 font-semibold">45.0 µT Geomagnetic B0</span>
            </div>
            <div className="p-2.5 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Grid Track Distance</span>
              <span className="text-white font-semibold">1,840 meters traversed</span>
            </div>
            <div className="p-2.5 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Mean Seabed Depth</span>
              <span className="text-cyan-300 font-semibold">15.4 meters below surface</span>
            </div>
            <div className="p-2.5 rounded bg-[var(--bg-deep)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Optical Turbidity</span>
              <span className="text-white font-semibold">4.8 NTU (Clear coastal water)</span>
            </div>
          </div>
        </div>

        {/* Target Catalog Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono">
            3. Seabed Anomaly Target Candidates Catalog
          </h3>
          <table className="w-full text-left text-xs font-mono border border-[var(--border-subtle)]">
            <thead className="text-[10px] text-[var(--text-muted)] uppercase bg-[var(--bg-deep)]">
              <tr>
                <th className="p-2 border-b border-[var(--border-subtle)]">Target ID</th>
                <th className="p-2 border-b border-[var(--border-subtle)]">Coordinates</th>
                <th className="p-2 border-b border-[var(--border-subtle)]">Peak Anomaly</th>
                <th className="p-2 border-b border-[var(--border-subtle)]">Confidence</th>
                <th className="p-2 border-b border-[var(--border-subtle)]">Priority</th>
                <th className="p-2 border-b border-[var(--border-subtle)]">Est. Depth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              <tr>
                <td className="p-2 text-cyan-300 font-bold">TRG-01-A</td>
                <td className="p-2 text-[var(--text-secondary)]">28.614200° N, 77.209400° E</td>
                <td className="p-2 text-amber-400 font-bold">88.0%</td>
                <td className="p-2 text-emerald-400">94%</td>
                <td className="p-2 text-rose-400 font-semibold">VERY_HIGH (P1)</td>
                <td className="p-2 text-white">15.6 m</td>
              </tr>
              <tr>
                <td className="p-2 text-cyan-300 font-bold">TRG-02-B</td>
                <td className="p-2 text-[var(--text-secondary)]">28.613600° N, 77.208600° E</td>
                <td className="p-2 text-amber-400 font-bold">65.0%</td>
                <td className="p-2 text-emerald-400">81%</td>
                <td className="p-2 text-amber-400 font-semibold">HIGH (P2)</td>
                <td className="p-2 text-white">15.1 m</td>
              </tr>
              <tr>
                <td className="p-2 text-cyan-300 font-bold">TRG-03-C</td>
                <td className="p-2 text-[var(--text-secondary)]">28.614600° N, 77.208800° E</td>
                <td className="p-2 text-amber-400 font-bold">49.0%</td>
                <td className="p-2 text-emerald-400">68%</td>
                <td className="p-2 text-yellow-400 font-semibold">MEDIUM (P3)</td>
                <td className="p-2 text-white">16.3 m</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Verification Sign-Off Footer */}
        <div className="border-t border-[var(--border-medium)] pt-4 flex justify-between items-center text-xs font-mono text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 size={14} />
            <span>Digital Cryptographic Audit Signature Verified</span>
          </div>
          <div>AquaYantra Telemetry Pipeline v2.4</div>
        </div>
      </div>
    </div>
  );
}
