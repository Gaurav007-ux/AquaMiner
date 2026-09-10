/* ============================================================
   AquaYantra — RealMapLeaflet component
   Interactive Leaflet/OpenStreetMap for Real Hardware Mode.
   Shows live GPS position, accumulated survey heatmap points,
   and differentiates anomaly vs no-anomaly markers.
   ============================================================ */

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapStore, useLiveStore } from '../stores';
import type { MineralHeatmapPoint } from '../types';

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom pulsing GPS icon
const gpsIcon = L.divIcon({
  className: 'gps-pulse-marker',
  html: `
    <div style="position:relative;width:28px;height:28px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(6,182,212,0.25);animation:gpsPulse 2s ease-out infinite;"></div>
      <div style="position:absolute;top:6px;left:6px;width:16px;height:16px;border-radius:50%;background:#06b6d4;border:3px solid #fff;box-shadow:0 0 12px rgba(6,182,212,0.8);"></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Inject pulse animation CSS
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes gpsPulse {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  .gps-pulse-marker { background: transparent !important; border: none !important; }
  .leaflet-container { background: #070c16 !important; }
`;
if (!document.head.querySelector('[data-aqua-leaflet-style]')) {
  styleTag.setAttribute('data-aqua-leaflet-style', 'true');
  document.head.appendChild(styleTag);
}

/* Fly the map to the GPS position when it changes */
function MapFollower({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  const hasFlown = useRef(false);

  useEffect(() => {
    if (lat !== 0 && lon !== 0) {
      if (!hasFlown.current) {
        map.flyTo([lat, lon], 17, { duration: 1.5 });
        hasFlown.current = true;
      } else {
        map.setView([lat, lon], map.getZoom(), { animate: true });
      }
    }
  }, [lat, lon, map]);

  return null;
}

/* Get marker color based on anomaly detection */
function getAnomalyColor(anomalyScore: number): string {
  if (anomalyScore < 0.45) return '#64748b'; // No anomaly — Slate gray
  if (anomalyScore >= 0.75) return '#ef4444'; // Strong anomaly — Red
  return '#f59e0b'; // Moderate anomaly — Amber
}

interface RealMapLeafletProps {
  className?: string;
}

export function RealMapLeaflet({ className = '' }: RealMapLeafletProps) {
  const heatmapPoints = useMapStore((s) => s.heatmapPoints);
  const showHeatmap = useMapStore((s) => s.showHeatmap);
  const latest = useLiveStore((s) => s.latestReading);

  const gpsLat = latest?.latitude ?? 0;
  const gpsLon = latest?.longitude ?? 0;
  const hasGps = gpsLat !== 0 && gpsLon !== 0;

  // Default center: use GPS if available, else first heatmap point, else Delhi (CIOB proxy)
  const center = useMemo<[number, number]>(() => {
    if (hasGps) return [gpsLat, gpsLon];
    if (heatmapPoints.length > 0) return [heatmapPoints[0].latitude, heatmapPoints[0].longitude];
    return [28.6139, 77.2090];
  }, [hasGps, gpsLat, gpsLon, heatmapPoints]);

  // Separate anomaly and no-anomaly points for distinct rendering
  const { anomalyPts, noAnomalyPts } = useMemo(() => {
    const anomalyPts: MineralHeatmapPoint[] = [];
    const noAnomalyPts: MineralHeatmapPoint[] = [];
    heatmapPoints.forEach((pt) => {
      if (pt.anomaly_score >= 0.45) {
        anomalyPts.push(pt);
      } else {
        noAnomalyPts.push(pt);
      }
    });
    return { anomalyPts, noAnomalyPts };
  }, [heatmapPoints]);

  return (
    <div className={`relative w-full h-full ${className}`} style={{ minHeight: 300 }}>
      <MapContainer
        center={center}
        zoom={hasGps ? 17 : 15}
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ width: '100%', height: '100%', borderRadius: '8px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fly to GPS location */}
        <MapFollower lat={gpsLat} lon={gpsLon} />

        {/* Live GPS Position Marker */}
        {hasGps && (
          <Marker position={[gpsLat, gpsLon]} icon={gpsIcon}>
            <Popup>
              <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                <strong>🛰️ Live GPS Position</strong><br/>
                LAT: {gpsLat.toFixed(6)}°N<br/>
                LON: {gpsLon.toFixed(6)}°E<br/>
                Depth: {latest?.depth?.toFixed(1) ?? '—'}m
              </div>
            </Popup>
          </Marker>
        )}

        {/* Heatmap Survey Points */}
        {showHeatmap && (
          <>
            {/* No-anomaly points — gray neutral markers */}
            {noAnomalyPts.map((pt, idx) => (
              <CircleMarker
                key={`no-anom-${idx}`}
                center={[pt.latitude, pt.longitude]}
                radius={7}
                pathOptions={{
                  color: '#94a3b8',
                  fillColor: '#64748b',
                  fillOpacity: 0.6,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    <strong style={{ color: '#64748b' }}>✗ No Anomaly Detected</strong><br/>
                    <span style={{ color: '#888' }}>Status: Normal / Background Reading</span><br/>
                    <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '4px 0' }}/>
                    Anomaly Score: {(pt.anomaly_score * 100).toFixed(0)}%<br/>
                    Confidence: {(pt.confidence * 100).toFixed(0)}%<br/>
                    Depth: {pt.depth?.toFixed(1) ?? '—'}m<br/>
                    Mag Dev: {pt.magnetic_deviation?.toFixed(1) ?? '—'}µT<br/>
                    Turbidity: {pt.turbidity?.toFixed(0) ?? '—'} NTU<br/>
                    pH: {pt.ph?.toFixed(2) ?? '—'}
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Anomaly points — colored heat markers */}
            {anomalyPts.map((pt, idx) => {
              const color = getAnomalyColor(pt.anomaly_score);
              const radius = Math.max(8, pt.intensity * 18);
              return (
                <CircleMarker
                  key={`anom-${idx}`}
                  center={[pt.latitude, pt.longitude]}
                  radius={radius}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.7,
                    weight: 3,
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      <strong style={{ color: color }}>⚠ Anomaly Detected</strong><br/>
                      <span style={{ color: '#666' }}>Status: {pt.anomaly_score >= 0.75 ? 'Strong Anomaly' : 'Moderate Anomaly'}</span><br/>
                      <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '4px 0' }}/>
                      Anomaly Score: {(pt.anomaly_score * 100).toFixed(0)}%<br/>
                      Confidence: {(pt.confidence * 100).toFixed(0)}%<br/>
                      Intensity: {(pt.intensity * 100).toFixed(0)}%<br/>
                      Depth: {pt.depth?.toFixed(1) ?? '—'}m<br/>
                      Mag Dev: {pt.magnetic_deviation?.toFixed(1) ?? '—'}µT<br/>
                      Turbidity: {pt.turbidity?.toFixed(0) ?? '—'} NTU<br/>
                      pH: {pt.ph?.toFixed(2) ?? '—'}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </>
        )}
      </MapContainer>

      {/* Overlay HUD — GPS Status + Stats */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        {/* GPS Status */}
        <div className="flex items-center gap-2 bg-[#0c1424]/90 backdrop-blur-md px-3 py-1.5 rounded border border-[var(--border-medium)] shadow-lg text-[11px] font-mono">
          {hasGps ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] animate-pulse" />
              <span className="text-emerald-400 font-semibold">GPS LOCKED</span>
              <span className="text-[var(--text-secondary)]">
                {gpsLat.toFixed(6)}°N, {gpsLon.toFixed(6)}°E
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 font-semibold">AWAITING GPS FIX</span>
              <span className="text-[var(--text-muted)]">Connect NEO-6M via USB</span>
            </>
          )}
        </div>

        {/* Survey Points Counter */}
        {heatmapPoints.length > 0 && (
          <div className="flex items-center gap-2 bg-[#0c1424]/90 backdrop-blur-md px-3 py-1.5 rounded border border-[var(--border-medium)] shadow-lg text-[10px] font-mono">
            <span className="text-cyan-300 font-bold">{heatmapPoints.length} SURVEY POINTS</span>
            <span className="text-[var(--text-muted)]">|</span>
            <span className="text-amber-400">{anomalyPts.length} Anomalies</span>
            <span className="text-gray-400">{noAnomalyPts.length} Clean</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-3 bg-[#0c1424]/90 backdrop-blur-md px-3 py-1.5 rounded border border-[var(--border-medium)] shadow-lg text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          <span className="text-gray-300">No Anomaly</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
          <span className="text-gray-300">Moderate Anomaly</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]" />
          <span className="text-gray-300">Strong Anomaly</span>
        </div>
      </div>
    </div>
  );
}
