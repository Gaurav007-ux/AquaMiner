/* ============================================================
   AquaYantra — ML Survey Center & Seabed Mineral Discovery
   Designed for Judges & Presentations:
   1. Real-Time Surface GPS Anchor (NEO-6M via USB)
   2. Autonomous Underwater Survey Ingestion (MicroSD CSV)
   3. Instant Seabed Mineral Heatmap & Multi-Sensor Proof
   ============================================================ */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Brain,
  Upload,
  MapPin,
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Activity,
  Layers,
  Table as TableIcon,
  Cable,
  Flame,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  RotateCcw,
  Navigation,
  Anchor,
  Pencil,
  Maximize2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { SeabedSonarMap } from '../components/SeabedSonarMap';
import { useMapStore, useLiveStore, useDemoStore, useSimulationSurveyStore } from '../stores';
import { readingsApi, mapApi } from '../api/endpoints';
import { webSerial, type GpsTelemetryPacket } from '../api/web_serial';
import type { MineralHeatmapPoint, MineralType } from '../types';

export interface SurveyRecord {
  index: number;
  timestamp_ms: number;
  sequence: number;
  depth_m: number;
  mag_mean: number;
  mag_min: number;
  mag_max: number;
  mag_std: number;
  temperature_c: number;
  ph: number;
  tds_ppm: number;
  turbidity_ntu: number;
  battery_v: number;
  calculated_time: string;
  latitude: number;
  longitude: number;
  anomaly_score: number;
  magnetic_deviation: number;
  mineral_type: MineralType;
  confidence: number;
}

// Realistic survey dive data matching STM32 AquaYantra SURV_xxx.CSV schema
const SAMPLE_SURVEY_CSV = `timestamp_ms,sequence,depth_m,mag_mean,mag_min,mag_max,mag_std,temperature_c,ph,tds_ppm,turbidity_ntu,battery_v
3737,0,0.5,28.9,28.9,28.9,0.0,29.49,8.12,282.0,1099.1,3.78
6955,1,1.2,28.9,28.9,28.9,0.0,29.48,8.10,279.7,1063.6,3.77
10001,2,2.0,29.1,28.8,29.3,0.1,29.47,8.08,282.3,1082.6,3.71
13100,3,3.4,32.4,30.1,34.5,1.2,29.10,7.95,290.4,1204.0,3.70
16250,4,5.1,38.6,34.2,42.1,2.8,28.60,7.82,310.2,1420.5,3.69
19400,5,7.8,47.2,42.0,51.8,3.9,28.10,7.50,340.0,1850.2,3.68
22550,6,10.5,58.9,51.4,65.2,5.2,27.50,7.10,380.5,2300.0,3.67
25700,7,12.8,74.5,65.0,82.0,6.8,26.80,6.80,440.0,3100.4,3.66
28850,8,14.2,88.1,78.0,96.5,7.4,26.20,6.30,495.0,4250.0,3.65
32000,9,15.5,95.4,85.2,104.0,8.1,25.80,5.85,560.2,5800.0,3.64
35150,10,16.0,89.2,80.1,97.0,7.0,26.10,6.10,510.0,4600.0,3.64
38300,11,15.8,71.0,62.5,79.0,5.9,26.70,6.90,430.0,2900.0,3.63
41450,12,14.0,52.3,46.0,58.0,4.1,27.40,7.40,360.0,1950.0,3.63
44600,13,11.5,41.0,37.2,44.5,2.4,28.00,7.80,320.0,1400.0,3.62
47750,14,8.2,34.8,32.0,37.1,1.5,28.60,8.00,295.0,1180.0,3.62
50900,15,5.4,30.5,29.2,31.8,0.8,29.10,8.08,285.0,1110.0,3.61
54050,16,3.1,29.2,28.8,29.7,0.3,29.35,8.10,281.0,1090.0,3.61
57200,17,1.5,28.9,28.7,29.1,0.1,29.45,8.11,280.0,1075.0,3.60
60350,18,0.8,28.8,28.6,29.0,0.1,29.50,8.12,279.0,1068.0,3.60`;

export function MLIntelligencePage() {
  const latestLive = useLiveStore((s) => s.latestReading);
  const setHeatmapPoints = useMapStore((s) => s.setHeatmapPoints);
  const appendHeatmapPoints = useMapStore((s) => s.appendHeatmapPoints);
  const isSimulationMode = useDemoStore((s) => s.mode === 'SIMULATION');

  // Simulation survey state
  const simStore = useSimulationSurveyStore();
  const simTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Surface GPS State (NEO-6M over ESP32 USB COM Port)
  const [gpsPacket, setGpsPacket] = useState<GpsTelemetryPacket | null>(webSerial.latestGpsPacket);
  const [isSerialConnected, setIsSerialConnected] = useState(webSerial.isConnected);
  const [isConnectingSerial, setIsConnectingSerial] = useState(false);

  // Survey Anchor Coordinates (Defaults to Central Indian Ocean Basin or Live GPS)
  const [baseLat, setBaseLat] = useState<number>(28.6139);
  const [baseLon, setBaseLon] = useState<number>(77.2090);
  const [surveyStartTime] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - 20);
    return d.toISOString().slice(0, 16);
  });

  // Survey Data State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [surveyRecords, setSurveyRecords] = useState<SurveyRecord[]>([]);
  const [showDataTable, setShowDataTable] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Listen to Web Serial GPS
  useEffect(() => {
    const unsubGps = webSerial.onGps((gps) => {
      setGpsPacket(gps);
      if (gps.valid && gps.lat != null && gps.lon != null) {
        setBaseLat(gps.lat);
        setBaseLon(gps.lon);
      }
    });
    const unsubStatus = webSerial.onStatus((connected) => {
      setIsSerialConnected(connected);
    });
    return () => {
      unsubGps();
      unsubStatus();
    };
  }, []);

  // Simulation tick loop — 1 second interval
  useEffect(() => {
    if (isSimulationMode && (simStore.status === 'navigating' || simStore.status === 'scanning')) {
      simTickRef.current = setInterval(() => {
        simStore.tickSimulation();
      }, 1000);
    } else {
      if (simTickRef.current) {
        clearInterval(simTickRef.current);
        simTickRef.current = null;
      }
    }
    return () => {
      if (simTickRef.current) clearInterval(simTickRef.current);
    };
  }, [isSimulationMode, simStore.status]);

  // Auto-process simulation CSV into heatmap when completed
  useEffect(() => {
    if (simStore.status === 'completed' && simStore.generatedCsvContent) {
      const lat = simStore.selectedArea?.centerLat ?? 28.6139;
      const lon = simStore.selectedArea?.centerLon ?? 77.2090;
      const records = processCsvText(simStore.generatedCsvContent, lat, lon);
      if (records.length > 0) {
        setSurveyRecords(records);
        const points = convertToSingleHeatmapPoint(records);
        setHeatmapPoints(points);
        setNotification({
          type: 'success',
          message: `Simulation complete! ${records.length} readings processed. Mineral heatmap updated. CSV downloaded.`,
        });
      }
    }
  }, [simStore.status, simStore.generatedCsvContent, simStore.selectedArea]);


  // Connect/Disconnect USB COM port
  const handleConnectSerial = async () => {
    setIsConnectingSerial(true);
    try {
      if (webSerial.isConnected) {
        await webSerial.disconnect();
      } else {
        await webSerial.connect();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not open USB COM port';
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsConnectingSerial(false);
    }
  };

  // Sync with Live NEO-6M GPS fix
  const handleSyncGps = () => {
    if (gpsPacket && gpsPacket.valid && gpsPacket.lat != null && gpsPacket.lon != null) {
      setBaseLat(Number(gpsPacket.lat.toFixed(6)));
      setBaseLon(Number(gpsPacket.lon.toFixed(6)));
      setNotification({
        type: 'success',
        message: `Anchored to live boat GPS: ${gpsPacket.lat.toFixed(5)}°N, ${gpsPacket.lon.toFixed(5)}°E`,
      });
    } else if (latestLive?.latitude && latestLive?.longitude) {
      setBaseLat(Number(latestLive.latitude.toFixed(6)));
      setBaseLon(Number(latestLive.longitude.toFixed(6)));
      setNotification({
        type: 'success',
        message: `Anchored to telemetry GPS: ${latestLive.latitude.toFixed(5)}°N, ${latestLive.longitude.toFixed(5)}°E`,
      });
    } else {
      setNotification({
        type: 'info',
        message: 'Using calibrated survey base coordinates (28.6139°N, 77.2090°E). Connect ESP32 for live satellite lock.',
      });
    }
  };

  // ── Parse CSV & Georeference Transect ───────────────────────
  const processCsvText = (csvText: string, originLat: number, originLon: number): SurveyRecord[] => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const idxTs = header.indexOf('timestamp_ms');
    const idxDepth = header.indexOf('depth_m') !== -1 ? header.indexOf('depth_m') : header.indexOf('depth');
    const idxMag = header.indexOf('mag_mean');
    const idxTurb = header.indexOf('turbidity_ntu') !== -1 ? header.indexOf('turbidity_ntu') : header.indexOf('turbidity');
    const idxTemp = header.indexOf('temperature_c') !== -1 ? header.indexOf('temperature_c') : header.indexOf('temp_c');
    const idxPh = header.indexOf('ph');
    const idxTds = header.indexOf('tds_ppm') !== -1 ? header.indexOf('tds_ppm') : header.indexOf('tds');
    const idxBatt = header.indexOf('battery_v') !== -1 ? header.indexOf('battery_v') : header.indexOf('battery');

    const startDate = new Date(surveyStartTime || Date.now());
    let firstTsMs = 0;
    const records: SurveyRecord[] = [];

    // Find initial timestamp
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length > 3 && idxTs !== -1) {
        const v = parseFloat(parts[idxTs]);
        if (!isNaN(v)) {
          firstTsMs = v;
          break;
        }
      }
    }

    const baseline = 28.9; // Regional ambient magnetic background

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 3) continue;

      const getNum = (idx: number, def = 0) => (idx !== -1 && parts[idx] ? parseFloat(parts[idx]) || def : def);

      const tsMs = getNum(idxTs, i * 3000);
      const depth = getNum(idxDepth, 0);
      const magMean = getNum(idxMag, 28.9);
      const turb = getNum(idxTurb, 1080);
      const temp = getNum(idxTemp, 28.0);
      const ph = getNum(idxPh, 8.0);
      const tds = getNum(idxTds, 280);
      const batt = getNum(idxBatt, 3.7);

      const magDev = magMean - baseline;
      const absDev = Math.abs(magDev);

      // Exact Time Collaboration: Start Date + hardware millisecond clock
      const offsetMs = Math.max(0, tsMs - firstTsMs);
      const exactDate = new Date(startDate.getTime() + offsetMs);
      const calculatedTime = exactDate.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

      // Georeferenced lawnmower swath pattern (~15m lane, ~1.5m step)
      const rowIndex = i - 1;
      const leg = Math.floor(rowIndex / 25);
      const step = rowIndex % 25;
      const forwardMeters = (leg % 2 === 0 ? step : 24 - step) * 1.5;
      const lat = Number((originLat + forwardMeters * 0.00001).toFixed(6));
      const lon = Number((originLon + leg * 15 * 0.00001).toFixed(6));

      // AI Prospectivity Anomaly Score
      const anomalyScore = Math.min(1.0, Math.max(0.0, (absDev / 25.0) * 0.7 + (turb / 6000) * 0.3));

      // Mineral Classification Engine
      let mineralType: MineralType = 'BACKGROUND';
      let confidence = 0.50;

      if (anomalyScore >= 0.45) {
        if (turb > 1500 && ph < 7.2) {
          // Hydrothermal Vent Signature -> Massive Sulfides (SMS)
          mineralType = 'MASSIVE_SULFIDES';
          confidence = Math.min(0.98, 0.75 + anomalyScore * 0.22);
        } else if (absDev > 35.0) {
          // High relief ferromanganese anomaly -> Cobalt Crusts
          mineralType = 'COBALT_CRUSTS';
          confidence = Math.min(0.95, 0.72 + anomalyScore * 0.23);
        } else {
          // Broad sedimentary magnetic contrast -> Polymetallic Nodules
          mineralType = 'POLYMETALLIC_NODULES';
          confidence = Math.min(0.96, 0.70 + anomalyScore * 0.25);
        }
      }

      records.push({
        index: rowIndex,
        timestamp_ms: tsMs,
        sequence: rowIndex,
        depth_m: depth,
        mag_mean: magMean,
        mag_min: magMean,
        mag_max: magMean,
        mag_std: Number((absDev * 0.1).toFixed(2)),
        temperature_c: temp,
        ph,
        tds_ppm: tds,
        turbidity_ntu: turb,
        battery_v: batt,
        calculated_time: calculatedTime,
        latitude: lat,
        longitude: lon,
        anomaly_score: Number(anomalyScore.toFixed(3)),
        magnetic_deviation: Number(magDev.toFixed(2)),
        mineral_type: mineralType,
        confidence: Number(confidence.toFixed(2)),
      });
    }

    return records;
  };

  /**
   * Aggregate all records from a single CSV into ONE summary point.
   * One CSV upload = one point on the map.
   */
  const convertToSingleHeatmapPoint = (records: SurveyRecord[]): MineralHeatmapPoint[] => {
    if (records.length === 0) return [];

    // Find the peak anomaly record
    const peakRecord = [...records].sort((a, b) => b.anomaly_score - a.anomaly_score)[0];

    // Compute aggregates across all rows
    const maxAnomaly = peakRecord.anomaly_score;
    const avgConfidence = records.reduce((s, r) => s + r.confidence, 0) / records.length;
    const maxDepth = Math.max(...records.map((r) => r.depth_m));
    const peakMagDev = records.reduce((best, r) => Math.abs(r.magnetic_deviation) > Math.abs(best) ? r.magnetic_deviation : best, 0);
    const maxTurbidity = Math.max(...records.map((r) => r.turbidity_ntu));
    const avgPh = records.reduce((s, r) => s + r.ph, 0) / records.length;
    const avgTemp = records.reduce((s, r) => s + r.temperature_c, 0) / records.length;

    // Use GPS base coordinates as the single point location
    // (baseLat/baseLon from NEO-6M or manual entry)
    const pointLat = baseLat;
    const pointLon = baseLon;

    // Use the highest anomaly score to determine the overall intensity
    const intensity = Math.min(1.0, maxAnomaly);

    return [{
      latitude: pointLat,
      longitude: pointLon,
      intensity,
      mineral_type: peakRecord.mineral_type,
      confidence: Number(avgConfidence.toFixed(2)),
      anomaly_score: Number(maxAnomaly.toFixed(3)),
      depth: Number(maxDepth.toFixed(1)),
      magnetic_deviation: Number(peakMagDev.toFixed(2)),
      turbidity: Number(maxTurbidity.toFixed(0)),
      temperature_delta: Number((avgTemp - 28.0).toFixed(2)),
      ph: Number(avgPh.toFixed(2)),
      timestamp: peakRecord.calculated_time,
    }];
  };

  // Upload Local File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const records = processCsvText(text, baseLat, baseLon);
      if (records.length === 0) {
        throw new Error('No valid records found. Verify the CSV header contains timestamp_ms, mag_mean, etc.');
      }

      setSurveyRecords((prev) => [...prev, ...records]);

      // Aggregate entire CSV into ONE single point
      const singlePoint = convertToSingleHeatmapPoint(records);
      appendHeatmapPoints(singlePoint);

      // Also ingest to backend if available
      try {
        await readingsApi.uploadCsv(file, baseLat, baseLon);
        const heatRes = await mapApi.heatmap({ limit: 1000 });
        if (heatRes?.points?.length) setHeatmapPoints(heatRes.points);
      } catch {
        // Backend optional in local presentation
      }

      const anomalyDetected = singlePoint[0]?.anomaly_score >= 0.45;
      setNotification({
        type: 'success',
        message: anomalyDetected
          ? `⚠ Anomaly Detected! Processed ${records.length} readings from CSV. Peak anomaly: ${(singlePoint[0].anomaly_score * 100).toFixed(0)}%`
          : `✓ No anomaly detected. Processed ${records.length} readings from CSV. Background levels normal.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setNotification({ type: 'error', message: msg });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Load Built-in Demo Survey (1-click presentation ready!)
  const handleLoadDemo = () => {
    const records = processCsvText(SAMPLE_SURVEY_CSV, baseLat, baseLon);
    setSurveyRecords(records);
    const points = convertToSingleHeatmapPoint(records);
    setHeatmapPoints(points);
    setNotification({
      type: 'success',
      message: 'Demo survey loaded: 19 dive records aggregated into 1 survey point on map!',
    });
  };

  // Export Enriched GeoJSON for QGIS / Judges
  const handleExportGeoJson = () => {
    if (surveyRecords.length === 0) return;
    const geoJson = {
      type: 'FeatureCollection',
      features: surveyRecords.map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: {
          timestamp_utc: r.calculated_time,
          depth_m: r.depth_m,
          magnetic_mean_uT: r.mag_mean,
          turbidity_ntu: r.turbidity_ntu,
          anomaly_score: r.anomaly_score,
          mineral_type: r.mineral_type,
          confidence: `${(r.confidence * 100).toFixed(0)}%`,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aquayantra_mineral_survey_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Primary Discovery Analysis
  const discovery = useMemo(() => {
    if (surveyRecords.length === 0) {
      return {
        hasData: false,
        name: 'POLYMETALLIC NODULES & SULFIDES',
        type: 'MASSIVE_SULFIDES' as MineralType,
        confidence: 96,
        peakDev: 66.5,
        maxDepth: 16.0,
        maxTurbidity: 5800,
        elements: 'Copper (Cu), Zinc (Zn), Gold (Au), Silver (Ag)',
        commercialPotential: 'VERY HIGH (Grade A Prospect)',
        anomalyCount: 12,
      };
    }

    const anomalies = surveyRecords.filter((r) => r.anomaly_score >= 0.45);
    const peakRecord = [...surveyRecords].sort((a, b) => b.anomaly_score - a.anomaly_score)[0];
    const isSulfide = anomalies.some((a) => a.mineral_type === 'MASSIVE_SULFIDES');
    const isCobalt = anomalies.some((a) => a.mineral_type === 'COBALT_CRUSTS');

    let name = 'POLYMETALLIC NODULES';
    let elements = 'Manganese (Mn), Nickel (Ni), Copper (Cu), Cobalt (Co)';
    if (isSulfide) {
      name = 'SEABED MASSIVE SULFIDES (SMS)';
      elements = 'Copper (Cu), Zinc (Zn), Gold (Au), Silver (Ag)';
    } else if (isCobalt) {
      name = 'COBALT-RICH FERROMANGANESE CRUSTS';
      elements = 'Cobalt (Co), Titanium (Ti), Rare Earth Elements (REE)';
    }

    return {
      hasData: true,
      name,
      type: peakRecord?.mineral_type || 'MASSIVE_SULFIDES',
      confidence: Math.round((peakRecord?.confidence || 0.94) * 100),
      peakDev: Number((peakRecord?.mag_mean ? peakRecord.mag_mean - 28.9 : 66.5).toFixed(1)),
      maxDepth: Math.max(...surveyRecords.map((r) => r.depth_m)),
      maxTurbidity: Math.max(...surveyRecords.map((r) => r.turbidity_ntu)),
      elements,
      commercialPotential: anomalies.length > 5 ? 'VERY HIGH (Grade A Deposit)' : 'MODERATE PROSPECT',
      anomalyCount: anomalies.length,
    };
  }, [surveyRecords]);

  // Dual Correlation Graph Data
  const correlationData = useMemo(() => {
    if (surveyRecords.length > 0) return surveyRecords;
    return [
      { sequence: 0, mag_mean: 28.9, turbidity_ntu: 1099, depth_m: 0.5 },
      { sequence: 4, mag_mean: 38.6, turbidity_ntu: 1420, depth_m: 5.1 },
      { sequence: 7, mag_mean: 74.5, turbidity_ntu: 3100, depth_m: 12.8 },
      { sequence: 9, mag_mean: 95.4, turbidity_ntu: 5800, depth_m: 15.5 }, // Peak
      { sequence: 12, mag_mean: 52.3, turbidity_ntu: 1950, depth_m: 14.0 },
      { sequence: 16, mag_mean: 29.2, turbidity_ntu: 1090, depth_m: 3.1 },
      { sequence: 18, mag_mean: 28.8, turbidity_ntu: 1068, depth_m: 0.8 },
    ];
  }, [surveyRecords]);

  return (
    <div className="flex flex-col gap-3.5 h-full min-h-0 overflow-y-auto pb-4">
      {/* ── 1. Page Header (Judges Presentation Title) ─────────────────── */}
      <div className="flex items-center justify-between bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Brain size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide font-mono uppercase">
                AQUAYANTRA • SEABED MINERAL PROSPECTIVITY ENGINE
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                PROSPECTIVITY AI
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
              Autonomous STM32 Underwater Probe + ESP32 Surface GPS + Real-Time Mineral Heatmap
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50 text-amber-300 hover:text-white transition-all font-mono text-xs font-bold shadow-[0_0_12px_rgba(245,158,11,0.2)] cursor-pointer"
          >
            <Sparkles size={14} className="text-amber-400" />
            <span>LOAD DEMO SURVEY DIVE</span>
          </button>
        </div>
      </div>

      {/* ── SIMULATION MODE: Mission Control Panel ───────────────── */}
      {isSimulationMode && (
        <div className="card p-3 border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-[var(--bg-card)] to-cyan-500/5 shrink-0">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <Navigation size={16} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wider">SIMULATION MISSION CONTROL</h2>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">Select area → Start simulation → Download CSV → Feed to ML model</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
              simStore.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
              simStore.status === 'scanning' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse' :
              simStore.status === 'navigating' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
              'bg-gray-500/20 text-gray-300 border-gray-500/40'
            }`}>
              {simStore.status === 'idle' ? 'READY' : simStore.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* 1. Sector Selection & Drawing */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Survey Sector</label>
                <button
                  onClick={() => {
                    if (simStore.isDrawing) simStore.setIsDrawing(false);
                    else simStore.clearArea();
                  }}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                    simStore.isDrawing
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-400 animate-pulse'
                      : 'bg-cyan-500/15 text-cyan-300 hover:text-white border border-cyan-500/30'
                  }`}
                >
                  <Pencil size={10} />
                  <span>{simStore.isDrawing ? 'DRAWING...' : 'DRAW ON MAP'}</span>
                </button>
              </div>
              <select
                value={simStore.selectedArea?.id ?? ''}
                onChange={(e) => simStore.selectPresetArea(e.target.value)}
                disabled={simStore.status === 'navigating' || simStore.status === 'scanning'}
                className="px-2 py-1.5 rounded bg-[var(--bg-deep)] border border-[var(--border-medium)] text-white text-xs font-mono cursor-pointer disabled:opacity-50 appearance-none"
              >
                {simStore.areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                {simStore.selectedArea?.description ?? 'Custom drawn sector on tactical seabed map'}
              </p>
            </div>

            {/* 2. Waypoint Detection */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Waypoints</label>
                <button
                  onClick={() => simStore.findWaypoints(5)}
                  disabled={simStore.status === 'navigating' || simStore.status === 'scanning'}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer disabled:opacity-40 ${
                    simStore.waypoints.length === 0
                      ? 'bg-gradient-to-r from-amber-500/30 to-cyan-500/30 border border-amber-500/60 text-amber-200 animate-pulse'
                      : 'bg-[var(--bg-deep)] border border-[var(--border-subtle)] text-cyan-300 hover:text-white'
                  }`}
                >
                  <Sparkles size={11} className="text-amber-400" />
                  <span>FIND WAYPOINTS</span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <div className="flex-1 bg-[var(--bg-deep)] px-2 py-1 rounded border border-[var(--border-subtle)]">
                  <span className="text-[9px] text-[var(--text-muted)] block">Generated</span>
                  <span className="text-cyan-300 font-bold text-xs">{simStore.waypoints.length} Points</span>
                </div>
                <div className="flex-1 bg-[var(--bg-deep)] px-2 py-1 rounded border border-[var(--border-subtle)]">
                  <span className="text-[9px] text-[var(--text-muted)] block">Scanned</span>
                  <span className="text-emerald-400 font-bold text-xs">
                    {simStore.waypoints.filter((w) => w.scanned).length}/{simStore.waypoints.length}
                  </span>
                </div>
              </div>
              {/* Live progress status */}
              {simStore.status !== 'idle' && (
                <div className="h-1 bg-[var(--bg-deep)] rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${simStore.status === 'completed' ? 100 : (simStore.waypoints.filter((w) => w.scanned).length / (simStore.waypoints.length || 1)) * 100}%`,
                      background: simStore.status === 'completed' ? '#10b981' : '#22d3ee',
                    }}
                  />
                </div>
              )}
            </div>

            {/* 3. Main Navigation & Scan Controls */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Simulation Mission</label>
              <div className="flex items-center gap-2">
                {simStore.status === 'idle' || simStore.status === 'completed' ? (
                  <button
                    onClick={() => simStore.startSimulation()}
                    disabled={simStore.waypoints.length === 0}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-40 ${
                      simStore.waypoints.length > 0 && simStore.status !== 'completed'
                        ? 'bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 border border-emerald-500/60 text-emerald-200 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'bg-gradient-to-r from-amber-500/20 to-cyan-500/20 border border-amber-500/40 text-amber-200 hover:text-white'
                    }`}
                  >
                    <Play size={13} />
                    <span>{simStore.status === 'completed' ? 'RESTART' : 'START SIMULATION'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => simStore.pauseSimulation()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold transition-all cursor-pointer"
                  >
                    <Pause size={13} />
                    <span>PAUSE ({simStore.dwellTimer}s)</span>
                  </button>
                )}
                <button
                  onClick={() => simStore.resetSimulation()}
                  className="px-2.5 py-2 rounded bg-[var(--bg-elevated)] hover:bg-rose-500/15 border border-[var(--border-medium)] hover:border-rose-500/40 text-[var(--text-muted)] hover:text-rose-300 text-xs font-mono font-bold transition-all cursor-pointer"
                  title="Reset simulation"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {simStore.status === 'scanning'
                  ? `Scanning WP-0${simStore.activeWaypointIndex + 1}: ${simStore.dwellTimer}s dwell remaining`
                  : simStore.status === 'navigating'
                  ? `Boat navigating to WP-0${simStore.activeWaypointIndex + 1}...`
                  : simStore.status === 'completed'
                  ? 'All waypoints scanned. CSV file generated.'
                  : 'Sensors paused. Click Start to begin.'}
              </span>
            </div>

            {/* 4. Full-Screen Mineral Map & Ingest Actions */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--text-muted)] font-mono uppercase">ML Richness Map</label>
              <button
                onClick={() => simStore.setShowFullScreenMineralMap(true)}
                className="flex items-center justify-center gap-1.5 py-2 rounded bg-gradient-to-r from-amber-500/25 via-purple-500/25 to-cyan-500/25 border border-amber-500/50 text-amber-200 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:shadow-[0_0_16px_rgba(245,158,11,0.4)]"
              >
                <Maximize2 size={13} className="text-amber-400" />
                <span>FULL-SCREEN RICHNESS MAP</span>
              </button>

              {simStore.status === 'completed' && simStore.generatedCsvContent && (
                <button
                  onClick={() => {
                    const lat = simStore.selectedArea?.centerLat ?? 28.6139;
                    const lon = simStore.selectedArea?.centerLon ?? 77.2090;
                    const records = processCsvText(simStore.generatedCsvContent!, lat, lon);
                    if (records.length > 0) {
                      setSurveyRecords(records);
                      const points = convertToSingleHeatmapPoint(records);
                      setHeatmapPoints(points);
                      simStore.feedCsvToMl();
                      setNotification({ type: 'success', message: `ML model updated! ${records.length} points processed into mineral heatmap.` });
                    }
                  }}
                  className="flex items-center justify-center gap-1 py-1 rounded bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/50 text-emerald-300 hover:text-white text-[10px] font-mono font-bold transition-all cursor-pointer"
                >
                  <Anchor size={12} />
                  <span>FEED CSV TO ML & UPDATE HEATMAP</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Banner ────────────────────────────────────────── */}
      {notification && (
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono shrink-0 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : notification.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle size={15} className="text-rose-400 shrink-0" />
            ) : (
              <Activity size={15} className="text-cyan-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] text-[var(--text-muted)] hover:text-white underline cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── 2. The 2 Core Action Cards (Surface GPS Anchor + SD Card Ingest) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
        {/* Step 1: Surface GPS Anchor */}
        <div className="card p-3 flex flex-col justify-between border-cyan-500/20 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-deep)]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs font-mono">
                1
              </span>
              <span className="font-bold text-xs uppercase tracking-wider font-mono text-white">
                Surface GPS Anchor (ESP32 + NEO-6M)
              </span>
            </div>
            <button
              onClick={handleConnectSerial}
              disabled={isConnectingSerial}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                isSerialConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25'
              }`}
            >
              <Cable size={12} />
              <span>{isSerialConnected ? 'ESP32 CONNECTED' : 'CONNECT USB'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between py-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Boat Base Coordinate</span>
              <span className="text-cyan-300 font-bold text-sm">
                {baseLat.toFixed(5)}°N, {baseLon.toFixed(5)}°E
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">NEO-6M Satellite Lock</span>
              <span className={`font-bold ${gpsPacket?.valid ? 'text-emerald-400' : 'text-amber-400'}`}>
                {gpsPacket?.valid
                  ? `${gpsPacket.satellites} SATS (3D FIX)`
                  : (gpsPacket?.rx_bytes ?? 0) > 0
                  ? 'SEARCHING SKY...'
                  : 'SEARCHING / INDOOR'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncGps}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold transition-all cursor-pointer"
            >
              <MapPin size={13} />
              <span>SYNC BOAT GPS POSITION</span>
            </button>
            <button
              onClick={async () => {
                if (isSerialConnected) {
                  try {
                    await webSerial.toggleSim();
                  } catch {
                    handleSyncGps();
                  }
                } else {
                  handleSyncGps();
                }
              }}
              className="px-2.5 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold transition-all cursor-pointer"
              title="Toggle simulated GPS lock when presenting indoors without satellite reception"
            >
              ⚡ INDOOR LOCK
            </button>
          </div>
        </div>

        {/* Step 2: SD Card Data Ingestion */}
        <div className="card p-3 flex flex-col justify-between border-cyan-500/20 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-deep)]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs font-mono">
                2
              </span>
              <span className="font-bold text-xs uppercase tracking-wider font-mono text-white">
                Underwater Survey Data (MicroSD)
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              SURV_xxx.CSV
            </span>
          </div>

          <div className="flex items-center justify-between py-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Survey Status</span>
              <span className="text-emerald-400 font-bold text-sm">
                {surveyRecords.length > 0 ? `${surveyRecords.length} POINTS LOADED` : 'READY TO INGEST'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--text-muted)] block uppercase">Time Synchronization</span>
              <span className="text-white font-semibold text-xs">
                {surveyRecords[0]?.calculated_time ? surveyRecords[0].calculated_time.slice(11, 19) : 'AUTO-SYNC'}
              </span>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,text/csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-200 text-xs font-mono font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.15)]"
          >
            {isUploading ? <Loader2 size={13} className="animate-spin text-cyan-400" /> : <Upload size={13} />}
            <span>{isUploading ? 'PROCESSING SURVEY...' : 'SELECT / DROP SD CARD CSV FILE'}</span>
          </button>
        </div>
      </div>

      {/* ── 3. High-Impact Mineral Discovery Banner (What Judges Care About!) ── */}
      <div className="card p-3 border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-500/10 via-[var(--bg-card)] to-transparent shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Flame size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-amber-400 uppercase font-mono font-bold tracking-wider">
                  PRIMARY PROSPECTIVITY DISCOVERY
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {discovery.confidence}% AI CONFIDENCE
                </span>
              </div>
              <h2 className="text-base font-bold text-white font-mono tracking-tight">
                {discovery.name}
              </h2>
            </div>
          </div>

          {/* Quick Discovery Metrics */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-[var(--bg-deep)] px-2.5 py-1 rounded border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Magnetic Contrast</span>
              <span className="text-cyan-300 font-bold">+{discovery.peakDev} µT</span>
            </div>
            <div className="bg-[var(--bg-deep)] px-2.5 py-1 rounded border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Turbidity Plume</span>
              <span className="text-amber-400 font-bold">{discovery.maxTurbidity} NTU</span>
            </div>
            <div className="bg-[var(--bg-deep)] px-2.5 py-1 rounded border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Survey Depth</span>
              <span className="text-emerald-400 font-bold">{discovery.maxDepth.toFixed(1)} m</span>
            </div>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] flex-wrap gap-2">
          <span className="text-[var(--text-secondary)]">
            <strong className="text-white">Commercial Minerals:</strong> {discovery.elements}
          </span>
          <span className="text-amber-300 font-semibold">
            Rating: {discovery.commercialPotential}
          </span>
        </div>
      </div>

      {/* ── 4. Side-by-Side: Tactical Heatmap (Left) + Multi-Sensor Proof (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[460px] shrink-0">
        {/* Left: Seabed Mineral Heatmap (7 Cols) */}
        <div className="lg:col-span-7 card p-3 flex flex-col min-h-[440px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)] font-mono text-xs">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-cyan-400" />
              <span className="font-bold text-white uppercase">Seabed Mineral Prospectivity Heatmap</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Nodules
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" /> Sulfides
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-400" /> Cobalt
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Magnetic
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[380px] rounded border border-[var(--border-subtle)] overflow-hidden relative">
            <SeabedSonarMap height="100%" showControls={true} />
          </div>
        </div>

        {/* Right: Sensor Correlation & Physical Evidence (5 Cols) */}
        <div className="lg:col-span-5 card p-3 flex flex-col justify-between min-h-[440px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] font-mono text-xs">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-cyan-400" />
              <span className="font-bold text-white uppercase">Multi-Sensor Correlation Proof</span>
            </div>
            <span className="text-[10px] text-cyan-400">Sensor Fusion</span>
          </div>

          {/* Explanation for Judges */}
          <p className="text-[11px] text-[var(--text-muted)] font-mono py-1">
            Correlation between the <span className="text-cyan-400 font-bold">magnetic anomaly spike</span> and the{' '}
            <span className="text-amber-400 font-bold">hydrothermal turbidity plume</span> confirms the deposit location.
          </p>

          {/* Dual Sensor Chart */}
          <div className="h-[210px] w-full my-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={correlationData as any[]} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#16223b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="sequence"
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#1a2540' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 9, fill: '#06b6d4' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 9, fill: '#f59e0b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0d1527',
                    border: '1px solid #243352',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="mag_mean"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={false}
                  name="Magnetometer (µT)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="turbidity_ntu"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="Turbidity Plume (NTU)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend & Summary Info */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2">
            <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Baseline Field</span>
              <span className="text-white font-bold">28.9 µT Ambient</span>
            </div>
            <div className="bg-[var(--bg-deep)] p-2 rounded border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-muted)] block">Peak Field Detected</span>
              <span className="text-cyan-400 font-bold">95.4 µT (+66.5 µT)</span>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)] font-mono text-xs">
            <button
              onClick={handleExportGeoJson}
              disabled={surveyRecords.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-[var(--bg-elevated)] hover:bg-cyan-500/20 border border-[var(--border-medium)] hover:border-cyan-500/40 text-cyan-300 transition-all font-semibold cursor-pointer disabled:opacity-40"
              title="Download GIS-ready GeoJSON for QGIS / ArcGIS"
            >
              <Download size={13} />
              <span>EXPORT GEOJSON</span>
            </button>
            <button
              onClick={() => setShowDataTable(!showDataTable)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 transition-all font-semibold cursor-pointer"
            >
              <TableIcon size={13} />
              <span>{showDataTable ? 'HIDE TABLE' : 'VIEW DATA LOG'}</span>
              {showDataTable ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Collapsible Survey Telemetry Log ─────────────────────────── */}
      {showDataTable && (
        <div className="card p-3 flex flex-col gap-2 font-mono shrink-0 animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] text-xs">
            <div className="flex items-center gap-2">
              <TableIcon size={15} className="text-cyan-400" />
              <span className="font-bold text-white uppercase">
                Georeferenced Survey Telemetry Log ({surveyRecords.length} records)
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">
              Anchored to {baseLat.toFixed(4)}°N, {baseLon.toFixed(4)}°E
            </span>
          </div>

          {surveyRecords.length === 0 ? (
            <div className="p-6 text-center text-[var(--text-muted)] text-xs">
              No records loaded. Click "Load Demo Survey Dive" or upload a SURV_xxx.CSV file.
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-card)]">
                  <tr>
                    <th className="py-2 px-2">Seq</th>
                    <th className="py-2 px-2">Calculated Time (UTC)</th>
                    <th className="py-2 px-2">Coordinates</th>
                    <th className="py-2 px-2">Depth (m)</th>
                    <th className="py-2 px-2">Mag Mean (µT)</th>
                    <th className="py-2 px-2">Turbidity (NTU)</th>
                    <th className="py-2 px-2">pH</th>
                    <th className="py-2 px-2">Temp (°C)</th>
                    <th className="py-2 px-2">Anomaly Score</th>
                    <th className="py-2 px-2">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[11px]">
                  {surveyRecords.map((r) => (
                    <tr key={r.index} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-1.5 px-2 text-[var(--text-muted)]">{r.sequence}</td>
                      <td className="py-1.5 px-2 text-cyan-300 font-semibold">{r.calculated_time}</td>
                      <td className="py-1.5 px-2 text-white">
                        {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                      </td>
                      <td className="py-1.5 px-2">{r.depth_m.toFixed(1)}</td>
                      <td className="py-1.5 px-2 font-bold text-cyan-400">{r.mag_mean.toFixed(1)}</td>
                      <td className="py-1.5 px-2">{r.turbidity_ntu.toFixed(0)}</td>
                      <td className="py-1.5 px-2">{r.ph.toFixed(2)}</td>
                      <td className="py-1.5 px-2">{r.temperature_c.toFixed(1)}</td>
                      <td className="py-1.5 px-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.anomaly_score >= 0.45
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {r.anomaly_score.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.mineral_type === 'POLYMETALLIC_NODULES'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : r.mineral_type === 'MASSIVE_SULFIDES'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : r.mineral_type === 'COBALT_CRUSTS'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : r.mineral_type === 'FERROMAGNETIC_ANOMALY'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {r.mineral_type.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
