/* ============================================================
   AquaYantra — Seabed Map Page
   Full-screen marine survey tactical map, bathymetry,
   track layer controls, target candidate clustering, detail drawer,
   and direct SD Card CSV upload with instant ML Mineral Heatmap.
   ============================================================ */

import { useState, useRef } from 'react';
import {
  Filter,
  Download,
  Waves,
  Upload,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { SeabedSonarMap } from '../components/SeabedSonarMap';
import { TargetDrawer } from '../components/TargetDrawer';
import { useMapStore, useMissionStore } from '../stores';
import { readingsApi, mapApi } from '../api/endpoints';
import { webSerial } from '../api/web_serial';


export function SeabedMapPage() {
  const selectedTarget = useMapStore((s) => s.selectedTarget);
  const setSelectedTarget = useMapStore((s) => s.setSelectedTarget);
  const appendHeatmapPoints = useMapStore((s) => s.appendHeatmapPoints);
  const heatmapPoints = useMapStore((s) => s.heatmapPoints);
  const mission = useMissionStore((s) => s.selectedMission);

  const [minConfidence, setMinConfidence] = useState<number>(50);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // SD Card CSV Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      // 1. Upload CSV to Backend ML pipeline with live NEO-6M GPS coordinates if available
      const gps = webSerial.currentGps;
      const res = await readingsApi.uploadCsv(
        file,
        gps.lat != null ? gps.lat : undefined,
        gps.lon != null ? gps.lon : undefined
      );

      // 2. Fetch fresh mineral heatmap data computed by ML model
      const heatRes = await mapApi.heatmap({ limit: 1000 });
      if (heatRes && heatRes.points) {
        appendHeatmapPoints(heatRes.points);
      }

      setUploadStatus({
        type: 'success',
        message: res.message || `Processed ${res.processed_rows} records. Generated ${heatRes?.points?.length || 0} mineral heatmap points!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Check backend connection.';
      setUploadStatus({
        type: 'error',
        message: msg,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Mineral counts
  const mineralCounts = heatmapPoints.reduce((acc, p) => {
    acc[p.mineral_type] = (acc[p.mineral_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0 relative">
      {/* Top Filter & Command Bar */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Waves size={16} />
          </div>
          <div>
            <h1 className="text-xs font-bold text-[var(--text-primary)] tracking-wide font-mono uppercase">
              BATHYMETRIC SEABED MAPPING & MINERAL SURVEY
            </h1>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              Survey Area: {mission?.name || 'Central Indian Ocean Basin (CIOB)'}
            </span>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-2.5 text-xs font-mono">
          {/* Priority filter */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-card)] px-2 py-1 rounded border border-[var(--border-subtle)]">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <span className="text-[10px] text-[var(--text-muted)] uppercase">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-[var(--text-primary)] text-xs outline-none cursor-pointer"
            >
              <option value="ALL">All Levels</option>
              <option value="VERY_HIGH">Very High (P1)</option>
              <option value="HIGH">High (P2)</option>
              <option value="MEDIUM">Medium (P3)</option>
            </select>
          </div>

          {/* Confidence Slider */}
          <div className="flex items-center gap-2 bg-[var(--bg-card)] px-2.5 py-1 rounded border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">Min Conf:</span>
            <input
              type="range"
              min="0"
              max="95"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-16 accent-cyan-400 cursor-pointer"
            >
            </input>
            <span className="text-cyan-400 text-[11px] w-6 text-right font-semibold">{minConfidence}%</span>
          </div>

          {/* SD Card CSV Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,text/csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 text-cyan-300 hover:text-white hover:border-cyan-400 transition-all cursor-pointer font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)]"
            title="Upload raw SD Card CSV (SURV_xxx.CSV) for ML mineral processing"
          >
            {uploading ? (
              <Loader2 size={13} className="animate-spin text-cyan-400" />
            ) : (
              <Upload size={13} className="text-cyan-400" />
            )}
            <span className="text-[11px]">{uploading ? 'PROCESSING...' : 'UPLOAD SD CSV'}</span>
          </button>

          {/* Link to ML Intelligence Page */}
          <a
            href="/ml"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:text-white hover:border-cyan-400 transition-all cursor-pointer font-bold"
            title="Open ML Intelligence Center with NEO-6M GPS alignment and 15-feature analysis"
          >
            <Sparkles size={13} className="text-cyan-400" />
            <span className="text-[11px]">ML INTELLIGENCE</span>
          </a>

          {/* Export GeoJSON */}
          <button
            onClick={() => alert('Exporting survey GeoJSON track and target coordinates...')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-medium)] text-[var(--text-secondary)] hover:text-cyan-400 hover:border-cyan-500/40 transition-colors cursor-pointer"
          >
            <Download size={12} />
            <span className="text-[11px]">GEOJSON</span>
          </button>

        </div>
      </div>

      {/* Upload Status Toast Banner */}
      {uploadStatus.type && (
        <div
          className={`flex items-center justify-between px-3.5 py-2 rounded-lg border text-xs font-mono transition-all shrink-0 ${
            uploadStatus.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {uploadStatus.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
            )}
            <span>{uploadStatus.message}</span>
          </div>
          <button
            onClick={() => setUploadStatus({ type: null, message: '' })}
            className="text-[11px] text-[var(--text-muted)] hover:text-white ml-3 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mineral Deposits Status Bar if Heatmap is Active */}
      {heatmapPoints.length > 0 && (
        <div className="flex items-center justify-between bg-[#0a1220]/90 px-3 py-1.5 rounded border border-[var(--border-subtle)] text-[11px] font-mono shrink-0">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles size={13} className="text-amber-400" />
            <span className="font-bold uppercase tracking-wider">ML Mineral Heatmap Active:</span>
            <span className="text-white font-semibold">{heatmapPoints.length} survey points processed</span>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="text-amber-400 font-semibold">
              Nodules: {mineralCounts['POLYMETALLIC_NODULES'] || 0}
            </span>
            <span className="text-rose-400 font-semibold">
              Sulfides: {mineralCounts['MASSIVE_SULFIDES'] || 0}
            </span>
            <span className="text-purple-400 font-semibold">
              Cobalt Crusts: {mineralCounts['COBALT_CRUSTS'] || 0}
            </span>
            <span className="text-cyan-400 font-semibold">
              Ferromagnetic: {mineralCounts['FERROMAGNETIC_ANOMALY'] || 0}
            </span>
          </div>
        </div>
      )}

      {/* Main Map Viewport */}
      <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden border border-[var(--border-subtle)]">
        <SeabedSonarMap
          className="h-full w-full !border-0"
          showControls={true}
          onSelectTarget={(target) => setSelectedTarget(target)}
        />
      </div>

      {/* Slide-over Target Drawer */}
      <TargetDrawer
        target={selectedTarget}
        onClose={() => setSelectedTarget(null)}
      />
    </div>
  );
}
