/* ============================================================
   AquaYantra — Zustand stores
   ============================================================ */

import { create } from 'zustand';
import type {
  Mission, Deployment, ConnectionStatus, LiveTelemetry,
  DetectionEvent, CalibrationStatus, TargetCandidate, MineralHeatmapPoint,
  MineralType,
} from '../types';

// ── UI Store ────────────────────────────────────────────────

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
}));

// ── Mission Store ───────────────────────────────────────────

interface MissionState {
  selectedMission: Mission | null;
  selectedDeployment: Deployment | null;
  setMission: (m: Mission | null) => void;
  setDeployment: (d: Deployment | null) => void;
}

export const useMissionStore = create<MissionState>((set) => ({
  selectedMission: null,
  selectedDeployment: null,
  setMission: (m) => set({ selectedMission: m, selectedDeployment: null }),
  setDeployment: (d) => set({ selectedDeployment: d }),
}));

// ── Device Store ────────────────────────────────────────────

interface DeviceState {
  activeDeviceId: string | null;
  connectionStatus: ConnectionStatus;
  setActiveDevice: (id: string | null) => void;
  setConnectionStatus: (s: ConnectionStatus) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  activeDeviceId: null,
  connectionStatus: 'disconnected',
  setActiveDevice: (id) => set({ activeDeviceId: id }),
  setConnectionStatus: (s) => set({ connectionStatus: s }),
}));

// ── Live Telemetry Store ────────────────────────────────────

const MAX_BUFFER = 600; // 10 min at 1Hz

interface LiveState {
  telemetry: LiveTelemetry[];
  latestReading: LiveTelemetry | null;
  latestDetection: DetectionEvent | null;
  calibrationStatus: CalibrationStatus | null;
  pushReading: (t: LiveTelemetry) => void;
  setDetection: (d: DetectionEvent | null) => void;
  setCalibration: (c: CalibrationStatus | null) => void;
  clearBuffer: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  telemetry: [],
  latestReading: null,
  latestDetection: null,
  calibrationStatus: null,
  pushReading: (t) =>
    set((s) => {
      const buf = [...s.telemetry, t];
      if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER);
      return { telemetry: buf, latestReading: t };
    }),
  setDetection: (d) => set({ latestDetection: d }),
  setCalibration: (c) => set({ calibrationStatus: c }),
  clearBuffer: () => set({ telemetry: [], latestReading: null }),
}));

// ── Demo Store ──────────────────────────────────────────────

export type DemoScenario =
  | 'NORMAL_SURVEY'
  | 'WEAK_ANOMALY'
  | 'STRONG_ANOMALY'
  | 'MULTIPLE_TARGETS'
  | 'SENSOR_DRIFT'
  | 'HIGH_NOISE'
  | 'PACKET_LOSS'
  | 'SENSOR_FAILURE';

export type OperationMode = 'REAL' | 'SIMULATION';

interface DemoState {
  enabled: boolean;
  mode: OperationMode;
  scenario: DemoScenario;
  running: boolean;
  toggleDemo: () => void;
  setMode: (m: OperationMode) => void;
  setScenario: (s: DemoScenario) => void;
  setRunning: (r: boolean) => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  enabled: false, // Default to REAL MODE as requested
  mode: 'REAL',
  scenario: 'NORMAL_SURVEY',
  running: false,
  toggleDemo: () =>
    set((s) => ({
      enabled: !s.enabled,
      mode: !s.enabled ? 'SIMULATION' : 'REAL',
    })),
  setMode: (mode) =>
    set({
      mode,
      enabled: mode === 'SIMULATION',
    }),
  setScenario: (scenario) => set({ scenario }),
  setRunning: (running) => set({ running }),
}));

// ── Map Store ───────────────────────────────────────────────

interface MapState {
  showSurveyTrack: boolean;
  showAnomalies: boolean;
  showTargets: boolean;
  showSurveyPoints: boolean;
  showHeatmap: boolean;
  heatmapPoints: MineralHeatmapPoint[];
  selectedTarget: TargetCandidate | null;
  toggleLayer: (layer: 'surveyTrack' | 'anomalies' | 'targets' | 'surveyPoints' | 'heatmap') => void;
  setSelectedTarget: (t: TargetCandidate | null) => void;
  setHeatmapPoints: (pts: MineralHeatmapPoint[]) => void;
  appendHeatmapPoints: (pts: MineralHeatmapPoint[]) => void;
  clearHeatmapPoints: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  showSurveyTrack: true,
  showAnomalies: true,
  showTargets: true,
  showSurveyPoints: true,
  showHeatmap: true,
  heatmapPoints: [],
  selectedTarget: null,
  toggleLayer: (layer) =>
    set((s) => {
      const map: Record<string, keyof MapState> = {
        surveyTrack: 'showSurveyTrack',
        anomalies: 'showAnomalies',
        targets: 'showTargets',
        surveyPoints: 'showSurveyPoints',
        heatmap: 'showHeatmap',
      };
      return { [map[layer]]: !s[map[layer] as keyof MapState] } as Partial<MapState>;
    }),
  setSelectedTarget: (t) => set({ selectedTarget: t }),
  setHeatmapPoints: (heatmapPoints) => set({ heatmapPoints }),
  appendHeatmapPoints: (pts) =>
    set((s) => ({ heatmapPoints: [...s.heatmapPoints, ...pts] })),
  clearHeatmapPoints: () => set({ heatmapPoints: [] }),
}));

// ── Simulation Survey Store (Interactive Area Selection & Autonomous Boat Survey) ──


export type SimDrawPhase =
  | 'idle'
  | 'drawing'
  | 'area_drawn'
  | 'waypoints_ready'
  | 'navigating'
  | 'scanning'
  | 'completed';

export type MineralRichnessLevel = 'RICH' | 'MODERATE' | 'LOW' | 'NONE';

export interface SimSurveyArea {
  id: string;
  name: string;
  description: string;
  centerLat: number;
  centerLon: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  primaryMineral: MineralType;
}

export interface SimWaypoint {
  id: string;
  sequence: number;
  latitude: number;
  longitude: number;
  targetDepth: number;
  expectedMineral: MineralType;
  primaryMineralName: string;
  expectedMag: number;
  expectedTurbidity: number;
  richness: MineralRichnessLevel;
  richnessScore: number; // 0.0 to 1.0
  scanned: boolean;
  scanning: boolean;
  dwellRemainingSec: number;
}

export type SimSurveyStatus = 'idle' | 'navigating' | 'scanning' | 'completed';

export const PRESET_AREAS: SimSurveyArea[] = [
  {
    id: 'ciob-nodules',
    name: 'Central Indian Ocean Basin (Nodule Field)',
    description: 'Abyssal sediment plains rich in Polymetallic Nodules (Mn, Ni, Cu, Co)',
    centerLat: 28.6141,
    centerLon: 77.2091,
    minLat: 28.6130,
    maxLat: 28.6152,
    minLon: 77.2078,
    maxLon: 77.2105,
    primaryMineral: 'POLYMETALLIC_NODULES',
  },
  {
    id: 'carlsberg-ridge',
    name: 'Carlsberg Ridge (Hydrothermal Vent Field)',
    description: 'Volcanic spreading center with active black smoker chimneys (Cu, Zn, Au, Ag)',
    centerLat: 28.6140,
    centerLon: 77.2090,
    minLat: 28.6125,
    maxLat: 28.6155,
    minLon: 77.2075,
    maxLon: 77.2108,
    primaryMineral: 'MASSIVE_SULFIDES',
  },
  {
    id: 'afanasy-seamount',
    name: 'Afanasy Nikitin Seamount (Cobalt Crusts)',
    description: 'Seamount summit terraces covered in Ferromanganese Cobalt Crusts (Co, Ti, REE)',
    centerLat: 28.6139,
    centerLon: 77.2090,
    minLat: 28.6128,
    maxLat: 28.6150,
    minLon: 77.2080,
    maxLon: 77.2102,
    primaryMineral: 'COBALT_CRUSTS',
  },
];

/**
 * Generate randomized mineral waypoints inside a bounding box
 */
export function generateRandomAreaWaypoints(
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  primaryMineral: MineralType = 'MASSIVE_SULFIDES',
  pointCount = 5
): SimWaypoint[] {
  const { minLat, maxLat, minLon, maxLon } = bounds;
  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;

  // Margin so points stay well inside the drawn sector
  const marginLat = latSpan * 0.12;
  const marginLon = lonSpan * 0.12;
  const usableMinLat = minLat + marginLat;
  const usableMaxLat = maxLat - marginLat;
  const usableMinLon = minLon + marginLon;
  const usableMaxLon = maxLon - marginLon;

  // Mineral richness distribution pool (1-2 Rich, 2 Moderate, 1 Low, 1 None)
  const richnessLevels: {
    richness: MineralRichnessLevel;
    score: number;
    magOffset: number;
    turbidity: number;
    mineral: MineralType;
    mineralName: string;
  }[] = [
    {
      richness: 'RICH',
      score: 0.94,
      magOffset: 66.5,
      turbidity: 5800,
      mineral: primaryMineral,
      mineralName: primaryMineral === 'MASSIVE_SULFIDES'
        ? 'High-Grade Copper-Zinc Massive Sulfide Deposit'
        : primaryMineral === 'COBALT_CRUSTS'
        ? 'Cobalt-Rich Ferromanganese Pavement (Grade A)'
        : 'High-Density Polymetallic Nodule Field (Mn-Ni-Cu)',
    },
    {
      richness: 'RICH',
      score: 0.88,
      magOffset: 52.0,
      turbidity: 4600,
      mineral: primaryMineral,
      mineralName: primaryMineral === 'MASSIVE_SULFIDES'
        ? 'Active Black Smoker Hydrothermal Chimney'
        : primaryMineral === 'COBALT_CRUSTS'
        ? 'Thick Cobalt-Titanium Crust Formation'
        : 'Dense Nodule Pavement Cluster',
    },
    {
      richness: 'MODERATE',
      score: 0.65,
      magOffset: 28.0,
      turbidity: 2400,
      mineral: primaryMineral === 'MASSIVE_SULFIDES' ? 'POLYMETALLIC_NODULES' : primaryMineral,
      mineralName: 'Moderate Mineral Prospect (Disseminated Ore)',
    },
    {
      richness: 'MODERATE',
      score: 0.54,
      magOffset: 18.5,
      turbidity: 1850,
      mineral: 'FERROMAGNETIC_ANOMALY',
      mineralName: 'Sub-surface Ferromagnetic Plume',
    },
    {
      richness: 'LOW',
      score: 0.32,
      magOffset: 8.5,
      turbidity: 1350,
      mineral: 'BACKGROUND',
      mineralName: 'Low Trace Mineralization (Peripheral Zone)',
    },
    {
      richness: 'NONE',
      score: 0.08,
      magOffset: 0.4,
      turbidity: 1080,
      mineral: 'BACKGROUND',
      mineralName: 'Barren Abyssal Sediment / Basalt Bedrock',
    },
  ];

  // Shuffle richness distribution slightly for genuine variety
  const shuffledRichness = [...richnessLevels].sort(() => Math.random() - 0.5);

  // Generate random points in a natural lawnmower/sweeping progression
  const rawPoints: { lat: number; lon: number; depth: number }[] = [];
  for (let i = 0; i < pointCount; i++) {
    // Distribute with slight random jitter across sectors
    const t = i / (pointCount - 1 || 1);
    const jitterLat = (Math.random() - 0.5) * latSpan * 0.35;
    const jitterLon = (Math.random() - 0.5) * lonSpan * 0.25;

    const lat = Math.min(usableMaxLat, Math.max(usableMinLat, usableMinLat + t * (usableMaxLat - usableMinLat) + jitterLat));
    // Alternate east-west for boat survey realism
    const lonBase = i % 2 === 0 ? usableMinLon + lonSpan * 0.25 : usableMinLon + lonSpan * 0.75;
    const lon = Math.min(usableMaxLon, Math.max(usableMinLon, lonBase + jitterLon));
    const depth = 14.0 + Math.random() * 3.5;

    rawPoints.push({ lat, lon, depth });
  }

  // Sort raw points to form an efficient traversal path
  rawPoints.sort((a, b) => a.lon - b.lon || a.lat - b.lat);

  return rawPoints.map((pt, idx) => {
    const rich = shuffledRichness[idx % shuffledRichness.length];
    const baseMag = 28.9;
    const expectedMag = Number((baseMag + rich.magOffset + (Math.random() - 0.5) * 1.5).toFixed(1));

    return {
      id: `WP-0${idx + 1}`,
      sequence: idx,
      latitude: Number(pt.lat.toFixed(6)),
      longitude: Number(pt.lon.toFixed(6)),
      targetDepth: Number(pt.depth.toFixed(1)),
      expectedMineral: rich.mineral,
      primaryMineralName: rich.mineralName,
      expectedMag,
      expectedTurbidity: Math.round(rich.turbidity + (Math.random() - 0.5) * 60),
      richness: rich.richness,
      richnessScore: rich.score,
      scanned: false,
      scanning: false,
      dwellRemainingSec: 5,
    };
  });
}

interface SimulationSurveyState {
  areas: SimSurveyArea[];
  selectedArea: SimSurveyArea | null;
  customBounds: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  isDrawing: boolean;
  drawPhase: SimDrawPhase;
  waypoints: SimWaypoint[];
  boatPosition: { lat: number; lon: number };
  activeWaypointIndex: number;
  status: SimSurveyStatus;
  dwellTimer: number;
  generatedCsvContent: string | null;
  isMlModelFed: boolean;
  showFullScreenMineralMap: boolean;
  selectedMineralPoint: SimWaypoint | null;

  // Actions
  setIsDrawing: (drawing: boolean) => void;
  setDrawnArea: (bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => void;
  selectPresetArea: (areaId: string) => void;
  clearArea: () => void;
  findWaypoints: (count?: number) => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  tickSimulation: () => void;
  setGeneratedCsv: (csv: string | null) => void;
  feedCsvToMl: () => void;
  setShowFullScreenMineralMap: (show: boolean) => void;
  setSelectedMineralPoint: (pt: SimWaypoint | null) => void;
}

const defaultArea = PRESET_AREAS[0];

export const useSimulationSurveyStore = create<SimulationSurveyState>((set, get) => ({
  areas: PRESET_AREAS,
  selectedArea: defaultArea,
  customBounds: {
    minLat: defaultArea.minLat,
    maxLat: defaultArea.maxLat,
    minLon: defaultArea.minLon,
    maxLon: defaultArea.maxLon,
  },
  isDrawing: false,
  drawPhase: 'area_drawn', // Ready to click "Find Waypoints"
  waypoints: [], // Initially empty until user presses "Find Waypoints"
  boatPosition: { lat: defaultArea.centerLat - 0.0008, lon: defaultArea.centerLon - 0.0008 },
  activeWaypointIndex: 0,
  status: 'idle',
  dwellTimer: 5,
  generatedCsvContent: null,
  isMlModelFed: false,
  showFullScreenMineralMap: false,
  selectedMineralPoint: null,

  setIsDrawing: (drawing) => {
    set({ isDrawing: drawing, drawPhase: drawing ? 'drawing' : get().drawPhase });
  },

  setDrawnArea: (bounds) => {
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLon = (bounds.minLon + bounds.maxLon) / 2;
    const area: SimSurveyArea = {
      id: `custom-${Date.now()}`,
      name: 'Custom Mapped Sector',
      description: 'Manually drawn bounding box area for autonomous marine exploration',
      centerLat,
      centerLon,
      minLat: bounds.minLat,
      maxLat: bounds.maxLat,
      minLon: bounds.minLon,
      maxLon: bounds.maxLon,
      primaryMineral: 'MASSIVE_SULFIDES',
    };

    set({
      selectedArea: area,
      customBounds: bounds,
      isDrawing: false,
      drawPhase: 'area_drawn',
      waypoints: [], // Clean slate waiting for "Find Waypoints" button
      boatPosition: { lat: bounds.minLat - 0.0004, lon: bounds.minLon - 0.0004 },
      activeWaypointIndex: 0,
      status: 'idle',
      dwellTimer: 5,
      generatedCsvContent: null,
      isMlModelFed: false,
      showFullScreenMineralMap: false,
    });
  },

  selectPresetArea: (areaId) => {
    const area = PRESET_AREAS.find((a) => a.id === areaId) || defaultArea;
    const bounds = {
      minLat: area.minLat,
      maxLat: area.maxLat,
      minLon: area.minLon,
      maxLon: area.maxLon,
    };
    set({
      selectedArea: area,
      customBounds: bounds,
      isDrawing: false,
      drawPhase: 'area_drawn',
      waypoints: [], // Empty until user presses "Find Waypoints"
      boatPosition: { lat: area.centerLat - 0.0008, lon: area.centerLon - 0.0008 },
      activeWaypointIndex: 0,
      status: 'idle',
      dwellTimer: 5,
      generatedCsvContent: null,
      isMlModelFed: false,
      showFullScreenMineralMap: false,
    });
  },

  clearArea: () => {
    set({
      selectedArea: null,
      customBounds: null,
      isDrawing: true,
      drawPhase: 'drawing',
      waypoints: [],
      activeWaypointIndex: 0,
      status: 'idle',
      dwellTimer: 5,
      generatedCsvContent: null,
      isMlModelFed: false,
      showFullScreenMineralMap: false,
    });
  },

  findWaypoints: (count = 5) => {
    const state = get();
    const bounds = state.customBounds || {
      minLat: defaultArea.minLat,
      maxLat: defaultArea.maxLat,
      minLon: defaultArea.minLon,
      maxLon: defaultArea.maxLon,
    };
    const mineral = state.selectedArea?.primaryMineral || 'MASSIVE_SULFIDES';

    const wps = generateRandomAreaWaypoints(bounds, mineral, count);
    const startBoat = wps.length > 0
      ? { lat: Number((wps[0].latitude - 0.00035).toFixed(6)), lon: Number((wps[0].longitude - 0.00035).toFixed(6)) }
      : { lat: (bounds.minLat + bounds.maxLat) / 2, lon: (bounds.minLon + bounds.maxLon) / 2 };

    set({
      waypoints: wps,
      boatPosition: startBoat,
      activeWaypointIndex: 0,
      drawPhase: 'waypoints_ready',
      status: 'idle',
      dwellTimer: 5,
      generatedCsvContent: null,
      isMlModelFed: false,
    });
  },

  startSimulation: () => {
    const state = get();
    if (state.waypoints.length === 0) {
      // Auto generate waypoints if not already present
      state.findWaypoints(5);
    }

    const currentWps = get().waypoints;
    const isCompleted = state.status === 'completed';

    if (isCompleted) {
      // Reset waypoints for fresh run
      const resetWps = currentWps.map((wp) => ({
        ...wp,
        scanned: false,
        scanning: false,
        dwellRemainingSec: 5,
      }));
      const startBoat = resetWps.length > 0
        ? { lat: Number((resetWps[0].latitude - 0.00035).toFixed(6)), lon: Number((resetWps[0].longitude - 0.00035).toFixed(6)) }
        : state.boatPosition;

      set({
        waypoints: resetWps,
        boatPosition: startBoat,
        activeWaypointIndex: 0,
        status: 'navigating',
        drawPhase: 'navigating',
        dwellTimer: 5,
        generatedCsvContent: null,
        isMlModelFed: false,
      });
    } else {
      set({
        status: 'navigating',
        drawPhase: 'navigating',
      });
    }
  },

  pauseSimulation: () => {
    set({ status: 'idle' });
  },

  resetSimulation: () => {
    const state = get();
    const resetWps = state.waypoints.map((wp) => ({
      ...wp,
      scanned: false,
      scanning: false,
      dwellRemainingSec: 5,
    }));
    const startBoat = resetWps.length > 0
      ? { lat: Number((resetWps[0].latitude - 0.00035).toFixed(6)), lon: Number((resetWps[0].longitude - 0.00035).toFixed(6)) }
      : state.boatPosition;

    set({
      waypoints: resetWps,
      boatPosition: startBoat,
      activeWaypointIndex: 0,
      status: 'idle',
      drawPhase: resetWps.length > 0 ? 'waypoints_ready' : 'area_drawn',
      dwellTimer: 5,
      generatedCsvContent: null,
      isMlModelFed: false,
      showFullScreenMineralMap: false,
    });
  },

  setGeneratedCsv: (csv) => set({ generatedCsvContent: csv }),

  feedCsvToMl: () => {
    set({ isMlModelFed: true, showFullScreenMineralMap: true });
  },

  setShowFullScreenMineralMap: (show) => set({ showFullScreenMineralMap: show }),

  setSelectedMineralPoint: (pt) => set({ selectedMineralPoint: pt }),

  tickSimulation: () => {
    const state = get();
    if (state.status !== 'navigating' && state.status !== 'scanning') return;

    const currentIdx = state.activeWaypointIndex;
    const targetWp = state.waypoints[currentIdx];

    if (!targetWp) {
      set({ status: 'completed', drawPhase: 'completed' });
      return;
    }

    if (state.status === 'navigating') {
      const dLat = targetWp.latitude - state.boatPosition.lat;
      const dLon = targetWp.longitude - state.boatPosition.lon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);

      if (dist < 0.00015) {
        // Arrived at waypoint! Start 5-second scanning dwell
        const updatedWps = [...state.waypoints];
        updatedWps[currentIdx] = {
          ...targetWp,
          scanning: true,
          dwellRemainingSec: 5,
        };
        set({
          boatPosition: { lat: targetWp.latitude, lon: targetWp.longitude },
          status: 'scanning',
          drawPhase: 'scanning',
          dwellTimer: 5,
          waypoints: updatedWps,
        });
      } else {
        // Move towards waypoint smoothly
        const stepRatio = 0.32;
        set({
          boatPosition: {
            lat: state.boatPosition.lat + dLat * stepRatio,
            lon: state.boatPosition.lon + dLon * stepRatio,
          },
        });
      }
    } else if (state.status === 'scanning') {
      const newDwell = state.dwellTimer - 1;
      const updatedWps = [...state.waypoints];

      if (newDwell <= 0) {
        // Waypoint scan complete! Mark as scanned
        updatedWps[currentIdx] = {
          ...targetWp,
          scanned: true,
          scanning: false,
          dwellRemainingSec: 0,
        };

        if (currentIdx < state.waypoints.length - 1) {
          // Advance to next waypoint
          set({
            waypoints: updatedWps,
            activeWaypointIndex: currentIdx + 1,
            status: 'navigating',
            drawPhase: 'navigating',
            dwellTimer: 5,
          });
        } else {
          // All waypoints scanned! Complete and generate CSV
          const header = 'timestamp_ms,sequence,depth_m,mag_mean,mag_min,mag_max,mag_std,temperature_c,ph,tds_ppm,turbidity_ntu,battery_v';
          const rows: string[] = [];
          let ts = 3700;
          let seq = 0;

          updatedWps.forEach((wp) => {
            ts += 2800;
            // Ambient entry reading
            rows.push(`${ts},${seq++},${(wp.targetDepth * 0.5).toFixed(1)},28.9,28.8,29.0,0.1,28.9,8.10,280.0,1080.0,3.78`);
            // Target core reading (reflecting mineral richness)
            ts += 3200;
            const magStd = Number((Math.abs(wp.expectedMag - 28.9) * 0.09).toFixed(2));
            const phVal = wp.richness === 'RICH' ? '5.92' : wp.richness === 'MODERATE' ? '6.85' : '8.05';
            const tempVal = wp.richness === 'RICH' ? '29.75' : wp.richness === 'MODERATE' ? '28.80' : '28.15';
            rows.push(`${ts},${seq++},${wp.targetDepth},${wp.expectedMag},${wp.expectedMag},${wp.expectedMag},${magStd},${tempVal},${phVal},360.0,${wp.expectedTurbidity}.0,3.72`);
          });

          const csvText = [header, ...rows].join('\n');
          set({
            waypoints: updatedWps,
            status: 'completed',
            drawPhase: 'completed',
            dwellTimer: 0,
            generatedCsvContent: csvText,
          });

          // Automatically trigger download of CSV file
          try {
            const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const areaName = state.selectedArea?.id || 'SURVEY_SECTOR';
            a.download = `SURV_SIM_${areaName.toUpperCase()}_${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch {
            // Handled
          }
        }
      } else {
        updatedWps[currentIdx] = {
          ...targetWp,
          dwellRemainingSec: newDwell,
        };
        set({
          dwellTimer: newDwell,
          waypoints: updatedWps,
        });
      }
    }
  },
}));



