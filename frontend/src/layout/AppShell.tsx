/* ============================================================
   AquaYantra — App Shell
   Top bar + sidebar + routed main content
   Strict separation between REAL HARDWARE MODE and SIMULATION MODE
   ============================================================ */

import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useDemoStore, useLiveStore, useMissionStore, useDeviceStore, useMapStore, useSimulationSurveyStore } from '../stores';
import { generateTelemetry, resetGenerator, DEMO_MISSION, DEMO_DEPLOYMENT, DEMO_DEVICE, DEMO_CALIBRATION } from '../demo/data';
import { readingsApi, mapApi } from '../api/endpoints';
import { getSocket } from '../api/websocket';
import { webSerial } from '../api/web_serial';
import type { LiveTelemetry } from '../types';


export function AppShell() {
  const demoEnabled = useDemoStore((s) => s.enabled);
  const scenario = useDemoStore((s) => s.scenario);
  const setRunning = useDemoStore((s) => s.setRunning);
  const pushReading = useLiveStore((s) => s.pushReading);
  const setCalibration = useLiveStore((s) => s.setCalibration);
  const setMission = useMissionStore((s) => s.setMission);
  const setDeployment = useMissionStore((s) => s.setDeployment);
  const setConnectionStatus = useDeviceStore((s) => s.setConnectionStatus);
  const setActiveDevice = useDeviceStore((s) => s.setActiveDevice);
  const setHeatmapPoints = useMapStore((s) => s.setHeatmapPoints);

  // Simulation status & active scanning point
  const simStatus = useSimulationSurveyStore((s) => s.status);
  const simWaypoints = useSimulationSurveyStore((s) => s.waypoints);
  const simActiveIdx = useSimulationSurveyStore((s) => s.activeWaypointIndex);
  const simBoat = useSimulationSurveyStore((s) => s.boatPosition);

  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize demo mode if enabled
  useEffect(() => {
    if (demoEnabled) {
      setMission(DEMO_MISSION);
      setDeployment(DEMO_DEPLOYMENT);
      setActiveDevice(DEMO_DEVICE.device_serial);
      setConnectionStatus('connected');
      setCalibration(DEMO_CALIBRATION);
    } else {
      setActiveDevice('AQUAYANTRA-001');
    }
  }, [demoEnabled, setMission, setDeployment, setActiveDevice, setConnectionStatus, setCalibration]);

  // Demo telemetry stream: In Simulation mode, sensors are STOPPED until user starts the mission!
  useEffect(() => {
    const isSimRunning = demoEnabled && (simStatus === 'navigating' || simStatus === 'scanning');

    if (!isSimRunning) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      setRunning(false);
      return;
    }

    resetGenerator();
    setRunning(true);

    demoIntervalRef.current = setInterval(() => {
      const activeWp = simWaypoints[simActiveIdx];
      const isScanning = simStatus === 'scanning' && activeWp != null;

      const telemetry = generateTelemetry(scenario);
      if (activeWp) {
        telemetry.latitude = simBoat.lat;
        telemetry.longitude = simBoat.lon;
        telemetry.depth = activeWp.targetDepth;
        if (isScanning) {
          telemetry.magnetic_magnitude = Number((activeWp.expectedMag + (Math.random() - 0.5) * 0.4).toFixed(1));
          telemetry.magnetic_deviation = Number((activeWp.expectedMag - 28.9).toFixed(1));
          telemetry.turbidity = activeWp.expectedTurbidity;
          telemetry.anomaly_score = activeWp.richnessScore;
          telemetry.confidence = Math.min(0.98, activeWp.richnessScore * 0.95 + 0.08);
          telemetry.detection_status = activeWp.richnessScore > 0.45 ? 'ANOMALY' : 'BACKGROUND';
        }
      }
      pushReading(telemetry);
    }, 500); // 2Hz

    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      setRunning(false);
    };
  }, [demoEnabled, simStatus, simWaypoints, simActiveIdx, simBoat, scenario, setRunning, pushReading]);

  // Autonomous simulation tick loop (1Hz: boat movement + 5s waypoint dwell scanning)
  const tickSimulation = useSimulationSurveyStore((s) => s.tickSimulation);
  const simTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isSimRunning = demoEnabled && (simStatus === 'navigating' || simStatus === 'scanning');
    if (!isSimRunning) {
      if (simTickRef.current) {
        clearInterval(simTickRef.current);
        simTickRef.current = null;
      }
      return;
    }

    simTickRef.current = setInterval(() => {
      tickSimulation();
    }, 1000);

    return () => {
      if (simTickRef.current) {
        clearInterval(simTickRef.current);
        simTickRef.current = null;
      }
    };
  }, [demoEnabled, simStatus, tickSimulation]);


  // REAL HARDWARE MODE: WebSocket & REST Ingestion (Strict Real Mode)
  useEffect(() => {
    if (demoEnabled) {
      if (realPollIntervalRef.current) clearInterval(realPollIntervalRef.current);
      return;
    }

    setConnectionStatus('connecting');

    // 1. Connect WebSocket for instant hardware telemetry pushes
    const sock = getSocket('device/AQUAYANTRA-001');
    sock.connect();

    const unsubStatus = sock.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubMsg = sock.onMessage((msg) => {
      if (msg.type === 'reading' && msg.data) {
        const d = msg.data as Record<string, unknown>;
        const reading: LiveTelemetry = {
          timestamp: msg.timestamp || new Date().toISOString(),
          depth: typeof d.depth === 'number' ? d.depth : null,
          magnetic_magnitude: typeof d.magnetic_magnitude === 'number' ? d.magnetic_magnitude : null,
          magnetic_baseline: typeof d.magnetic_baseline === 'number' ? d.magnetic_baseline : null,
          magnetic_deviation: typeof d.magnetic_deviation === 'number' ? d.magnetic_deviation : null,
          mag_x: typeof d.mag_x === 'number' ? d.mag_x : null,
          mag_y: typeof d.mag_y === 'number' ? d.mag_y : null,
          mag_z: typeof d.mag_z === 'number' ? d.mag_z : null,
          anomaly_score: typeof d.anomaly_score === 'number' ? d.anomaly_score : 0,
          confidence: typeof d.confidence === 'number' ? d.confidence : 0,
          turbidity: typeof d.turbidity === 'number' ? d.turbidity : null,
          battery_voltage: typeof d.battery_voltage === 'number' ? d.battery_voltage : null,
          battery_percent: typeof d.battery_percent === 'number' ? d.battery_percent : null,
          data_quality: typeof d.data_quality === 'number' ? d.data_quality : 1.0,
          detection_status: typeof d.detection_status === 'string' ? d.detection_status : 'BACKGROUND',
          sensor_health: typeof d.sensor_health === 'string' ? d.sensor_health : 'HEALTHY',
          latitude: typeof d.latitude === 'number' ? d.latitude : null,
          longitude: typeof d.longitude === 'number' ? d.longitude : null,
        };
        pushReading(reading);
      }
    });

    // 2. Poll latest reading as a resilient backup stream
    const fetchLatest = async () => {
      try {
        const latest = await readingsApi.latest('AQUAYANTRA-001');
        if (latest) {
          setConnectionStatus('connected');
          const reading: LiveTelemetry = {
            timestamp: latest.timestamp,
            depth: latest.depth,
            magnetic_magnitude: latest.magnetic_magnitude,
            magnetic_baseline: null,
            magnetic_deviation: null,
            mag_x: null,
            mag_y: null,
            mag_z: null,
            anomaly_score: latest.anomaly_score || 0,
            confidence: latest.detection_confidence || 0,
            turbidity: null,
            battery_voltage: null,
            battery_percent: null,
            data_quality: latest.data_quality || 1.0,
            detection_status: (latest.anomaly_score || 0) > 0.65 ? 'ANOMALY' : 'BACKGROUND',
            sensor_health: 'HEALTHY',
            latitude: latest.latitude,
            longitude: latest.longitude,
          };
          pushReading(reading);

        }
      } catch {
        // Backend not reached yet
      }
    };

    // 3. Wired USB Serial (Web Serial API) listeners
    const unsubGps = webSerial.onGps((gps) => {
      setConnectionStatus('connected');
      if (gps.valid && gps.lat != null && gps.lon != null) {
        pushReading({
          timestamp: new Date().toISOString(),
          depth: gps.alt ?? 0,
          magnetic_magnitude: null,
          magnetic_baseline: null,
          magnetic_deviation: null,
          mag_x: null,
          mag_y: null,
          mag_z: null,
          anomaly_score: 0,
          confidence: 0,
          turbidity: null,
          battery_voltage: 4.15,
          battery_percent: 100,
          data_quality: 1.0,
          detection_status: 'BACKGROUND',
          sensor_health: 'HEALTHY',
          latitude: gps.lat,
          longitude: gps.lon,
        });
      }
    });

    // 4. Fetch initial heatmap points
    const fetchHeatmap = async () => {
      try {
        const res = await mapApi.heatmap({ limit: 1000 });
        if (res && res.points) {
          setHeatmapPoints(res.points);
        }
      } catch {
        // Heatmap service pending
      }
    };

    fetchLatest();
    fetchHeatmap();
    realPollIntervalRef.current = setInterval(fetchLatest, 1500);

    return () => {
      unsubStatus();
      unsubMsg();
      unsubGps();
      if (realPollIntervalRef.current) clearInterval(realPollIntervalRef.current);
    };
  }, [demoEnabled, pushReading, setConnectionStatus, setHeatmapPoints]);


  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
