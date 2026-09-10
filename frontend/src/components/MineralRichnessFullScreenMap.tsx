/* ============================================================
   AquaYantra — MineralRichnessFullScreenMap Component
   Full-Screen Seabed Mineral Richness Classification Map
   Categorizes each surveyed waypoint into:
   - RICH MINERAL DEPOSIT (High Grade / Concentrated Ore)
   - MODERATE PROSPECT (Medium Grade)
   - LOW TRACE (Disseminated / Trace Minerals)
   - NONE (Barren Seabed Sediment / Basalt Bedrock)
   ============================================================ */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Sparkles,
  Download,
  ZoomIn,
  ZoomOut,
  Target,
} from 'lucide-react';
import { useSimulationSurveyStore } from '../stores';
import type { MineralRichnessLevel, SimWaypoint } from '../stores';

interface MineralRichnessFullScreenMapProps {
  onClose: () => void;
  surveyRecords?: Array<{
    latitude: number;
    longitude: number;
    anomaly_score: number;
    magnetic_deviation: number;
    turbidity_ntu: number;
    depth_m: number;
    mineral_type: string;
    confidence: number;
  }>;
}

export function MineralRichnessFullScreenMap({ onClose, surveyRecords }: MineralRichnessFullScreenMapProps) {
  const simStore = useSimulationSurveyStore();
  const [zoom, setZoom] = useState(1);
  const [filterLevel, setFilterLevel] = useState<MineralRichnessLevel | 'ALL'>('ALL');
  const [selectedPoint, setSelectedPoint] = useState<SimWaypoint | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Determine points list (from simulation store or converted from surveyRecords)
  const waypoints: SimWaypoint[] = useMemo(() => {
    if (simStore.waypoints.length > 0) {
      return simStore.waypoints;
    }
    if (surveyRecords && surveyRecords.length > 0) {
      // Build SimWaypoints from CSV records
      return surveyRecords.map((r, idx) => {
        let richness: MineralRichnessLevel = 'NONE';
        if (r.anomaly_score >= 0.75) richness = 'RICH';
        else if (r.anomaly_score >= 0.45) richness = 'MODERATE';
        else if (r.anomaly_score >= 0.20) richness = 'LOW';

        return {
          id: `WP-${String(idx + 1).padStart(2, '0')}`,
          sequence: idx,
          latitude: r.latitude,
          longitude: r.longitude,
          targetDepth: r.depth_m,
          expectedMineral: (r.mineral_type as any) || 'MASSIVE_SULFIDES',
          primaryMineralName:
            richness === 'RICH'
              ? 'High-Grade Seabed Sulfide / Cobalt Deposit'
              : richness === 'MODERATE'
              ? 'Moderate Mineral Deposit'
              : richness === 'LOW'
              ? 'Low Trace Mineralization'
              : 'Barren Sediment / Bedrock',
          expectedMag: Number((28.9 + r.magnetic_deviation).toFixed(1)),
          expectedTurbidity: r.turbidity_ntu,
          richness,
          richnessScore: r.anomaly_score,
          scanned: true,
          scanning: false,
          dwellRemainingSec: 0,
        };
      });
    }
    return [];
  }, [simStore.waypoints, surveyRecords]);

  // Compute map center and bounding box
  const bounds = useMemo(() => {
    if (waypoints.length === 0) {
      return {
        centerLat: 28.6139,
        centerLon: 77.2090,
        minLat: 28.6125,
        maxLat: 28.6155,
        minLon: 77.2075,
        maxLon: 77.2105,
      };
    }
    const lats = waypoints.map((w) => w.latitude);
    const lons = waypoints.map((w) => w.longitude);
    const minLat = Math.min(...lats) - 0.0003;
    const maxLat = Math.max(...lats) + 0.0003;
    const minLon = Math.min(...lons) - 0.0004;
    const maxLon = Math.max(...lons) + 0.0004;
    return {
      centerLat: (minLat + maxLat) / 2,
      centerLon: (minLon + maxLon) / 2,
      minLat,
      maxLat,
      minLon,
      maxLon,
    };
  }, [waypoints]);

  // Project lat/lon to SVG space [0, 1000] x [0, 650]
  const project = useCallback(
    (lat: number, lon: number) => {
      const scale = 320000 * zoom;
      const x = 500 + (lon - bounds.centerLon) * scale;
      const y = 325 - (lat - bounds.centerLat) * scale;
      return { x, y };
    },
    [zoom, bounds.centerLat, bounds.centerLon]
  );

  // Counts by richness
  const counts = useMemo(() => {
    const res = { RICH: 0, MODERATE: 0, LOW: 0, NONE: 0 };
    waypoints.forEach((w) => {
      res[w.richness] = (res[w.richness] || 0) + 1;
    });
    return res;
  }, [waypoints]);

  const filteredWaypoints = useMemo(() => {
    if (filterLevel === 'ALL') return waypoints;
    return waypoints.filter((w) => w.richness === filterLevel);
  }, [waypoints, filterLevel]);

  // Richness styling helper
  const getRichnessStyle = (level: MineralRichnessLevel) => {
    switch (level) {
      case 'RICH':
        return {
          badge: 'RICH DEPOSIT (GRADE A)',
          badgeBg: 'bg-gradient-to-r from-amber-500/25 to-rose-500/25 border-amber-500/60 text-amber-300',
          color: '#f59e0b',
          halo: '#ef4444',
          glow: 'rgba(245, 158, 11, 0.45)',
          tag: 'Grade A Ore Body',
        };
      case 'MODERATE':
        return {
          badge: 'MODERATE PROSPECT',
          badgeBg: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
          color: '#a855f7',
          halo: '#8b5cf6',
          glow: 'rgba(168, 85, 247, 0.35)',
          tag: 'Medium Prospect',
        };
      case 'LOW':
        return {
          badge: 'LOW TRACE',
          badgeBg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
          color: '#06b6d4',
          halo: '#0284c7',
          glow: 'rgba(6, 182, 212, 0.25)',
          tag: 'Peripheral Trace',
        };
      case 'NONE':
      default:
        return {
          badge: 'NONE / BARREN',
          badgeBg: 'bg-slate-700/30 border-slate-600/40 text-slate-400',
          color: '#64748b',
          halo: '#475569',
          glow: 'rgba(100, 116, 139, 0.15)',
          tag: 'Barren Bedrock',
        };
    }
  };

  // Export GeoJSON
  const handleExportGeoJson = () => {
    if (waypoints.length === 0) return;
    const geoJson = {
      type: 'FeatureCollection',
      name: 'AquaYantra_Mineral_Richness_Classification',
      features: waypoints.map((w) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.longitude, w.latitude] },
        properties: {
          id: w.id,
          richness_classification: w.richness,
          richness_score: w.richnessScore,
          mineral_type: w.expectedMineral,
          mineral_name: w.primaryMineralName,
          magnetic_reading_uT: w.expectedMag,
          magnetic_anomaly_uT: Number((w.expectedMag - 28.9).toFixed(1)),
          turbidity_ntu: w.expectedTurbidity,
          depth_meters: w.targetDepth,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AquaYantra_Richness_Map_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050811] flex flex-col select-none overflow-hidden animate-in fade-in duration-200">
      {/* ── 1. Top HUD Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#090e1c] border-b border-cyan-500/30 shadow-2xl z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-bold text-white tracking-wider font-mono uppercase">
                AQUAYANTRA AI • FULL-SCREEN MINERAL RICHNESS CLASSIFICATION MAP
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                SCANNED & ASSAYED
              </span>
            </div>
            <p className="text-xs text-cyan-300/80 font-mono mt-0.5">
              Target Points Classified by Mineral Richness: High Concentration • Moderate Ore • Low Trace • Barren Bedrock
            </p>
          </div>
        </div>

        {/* Richness Overview Metric Counters */}
        <div className="hidden lg:flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setFilterLevel('ALL')}
            className={`px-3 py-1.5 rounded border transition-all cursor-pointer ${
              filterLevel === 'ALL'
                ? 'bg-cyan-500/20 border-cyan-500/60 text-white font-bold'
                : 'bg-[#0c1426] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white'
            }`}
          >
            All Sites: <span className="text-cyan-300 font-bold ml-1">{waypoints.length}</span>
          </button>

          <button
            onClick={() => setFilterLevel('RICH')}
            className={`px-3 py-1.5 rounded border transition-all cursor-pointer ${
              filterLevel === 'RICH'
                ? 'bg-amber-500/30 border-amber-500 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)] font-bold'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            🌟 Rich: <span className="font-bold ml-1">{counts.RICH}</span>
          </button>

          <button
            onClick={() => setFilterLevel('MODERATE')}
            className={`px-3 py-1.5 rounded border transition-all cursor-pointer ${
              filterLevel === 'MODERATE'
                ? 'bg-purple-500/30 border-purple-500 text-purple-200 font-bold'
                : 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
            }`}
          >
            ⚡ Moderate: <span className="font-bold ml-1">{counts.MODERATE}</span>
          </button>

          <button
            onClick={() => setFilterLevel('LOW')}
            className={`px-3 py-1.5 rounded border transition-all cursor-pointer ${
              filterLevel === 'LOW'
                ? 'bg-cyan-500/30 border-cyan-500 text-cyan-200 font-bold'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
            }`}
          >
            🔹 Low: <span className="font-bold ml-1">{counts.LOW}</span>
          </button>

          <button
            onClick={() => setFilterLevel('NONE')}
            className={`px-3 py-1.5 rounded border transition-all cursor-pointer ${
              filterLevel === 'NONE'
                ? 'bg-slate-700/40 border-slate-500 text-slate-200 font-bold'
                : 'bg-slate-800/30 border-slate-700/40 text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            ⚫ None: <span className="font-bold ml-1">{counts.NONE}</span>
          </button>
        </div>

        {/* Right Controls (Export & Close) */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportGeoJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-300 hover:text-white transition-all font-mono text-xs font-bold cursor-pointer"
            title="Export GeoJSON for GIS / QGIS"
          >
            <Download size={14} />
            <span className="hidden sm:inline">EXPORT GEOJSON</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white transition-all font-mono text-xs font-bold cursor-pointer shadow-lg"
          >
            <X size={16} />
            <span>CLOSE FULL-SCREEN</span>
          </button>
        </div>
      </div>

      {/* ── 2. Full-Screen Canvas Map ─────────────────────────────── */}
      <div className="relative flex-1 w-full h-full bg-[#050811] overflow-hidden flex">
        {/* SVG Tactical Ocean Map */}
        <svg
          className="w-full h-full cursor-grab active:cursor-grabbing"
          viewBox="0 0 1000 650"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Dark Bathymetric Ocean Gradient */}
            <radialGradient id="fsSeabedGrad" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#0c162e" />
              <stop offset="50%" stopColor="#070d1e" />
              <stop offset="100%" stopColor="#03060c" />
            </radialGradient>

            {/* Tactical Grid Pattern */}
            <pattern id="fsGrid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#13233f" strokeWidth="0.6" strokeOpacity="0.4" />
              <circle cx="50" cy="50" r="1.2" fill="#22d3ee" fillOpacity="0.25" />
            </pattern>

            {/* Glowing filter for Rich Points */}
            <filter id="fsGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="fsRichAura" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="14" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ocean Background */}
          <rect width="1000" height="650" fill="url(#fsSeabedGrad)" />
          <rect width="1000" height="650" fill="url(#fsGrid)" />

          {/* Bathymetric Contour Lines */}
          <g opacity="0.18">
            <ellipse cx="500" cy="325" rx="420" ry="260" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="6 8" />
            <ellipse cx="500" cy="325" rx="310" ry="190" fill="none" stroke="#0ea5e9" strokeWidth="0.8" strokeDasharray="4 6" />
            <ellipse cx="500" cy="325" rx="200" ry="130" fill="none" stroke="#0ea5e9" strokeWidth="0.6" />
          </g>

          {/* Survey Sector Boundary Box */}
          {(() => {
            const tl = project(bounds.maxLat, bounds.minLon);
            const br = project(bounds.minLat, bounds.maxLon);
            const w = br.x - tl.x;
            const h = br.y - tl.y;
            return (
              <g>
                <rect
                  x={tl.x}
                  y={tl.y}
                  width={w}
                  height={h}
                  fill="#06b6d4"
                  fillOpacity="0.03"
                  stroke="#22d3ee"
                  strokeWidth="1.5"
                  strokeDasharray="10 5"
                  strokeOpacity="0.6"
                  rx="4"
                />
                {/* Sector Corner Crosshairs */}
                <path d={`M ${tl.x - 8} ${tl.y} L ${tl.x + 12} ${tl.y} M ${tl.x} ${tl.y - 8} L ${tl.x} ${tl.y + 12}`} stroke="#22d3ee" strokeWidth="2" />
                <path d={`M ${br.x + 8} ${tl.y} L ${br.x - 12} ${tl.y} M ${br.x} ${tl.y - 8} L ${br.x} ${tl.y + 12}`} stroke="#22d3ee" strokeWidth="2" />
                <path d={`M ${tl.x - 8} ${br.y} L ${tl.x + 12} ${br.y} M ${tl.x} ${br.y + 8} L ${tl.x} ${br.y - 12}`} stroke="#22d3ee" strokeWidth="2" />
                <path d={`M ${br.x + 8} ${br.y} L ${br.x - 12} ${br.y} M ${br.x} ${br.y + 8} L ${br.x} ${br.y - 12}`} stroke="#22d3ee" strokeWidth="2" />
              </g>
            );
          })()}

          {/* Autonomous Survey Track Line connecting waypoints */}
          {waypoints.length > 1 && (
            <g>
              <polyline
                points={waypoints.map((w) => {
                  const p = project(w.latitude, w.longitude);
                  return `${p.x},${p.y}`;
                }).join(' ')}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeOpacity="0.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* ── Waypoint Markers Categorized by Richness ─────────────── */}
          {filteredWaypoints.map((wp) => {
            const { x, y } = project(wp.latitude, wp.longitude);
            const style = getRichnessStyle(wp.richness);
            const isSelected = selectedPoint?.id === wp.id;

            return (
              <g
                key={wp.id}
                className="cursor-pointer group"
                onClick={() => setSelectedPoint(wp)}
              >
                {/* RICH: Extra pulsating radiation halo */}
                {wp.richness === 'RICH' && (
                  <>
                    <circle cx={x} cy={y} r="45" fill="#f59e0b" fillOpacity="0.12" filter="url(#fsRichAura)">
                      <animate attributeName="r" values="32;52" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={x} cy={y} r="28" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="4 2">
                      <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="6s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}

                {/* MODERATE: Purple aura */}
                {wp.richness === 'MODERATE' && (
                  <circle cx={x} cy={y} r="24" fill="#a855f7" fillOpacity="0.15">
                    <animate attributeName="r" values="18;30" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.25;0" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Selected Halo */}
                {isSelected && (
                  <circle cx={x} cy={y} r="22" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3">
                    <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="4s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Core Waypoint Node */}
                <circle
                  cx={x}
                  cy={y}
                  r={wp.richness === 'RICH' ? 10 : wp.richness === 'MODERATE' ? 8 : 6.5}
                  fill={style.color}
                  stroke={isSelected ? '#ffffff' : '#080d1a'}
                  strokeWidth="2.5"
                  filter="url(#fsGlow)"
                  className="transition-transform duration-200 group-hover:scale-125"
                />
                <circle cx={x} cy={y} r={wp.richness === 'RICH' ? 4 : 2.5} fill="#ffffff" />

                {/* Waypoint ID Pin Header Label */}
                <g transform={`translate(${x}, ${y - 18})`}>
                  <rect
                    x="-34"
                    y="-12"
                    width="68"
                    height="18"
                    rx="9"
                    fill="#0a1020"
                    fillOpacity="0.92"
                    stroke={style.color}
                    strokeWidth="1.2"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {wp.id} • {wp.richness}
                  </text>
                </g>

                {/* Richness / Mineral Name Below */}
                <text
                  x={x}
                  y={y + 20}
                  textAnchor="middle"
                  fill={style.color}
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {wp.richness === 'RICH'
                    ? `★ RICH (${(wp.richnessScore * 100).toFixed(0)}%)`
                    : wp.richness === 'MODERATE'
                    ? `MODERATE (${(wp.richnessScore * 100).toFixed(0)}%)`
                    : wp.richness === 'LOW'
                    ? `LOW (${(wp.richnessScore * 100).toFixed(0)}%)`
                    : 'BARREN'}
                </text>
              </g>
            );
          })}
        </svg>

        {/* ── 3. Map Zoom & Position Controls ───────────────────────── */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 bg-[#0b1325]/90 backdrop-blur-md p-1.5 rounded-lg border border-[var(--border-medium)] shadow-xl font-mono">
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z + 0.25))}
            className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[11px] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer text-center"
            title="Reset Zoom"
          >
            1x
          </button>
        </div>

        {/* ── 4. Selected Waypoint Inspection Sidebar / Card ─────────── */}
        {selectedPoint && (
          <div className="absolute bottom-20 right-6 z-20 w-80 max-w-[90vw] bg-[#0c1426]/95 border border-cyan-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-cyan-400" />
                <span className="font-bold text-white font-mono text-sm">{selectedPoint.id} DETAILS</span>
              </div>
              <button
                onClick={() => setSelectedPoint(null)}
                className="text-gray-400 hover:text-white cursor-pointer p-0.5 rounded hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {/* Richness classification badge */}
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Classification:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRichnessStyle(selectedPoint.richness).badgeBg}`}>
                  {getRichnessStyle(selectedPoint.richness).badge}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Deposit Name:</span>
                <span className="text-white font-bold text-right text-[11px] max-w-[170px] truncate">
                  {selectedPoint.primaryMineralName}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Coordinates:</span>
                <span className="text-cyan-300">
                  {selectedPoint.latitude.toFixed(5)}°N, {selectedPoint.longitude.toFixed(5)}°E
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-[#070b14] p-2 rounded border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Magnetic Mag</span>
                  <span className="text-amber-300 font-bold text-sm">{selectedPoint.expectedMag} µT</span>
                  <span className="text-[9px] text-[var(--text-muted)] block">
                    Dev: +{(selectedPoint.expectedMag - 28.9).toFixed(1)} µT
                  </span>
                </div>
                <div className="bg-[#070b14] p-2 rounded border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Turbidity Plume</span>
                  <span className="text-cyan-300 font-bold text-sm">{selectedPoint.expectedTurbidity} NTU</span>
                  <span className="text-[9px] text-[var(--text-muted)] block">
                    Depth: {selectedPoint.targetDepth}m
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-cyan-500/10 to-amber-500/10 p-2.5 rounded border border-cyan-500/30 mt-1">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-gray-300">AI Ore Grade Confidence:</span>
                  <span className="text-emerald-400 font-bold">{(selectedPoint.richnessScore * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-[#070b14] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${selectedPoint.richnessScore * 100}%`,
                      backgroundColor: getRichnessStyle(selectedPoint.richness).color,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Bottom Classification Legend & Summary Bar ─────────── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-[#090e1c] border-t border-cyan-500/30 z-20 shrink-0 font-mono text-xs">
        {/* Color-coded Legend */}
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-[var(--text-muted)] uppercase font-bold tracking-wider">Classification Legend:</span>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"></span>
            <span className="text-white font-bold">Rich Deposit</span>
            <span className="text-[var(--text-muted)] text-[10px]">(High Concentration)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]"></span>
            <span className="text-white font-bold">Moderate Deposit</span>
            <span className="text-[var(--text-muted)] text-[10px]">(Medium Grade)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></span>
            <span className="text-white font-bold">Low Trace</span>
            <span className="text-[var(--text-muted)] text-[10px]">(Peripheral)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-500"></span>
            <span className="text-slate-400 font-bold">None / Barren</span>
            <span className="text-[var(--text-muted)] text-[10px]">(Bedrock)</span>
          </div>
        </div>

        {/* Quick Summary / Status */}
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span>Click any point to inspect mineral assay data</span>
          <span className="text-white font-bold">•</span>
          <span className="text-cyan-400 font-bold">{waypoints.length} Survey Waypoints Locked</span>
        </div>
      </div>
    </div>
  );
}
