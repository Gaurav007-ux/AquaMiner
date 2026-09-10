/* ============================================================
   AquaYantra — SeabedSonarMap component
   High-tech seabed survey tactical map with sonar sweep,
   bathymetry contours, live track, anomaly markers, target pins,
   and ML-driven seabed mineral prospectivity heatmap.
   Strictly separates REAL MODE from SIMULATION MODE.
   ============================================================ */

import { useState, useRef, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Crosshair,
  Flame,
  AlertCircle,
  Pencil,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import type { TargetCandidate } from '../types';
import { useMapStore, useLiveStore, useDemoStore, useSimulationSurveyStore } from '../stores';
import { MineralRichnessFullScreenMap } from './MineralRichnessFullScreenMap';
import { RealMapLeaflet } from './RealMapLeaflet';


interface SeabedSonarMapProps {
  height?: string | number;
  className?: string;
  showControls?: boolean;
  onSelectTarget?: (target: TargetCandidate) => void;
}


export function SeabedSonarMap({
  height = '100%',
  className = '',
  showControls = true,
  onSelectTarget: _onSelectTarget,
}: SeabedSonarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredItem, setHoveredItem] = useState<{
    x: number;
    y: number;
    title: string;
    details: string;
    badge?: string;
    badgeColor?: string;
  } | null>(null);

  // Drawing state for custom survey sector
  const [dragStart, setDragStart] = useState<{ x: number; y: number; lat: number; lon: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number; lat: number; lon: number } | null>(null);

  const showTrack = useMapStore((s) => s.showSurveyTrack);
  const showAnomalies = useMapStore((s) => s.showAnomalies);
  const showTargets = useMapStore((s) => s.showTargets);
  const showHeatmap = useMapStore((s) => s.showHeatmap);
  const heatmapPoints = useMapStore((s) => s.heatmapPoints);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  const telemetry = useLiveStore((s) => s.telemetry);
  const latest = useLiveStore((s) => s.latestReading);
  const isRealMode = useDemoStore((s) => s.mode === 'REAL');

  // Simulation survey state
  const simStore = useSimulationSurveyStore();
  const simArea = simStore.selectedArea;
  const simWaypoints = simStore.waypoints;
  const simBoat = simStore.boatPosition;
  const simStatus = simStore.status;
  const simDwell = simStore.dwellTimer;
  const simActiveIdx = simStore.activeWaypointIndex;
  const isSimActive = !isRealMode && (simStatus === 'navigating' || simStatus === 'scanning' || simStatus === 'completed');

  // Determine geographic center dynamically
  const hasRealGps = isRealMode && latest?.latitude != null && latest?.longitude != null;

  const { centerLat, centerLon } = useMemo(() => {
    if (isRealMode) {
      if (latest?.latitude != null && latest?.longitude != null) {
        return { centerLat: latest.latitude, centerLon: latest.longitude };
      }
      const validT = telemetry.find((t) => t.latitude != null && t.longitude != null);
      if (validT && validT.latitude != null && validT.longitude != null) {
        return { centerLat: validT.latitude, centerLon: validT.longitude };
      }
      if (heatmapPoints.length > 0) {
        return { centerLat: heatmapPoints[0].latitude, centerLon: heatmapPoints[0].longitude };
      }
      return { centerLat: 0, centerLon: 0 };
    }
    // Simulation: center on custom drawn bounds or selected area
    if (simStore.customBounds) {
      return {
        centerLat: (simStore.customBounds.minLat + simStore.customBounds.maxLat) / 2,
        centerLon: (simStore.customBounds.minLon + simStore.customBounds.maxLon) / 2,
      };
    }
    if (simArea) {
      return { centerLat: simArea.centerLat, centerLon: simArea.centerLon };
    }
    return { centerLat: 28.6139, centerLon: 77.2090 };
  }, [isRealMode, latest, telemetry, heatmapPoints, simStore.customBounds, simArea]);

  // Project lat/lon to SVG coordinate space [0, 800] x [0, 500]
  const project = useCallback(
    (lat: number, lon: number) => {
      const scale = 220000 * zoom;
      const x = 400 + (lon - centerLon) * scale;
      const y = 250 - (lat - centerLat) * scale;
      return { x, y };
    },
    [zoom, centerLat, centerLon],
  );

  // Unproject SVG (x, y) back to lat/lon
  const unproject = useCallback(
    (x: number, y: number) => {
      const scale = 220000 * zoom;
      const lon = centerLon + (x - 400) / scale;
      const lat = centerLat - (y - 250) / scale;
      return { lat, lon };
    },
    [zoom, centerLat, centerLon]
  );

  // Drawing mouse handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isRealMode || !simStore.isDrawing) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * 800;
    const svgY = ((e.clientY - rect.top) / rect.height) * 500;
    const { lat, lon } = unproject(svgX, svgY);
    setDragStart({ x: svgX, y: svgY, lat, lon });
    setDragCurrent({ x: svgX, y: svgY, lat, lon });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragStart || isRealMode || !simStore.isDrawing) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * 800;
    const svgY = ((e.clientY - rect.top) / rect.height) * 500;
    const { lat, lon } = unproject(svgX, svgY);
    setDragCurrent({ x: svgX, y: svgY, lat, lon });
  };

  const handleMouseUp = () => {
    if (!dragStart || !dragCurrent) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }
    const minLat = Math.min(dragStart.lat, dragCurrent.lat);
    const maxLat = Math.max(dragStart.lat, dragCurrent.lat);
    const minLon = Math.min(dragStart.lon, dragCurrent.lon);
    const maxLon = Math.max(dragStart.lon, dragCurrent.lon);

    const dx = Math.abs(dragCurrent.x - dragStart.x);
    const dy = Math.abs(dragCurrent.y - dragStart.y);

    if (dx > 12 && dy > 12) {
      simStore.setDrawnArea({ minLat, maxLat, minLon, maxLon });
    } else {
      const sLat = 0.0016;
      const sLon = 0.0022;
      simStore.setDrawnArea({
        minLat: dragStart.lat - sLat / 2,
        maxLat: dragStart.lat + sLat / 2,
        minLon: dragStart.lon - sLon / 2,
        maxLon: dragStart.lon + sLon / 2,
      });
    }
    setDragStart(null);
    setDragCurrent(null);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (isRealMode || !simStore.isDrawing || e.touches.length === 0) return;
    const t = e.touches[0];
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((t.clientX - rect.left) / rect.width) * 800;
    const svgY = ((t.clientY - rect.top) / rect.height) * 500;
    const { lat, lon } = unproject(svgX, svgY);
    setDragStart({ x: svgX, y: svgY, lat, lon });
    setDragCurrent({ x: svgX, y: svgY, lat, lon });
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!dragStart || isRealMode || !simStore.isDrawing || e.touches.length === 0) return;
    const t = e.touches[0];
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((t.clientX - rect.left) / rect.width) * 800;
    const svgY = ((t.clientY - rect.top) / rect.height) * 500;
    const { lat, lon } = unproject(svgX, svgY);
    setDragCurrent({ x: svgX, y: svgY, lat, lon });
  };

  // Convert telemetry stream to path points
  const pathPoints = useMemo(() => {
    if (isRealMode) {
      // Filter strictly for points with valid GPS coordinates
      const realPoints = telemetry.filter((t) => t.latitude != null && t.longitude != null);
      return realPoints.slice(-120).map((t) => {
        const { x, y } = project(t.latitude!, t.longitude!);
        return { x, y, anomaly: t.anomaly_score, depth: t.depth, lat: t.latitude, lon: t.longitude };
      });
    }

    // Simulation mode — return empty until simulation has actually started
    if (!telemetry.length) {
      return [];
    }
    return telemetry.slice(-80).map((t) => {
      const { x, y } = project(t.latitude ?? centerLat, t.longitude ?? centerLon);
      return { x, y, anomaly: t.anomaly_score, depth: t.depth, lat: t.latitude, lon: t.longitude };
    });
  }, [isRealMode, telemetry, project, centerLat, centerLon]);

  const currentPos = pathPoints[pathPoints.length - 1] || { x: 400, y: 250 };

  const getMineralColor = (type: string) => {
    switch (type) {
      case 'POLYMETALLIC_NODULES':
        return '#f59e0b'; // Radiant Gold / Amber
      case 'MASSIVE_SULFIDES':
        return '#ef4444'; // Hydrothermal Crimson
      case 'COBALT_CRUSTS':
        return '#a855f7'; // Deep Violet
      case 'FERROMAGNETIC_ANOMALY':
        return '#06b6d4'; // Cyan
      default:
        return '#64748b'; // Slate
    }
  };

  // ── REAL MODE: render interactive Leaflet map ────────────────
  if (isRealMode) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[#070c16] select-none flex flex-col ${className}`}
        style={{ height }}
      >
        <RealMapLeaflet className="flex-1 min-h-0" />
      </div>
    );
  }

  // ── SIMULATION MODE: existing SVG tactical map ───────────────
  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[#070c16] select-none flex flex-col ${className}`}
      style={{ height }}
    >
      {/* HUD Top Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Geographic Coordinates HUD */}
        <div className="flex items-center gap-2 bg-[#0c1424]/90 backdrop-blur-md px-3 py-1.5 rounded border border-[var(--border-medium)] pointer-events-auto shadow-lg">
          <Crosshair size={13} className="text-cyan-400 animate-spin-slow" />
          <div className="flex items-center gap-3 text-[11px] font-mono">
            {isRealMode ? (
              hasRealGps ? (
                <>
                  <span className="text-[var(--text-secondary)]">
                    LAT: <span className="text-emerald-400 font-semibold">{latest!.latitude!.toFixed(6)}°N</span>
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    LON: <span className="text-emerald-400 font-semibold">{latest!.longitude!.toFixed(6)}°E</span>
                  </span>
                </>
              ) : (
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={12} className="animate-pulse" />
                  NEO-6M: SEARCHING SATELLITES (NO FIX)
                </span>
              )
            ) : (
              <>
                <span className="text-[var(--text-secondary)]">
                  LAT: <span className="text-[var(--text-primary)] font-semibold">{latest?.latitude?.toFixed(6) ?? '28.613900'}°N</span>
                </span>
                <span className="text-[var(--text-secondary)]">
                  LON: <span className="text-[var(--text-primary)] font-semibold">{latest?.longitude?.toFixed(6) ?? '77.209000'}°E</span>
                </span>
              </>
            )}
            <span className="text-[var(--text-secondary)]">
              DEPTH: <span className="text-cyan-400 font-semibold">{latest?.depth?.toFixed(1) ?? '0.0'}m</span>
            </span>
          </div>
        </div>

        {/* Map Layer Toggles */}
        {showControls && (
          <div className="flex items-center gap-1.5 bg-[#0c1424]/90 backdrop-blur-md p-1 rounded border border-[var(--border-medium)] pointer-events-auto shadow-lg">
            <button
              onClick={() => toggleLayer('surveyTrack')}
              className={`px-2 py-1 rounded text-[10px] font-mono font-medium tracking-wider transition-colors cursor-pointer ${
                showTrack ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              TRACK
            </button>
            <button
              onClick={() => toggleLayer('anomalies')}
              className={`px-2 py-1 rounded text-[10px] font-mono font-medium tracking-wider transition-colors cursor-pointer ${
                showAnomalies ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              ANOMALIES
            </button>
            <button
              onClick={() => toggleLayer('targets')}
              className={`px-2 py-1 rounded text-[10px] font-mono font-medium tracking-wider transition-colors cursor-pointer ${
                showTargets ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              TARGETS
            </button>
            <button
              onClick={() => toggleLayer('heatmap')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider transition-colors cursor-pointer ${
                showHeatmap
                  ? 'bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-300 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Flame size={11} className={showHeatmap ? "text-amber-400" : ""} />
              <span>MINERAL HEATMAP</span>
            </button>
          </div>
        )}
      </div>

      {/* Simulation Survey Workflow Bar (Judges Demo Controls) */}
      {!isRealMode && (
        <div className="absolute top-12 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-[#0b1324]/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-cyan-500/40 pointer-events-auto shadow-xl">
            {/* Step 1: Draw Area Button */}
            <button
              onClick={() => {
                if (simStore.isDrawing) {
                  simStore.setIsDrawing(false);
                } else {
                  simStore.clearArea();
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                simStore.isDrawing
                  ? 'bg-amber-500/30 border border-amber-400 text-amber-200 animate-pulse'
                  : 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:text-white'
              }`}
            >
              <Pencil size={12} />
              <span>{simStore.isDrawing ? 'DRAWING: DRAG ON MAP' : simStore.selectedArea ? 'REDRAW SECTOR' : 'DRAW SECTOR'}</span>
            </button>

            {/* Step 2: Find Waypoints Button */}
            <button
              onClick={() => simStore.findWaypoints(5)}
              disabled={simStore.status === 'navigating' || simStore.status === 'scanning'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer disabled:opacity-40 ${
                simStore.waypoints.length === 0
                  ? 'bg-gradient-to-r from-amber-500/30 to-cyan-500/30 border border-amber-500/60 text-amber-200 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : 'bg-[var(--bg-deep)] border border-[var(--border-subtle)] text-cyan-300 hover:text-white'
              }`}
            >
              <Sparkles size={12} className="text-amber-400" />
              <span>FIND WAYPOINTS {simStore.waypoints.length > 0 ? `(${simStore.waypoints.length})` : ''}</span>
            </button>

            {/* Step 3: Main Start Simulation Button */}
            {simStore.status === 'navigating' || simStore.status === 'scanning' ? (
              <button
                onClick={() => simStore.pauseSimulation()}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/25 border border-amber-500/50 text-amber-300 hover:text-white text-[10px] font-mono font-bold transition-all cursor-pointer"
              >
                <Pause size={12} />
                <span>PAUSE</span>
              </button>
            ) : (
              <button
                onClick={() => simStore.startSimulation()}
                disabled={simStore.waypoints.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer disabled:opacity-40 ${
                  simStore.waypoints.length > 0 && simStore.status !== 'completed'
                    ? 'bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 border border-emerald-500/60 text-emerald-200 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:text-white'
                }`}
              >
                <Play size={12} />
                <span>{simStore.status === 'completed' ? 'RESTART' : 'START SIMULATION'}</span>
              </button>
            )}

            {/* Reset */}
            <button
              onClick={() => simStore.resetSimulation()}
              className="p-1 rounded bg-[var(--bg-deep)] hover:bg-rose-500/20 border border-[var(--border-subtle)] text-gray-400 hover:text-rose-300 transition-colors cursor-pointer"
              title="Reset Simulation"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {/* Full-Screen Mineral Richness Classification Map button */}
          <button
            onClick={() => simStore.setShowFullScreenMineralMap(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/25 via-purple-500/25 to-cyan-500/25 border border-amber-500/50 text-amber-200 hover:text-white text-[10px] font-mono font-bold transition-all cursor-pointer pointer-events-auto shadow-xl hover:shadow-[0_0_14px_rgba(245,158,11,0.3)]"
          >
            <Maximize2 size={13} className="text-amber-400" />
            <span>FULL-SCREEN MINERAL RICHNESS MAP</span>
          </button>
        </div>
      )}

      {/* Drawing mode banner guide */}
      {!isRealMode && simStore.isDrawing && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/60 text-amber-200 font-mono text-xs shadow-2xl backdrop-blur-md animate-pulse">
          ✏️ Click & Drag on the map below to define the survey rectangle
        </div>
      )}

      {/* Main Vector Seabed Canvas */}
      <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox="0 0 800 500"
          className={`w-full h-full object-cover ${simStore.isDrawing ? 'cursor-crosshair' : 'cursor-default'}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <defs>
            {/* Tactical grid pattern */}
            <pattern id="seabedGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#16223b" strokeWidth="0.75" strokeDasharray="2 3" />
              <circle cx="0" cy="0" r="1" fill="#1e3156" />
            </pattern>

            {/* Radar scan gradient */}
            <radialGradient id="sonarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#0891b2" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
            </radialGradient>

            {/* Anomaly halo gradient */}
            <radialGradient id="anomalyGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.6" />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>

            {/* Mineral Heatmap filter glow */}
            <filter id="heatBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
          </defs>

          {/* Seabed Background */}
          <rect width="800" height="500" fill="#070c16" />
          <rect width="800" height="500" fill="url(#seabedGrid)" />

          {/* Bathymetry Contours */}
          <g opacity="0.25" stroke="#1d3159" strokeWidth="1" fill="none">
            <path d="M -50 80 C 150 120, 320 60, 520 110 S 750 90, 850 130" strokeDasharray="4 2" />
            <path d="M -50 200 C 180 240, 340 180, 560 230 S 720 200, 850 250" />
            <path d="M -50 330 C 140 370, 390 320, 580 370 S 760 340, 850 390" strokeDasharray="6 3" />
          </g>

          {/* 1. MINERAL PROSPECTIVITY HEATMAP LAYER */}
          {showHeatmap && heatmapPoints.length > 0 && (
            <g className="transition-opacity duration-300">
              {heatmapPoints.map((pt, idx) => {
                const { x, y } = project(pt.latitude, pt.longitude);
                if (x < -50 || x > 850 || y < -50 || y > 550) return null;
                const color = getMineralColor(pt.mineral_type);
                const radius = Math.max(14, pt.intensity * 38);

                return (
                  <g
                    key={`heat-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredItem({
                        x,
                        y,
                        title: pt.mineral_type.replace(/_/g, ' '),
                        details: `Heat Intensity: ${(pt.intensity * 100).toFixed(0)}% | Anomaly: ${(pt.anomaly_score * 100).toFixed(0)}% | Conf: ${(pt.confidence * 100).toFixed(0)}%`,
                        badge: pt.mineral_type,
                        badgeColor: color,
                      })
                    }
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {/* Glowing outer aura */}
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={color}
                      fillOpacity={pt.intensity * 0.45}
                      filter="url(#heatBlur)"
                    />
                    {/* Core intense node */}
                    <circle
                      cx={x}
                      cy={y}
                      r={Math.max(4, radius * 0.35)}
                      fill={color}
                      fillOpacity={0.8}
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={2}
                      fill="#ffffff"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Sonar sweep around current node */}
          {(hasRealGps || (!isRealMode && simStatus !== 'idle')) && (
            <g>
              <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r="100"
                fill="url(#sonarGlow)"
                className="animate-pulse"
                style={{ animationDuration: '3s' }}
              />
              <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r="50"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="0.75"
                strokeOpacity="0.3"
                strokeDasharray="3 3"
              />
              <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r="100"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="0.5"
                strokeOpacity="0.2"
              />
            </g>
          )}

          {/* 2. Live Real GPS Survey Breadcrumb Track */}
          {showTrack && pathPoints.length > 1 && (
            <g>
              <polyline
                points={pathPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="4"
                strokeOpacity="0.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={pathPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeDasharray="4 2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* 3. Anomaly pings */}
          {showAnomalies &&
            pathPoints
              .filter((p) => (p.anomaly ?? 0) > 0.45)
              .map((p, idx) => (
                <g key={`ping-${idx}`}>
                  <circle cx={p.x} cy={p.y} r="18" fill="url(#anomalyGlow)" />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#fbbf24"
                    stroke="#0a0e17"
                    strokeWidth="1.5"
                  />
                </g>
              ))}

          {/* Target Pins removed — only simulation waypoints (WP-xx) are rendered below */}

          {/* ── SIMULATION SURVEY OVERLAY ───────────────────── */}
          {/* Live Dragging Box Preview while user is drawing */}
          {dragStart && dragCurrent && (() => {
            const rx = Math.min(dragStart.x, dragCurrent.x);
            const ry = Math.min(dragStart.y, dragCurrent.y);
            const rw = Math.max(4, Math.abs(dragCurrent.x - dragStart.x));
            const rh = Math.max(4, Math.abs(dragCurrent.y - dragStart.y));
            return (
              <g>
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill="#06b6d4"
                  fillOpacity="0.14"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  rx="3"
                />
                <text
                  x={rx + rw / 2}
                  y={ry - 8}
                  textAnchor="middle"
                  fill="#22d3ee"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  Sector: ~{Math.round(rw * 0.4)}m × ~{Math.round(rh * 0.4)}m
                </text>
              </g>
            );
          })()}

          {!isRealMode && (simArea || simStore.customBounds) && (
            <g>
              {/* Survey area boundary box (cyan dashed with corner brackets) */}
              {(() => {
                const b = simStore.customBounds || {
                  minLat: simArea!.minLat,
                  maxLat: simArea!.maxLat,
                  minLon: simArea!.minLon,
                  maxLon: simArea!.maxLon,
                };
                const tl = project(b.maxLat, b.minLon);
                const br = project(b.minLat, b.maxLon);
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
                      fillOpacity="0.04"
                      stroke="#22d3ee"
                      strokeWidth="1.6"
                      strokeDasharray="8 4"
                      strokeOpacity="0.7"
                      rx="3"
                    />
                    {/* Corner Reticles */}
                    <path d={`M ${tl.x - 5} ${tl.y} L ${tl.x + 8} ${tl.y} M ${tl.x} ${tl.y - 5} L ${tl.x} ${tl.y + 8}`} stroke="#22d3ee" strokeWidth="1.8" />
                    <path d={`M ${br.x + 5} ${tl.y} L ${br.x - 8} ${tl.y} M ${br.x} ${tl.y - 5} L ${br.x} ${tl.y + 8}`} stroke="#22d3ee" strokeWidth="1.8" />
                    <path d={`M ${tl.x - 5} ${br.y} L ${tl.x + 8} ${br.y} M ${tl.x} ${br.y + 5} L ${tl.x} ${br.y - 8}`} stroke="#22d3ee" strokeWidth="1.8" />
                    <path d={`M ${br.x + 5} ${br.y} L ${br.x - 8} ${br.y} M ${br.x} ${br.y + 5} L ${br.x} ${br.y - 8}`} stroke="#22d3ee" strokeWidth="1.8" />
                  </g>
                );
              })()}

              {/* Waypoint Traversal Line */}
              {simWaypoints.length > 1 && (
                <polyline
                  points={simWaypoints.map((w) => {
                    const p = project(w.latitude, w.longitude);
                    return `${p.x},${p.y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  strokeOpacity="0.35"
                />
              )}

              {/* Waypoint markers */}
              {simWaypoints.map((wp, idx) => {
                const { x, y } = project(wp.latitude, wp.longitude);
                if (x < -50 || x > 850 || y < -50 || y > 550) return null;

                const isActive = idx === simActiveIdx && (simStatus === 'navigating' || simStatus === 'scanning');
                const isScanning = wp.scanning;

                const color =
                  wp.richness === 'RICH' ? '#f59e0b' :
                  wp.richness === 'MODERATE' ? '#a855f7' :
                  wp.richness === 'LOW' ? '#06b6d4' : '#64748b';

                return (
                  <g
                    key={wp.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setHoveredItem({
                        x,
                        y,
                        title: `${wp.id} (${wp.richness})`,
                        details: `Mag: ${wp.expectedMag}µT | Turbidity: ${wp.expectedTurbidity}NTU | Depth: ${wp.targetDepth}m`,
                        badge: wp.richness,
                        badgeColor: color,
                      });
                    }}
                  >
                    {/* Scanning sonar ring */}
                    {isScanning && (
                      <>
                        <circle cx={x} cy={y} r="32" fill="#22d3ee" fillOpacity="0.12">
                          <animate attributeName="r" values="14;38" dur="1s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.4;0" dur="1s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={x} cy={y} r="22" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="3 2">
                          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="2s" repeatCount="indefinite" />
                        </circle>
                        <text x={x} y={y - 24} textAnchor="middle" fill="#22d3ee" fontSize="11" fontFamily="monospace" fontWeight="bold">
                          {simDwell}s
                        </text>
                      </>
                    )}

                    {/* Scanned checkmark glow */}
                    {wp.scanned && (
                      <circle cx={x} cy={y} r="14" fill="#10b981" fillOpacity="0.18" />
                    )}

                    {/* Rich deposit halo */}
                    {wp.richness === 'RICH' && !isScanning && (
                      <circle cx={x} cy={y} r="15" fill="#f59e0b" fillOpacity="0.15" />
                    )}

                    {/* Waypoint dot */}
                    <circle
                      cx={x}
                      cy={y}
                      r={wp.scanned ? 7 : isActive ? 8 : 6}
                      fill={wp.scanned ? '#10b981' : isScanning ? '#22d3ee' : color}
                      stroke={wp.scanned ? '#34d399' : isActive ? '#ffffff' : '#080d1a'}
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                    <circle cx={x} cy={y} r={wp.scanned ? 2.5 : 2} fill="#ffffff" />

                    {/* Label */}
                    <text
                      x={x}
                      y={y + (isScanning ? 20 : 16)}
                      textAnchor="middle"
                      fill={wp.scanned ? '#34d399' : color}
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {wp.scanned ? `${wp.id} ✓` : `${wp.id} [${wp.richness.slice(0, 1)}]`}
                    </text>
                  </g>
                );
              })}

              {/* Animated Boat marker (during active simulation) */}
              {isSimActive && simStatus !== 'completed' && (() => {
                const bp = project(simBoat.lat, simBoat.lon);
                return (
                  <g transform={`translate(${bp.x}, ${bp.y})`}>
                    {/* Boat ping */}
                    <circle cx="0" cy="0" r="15" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6">
                      <animate attributeName="r" values="10;30" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    {/* Boat body */}
                    <circle cx="0" cy="0" r="8" fill="#f59e0b" stroke="#fbbf24" strokeWidth="2" />
                    <circle cx="0" cy="0" r="3" fill="#ffffff" />
                    {/* Direction arrow */}
                    <polygon points="0,-18 -5,-9 5,-9" fill="#fbbf24" opacity="0.9" />
                  </g>
                );
              })()}
            </g>
          )}

          {/* 5. Real Underwater Node Marker */}
          {(hasRealGps || (!isRealMode && simStatus !== 'idle')) && !isSimActive && (
            <g transform={`translate(${currentPos.x}, ${currentPos.y})`}>
              <circle cx="0" cy="0" r="16" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.6">
                <animate attributeName="r" values="8;24" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="0" cy="0" r="6" fill="#0891b2" stroke="#22d3ee" strokeWidth="2" />
              <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
              <polygon points="0,-16 -5,-7 5,-7" fill="#22d3ee" opacity="0.8" />
            </g>
          )}
        </svg>


        {/* Hover Tooltip */}
        {hoveredItem && (
          <div
            className="absolute z-30 pointer-events-none px-3 py-2 rounded bg-[#0b1322]/95 border border-[var(--border-strong)] text-xs shadow-2xl backdrop-blur-sm"
            style={{
              left: `${(hoveredItem.x / 800) * 100}%`,
              top: `${(hoveredItem.y / 500) * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-white font-mono">{hoveredItem.title}</span>
              {hoveredItem.badge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
                  style={{ backgroundColor: `${hoveredItem.badgeColor || '#06b6d4'}25`, color: hoveredItem.badgeColor || '#06b6d4' }}
                >
                  {hoveredItem.badge}
                </span>
              )}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">{hoveredItem.details}</div>
          </div>
        )}
      </div>

      {/* HUD Bottom: Mineral Heatmap Legend & Zoom Controls */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Mineral Heatmap Legend */}
        <div className="flex items-center gap-3 bg-[#0c1424]/90 backdrop-blur-md px-3 py-1.5 rounded border border-[var(--border-medium)] pointer-events-auto text-[10px] font-mono shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]"></span>
            <span className="text-gray-300">Polymetallic Nodules</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]"></span>
            <span className="text-gray-300">Massive Sulfides</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]"></span>
            <span className="text-gray-300">Cobalt Crusts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]"></span>
            <span className="text-gray-300">Ferromagnetic</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-[#0c1424]/90 backdrop-blur-md p-1 rounded border border-[var(--border-medium)] pointer-events-auto shadow-lg">
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[10px] font-mono text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
            title="Reset Zoom"
          >
            1x
          </button>
        </div>
      </div>

      {/* Full-Screen Mineral Richness Classification Modal */}
      {simStore.showFullScreenMineralMap && (
        <MineralRichnessFullScreenMap
          onClose={() => simStore.setShowFullScreenMineralMap(false)}
        />
      )}
    </div>
  );
}

