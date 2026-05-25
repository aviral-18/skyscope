'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFlightStore } from '@/store/flight-store';
import { Aircraft } from '@/types/aviation';

// Max markers to render at once to keep map responsive
const MAX_MARKERS = 800;

// Altitude-based color coding
function getAltitudeColor(altitude: number, isSelected: boolean): string {
  if (isSelected) return '#00ff88';
  const alt = typeof altitude === 'number' && !isNaN(altitude) ? altitude : 0;
  if (alt <= 0) return '#f59e0b';
  if (alt < 10000) return '#38bdf8';
  if (alt < 20000) return '#3b9dff';
  if (alt < 30000) return '#818cf8';
  if (alt < 40000) return '#f97316';
  return '#ef4444';
}

// Cache icons by key to avoid repeated SVG string building
const iconCache = new Map<string, L.DivIcon>();

function getAircraftIcon(heading: number, isSelected: boolean, altitude: number): L.DivIcon {
  const safeHeading = typeof heading === 'number' && !isNaN(heading) ? heading : 0;
  const safeAltitude = typeof altitude === 'number' && !isNaN(altitude) ? altitude : 0;

  // Round heading to nearest 10° and altitude to band for caching
  const h = Math.round(safeHeading / 10) * 10;
  const altBand = isSelected ? -1 : safeAltitude <= 0 ? 0 : Math.min(5, Math.floor(safeAltitude / 10000));
  const key = `${h}_${altBand}_${isSelected ? 1 : 0}`;

  let icon = iconCache.get(key);
  if (icon) return icon;

  const color = getAltitudeColor(safeAltitude, isSelected);
  const size = isSelected ? 28 : 20;
  const glow = isSelected ? `<circle cx="12" cy="12" r="11" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.5"/>` : '';
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${h}deg)">
    ${glow}<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="${color}" stroke="${isSelected ? '#fff' : '#1a1a2e'}" stroke-width="0.5"/>
  </svg>`;
  icon = L.divIcon({
    html: svg,
    className: isSelected ? 'aircraft-icon aircraft-selected' : 'aircraft-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  // Keep cache bounded
  if (iconCache.size > 500) iconCache.clear();
  iconCache.set(key, icon);
  return icon;
}

function getAirportIcon(type: 'origin' | 'destination'): L.DivIcon {
  const color = type === 'origin' ? '#38bdf8' : '#f59e0b';
  const label = type === 'origin' ? 'DEP' : 'ARR';
  const html = `
    <div style="background: ${color}22; border: 1.5px solid ${color}; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${color}66;">
      <span style="color: ${color}; font-size: 8px; font-weight: 800; font-family: monospace;">${label}</span>
    </div>
  `;
  return L.divIcon({ html, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
}

export default function FlightMap() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const trackLayerRef = useRef<L.LayerGroup | null>(null);
  const aircraftRef = useRef<Aircraft[]>([]);
  const selectedRef = useRef<Aircraft | null>(null);
  const updateScheduled = useRef(false);
  const { aircraft, selectedAircraft, selectAircraft, selectedTrack, flyToTarget, setFlyToTarget } = useFlightStore();
  const [isReady, setIsReady] = useState(false);

  // Keep refs in sync without triggering re-renders
  aircraftRef.current = aircraft;
  selectedRef.current = selectedAircraft;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      maxBoundsViscosity: 1.0,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    trackLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setIsReady(true);

    // Short timeout to ensure container has completed dynamic layout before computing bounds
    setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 200);

    // Re-render markers on moveend (viewport change)
    map.on('moveend', () => scheduleMarkerUpdate());

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAircraftClick = useCallback((ac: Aircraft) => {
    selectAircraft(ac);
    if (mapRef.current) {
      mapRef.current.flyTo([ac.latitude, ac.longitude], Math.max(mapRef.current.getZoom(), 8), { duration: 1 });
    }
  }, [selectAircraft]);

  // Batched marker update — runs at most once per animation frame
  const doMarkerUpdate = useCallback(() => {
    updateScheduled.current = false;
    const map = mapRef.current;
    if (!map) return;

    const allAircraft = aircraftRef.current;
    const selected = selectedRef.current;
    const bounds = map.getBounds();
    const zoom = map.getZoom();

    let visible = allAircraft;
    if (zoom >= 4) {
      // Filter to viewport with padding
      const pad = Math.max(2, 8 - zoom);
      const south = bounds.getSouth() - pad;
      const north = bounds.getNorth() + pad;
      const west = bounds.getWest() - pad;
      const east = bounds.getEast() + pad;

      visible = allAircraft.filter(a =>
        a.latitude >= south && a.latitude <= north &&
        a.longitude >= west && a.longitude <= east
      );
    }

    // Cap markers: at low zoom, show only a subset to stay responsive
    if (visible.length > MAX_MARKERS) {
      // Always keep selected in the list
      const selectedId = selected?.icao24;
      // Sample evenly
      const step = Math.ceil(visible.length / MAX_MARKERS);
      const sampled: Aircraft[] = [];
      for (let i = 0; i < visible.length; i++) {
        if (i % step === 0 || visible[i].icao24 === selectedId) {
          sampled.push(visible[i]);
        }
      }
      visible = sampled;
    }

    const visibleIds = new Set(visible.map(a => a.icao24));

    // Remove markers not in visible set
    markersRef.current.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    // Update or create markers
    for (const ac of visible) {
      const isSelected = selected?.icao24 === ac.icao24;
      const existing = markersRef.current.get(ac.icao24);

      if (existing) {
        // Direct position update — no animation (this is the biggest perf win)
        existing.setLatLng([ac.latitude, ac.longitude]);
        existing.setIcon(getAircraftIcon(ac.heading, isSelected, ac.altitude));
      } else {
        const marker = L.marker([ac.latitude, ac.longitude], {
          icon: getAircraftIcon(ac.heading, isSelected, ac.altitude),
          interactive: true,
        });
        marker.on('click', () => handleAircraftClick(ac));
        
        const routeText = ac.origin && ac.destination ? `<span style="opacity:0.8;font-size:11px">${ac.origin} ➔ ${ac.destination}</span><br>` : '';
        const typeText = ac.aircraftType ? `<span style="opacity:0.7;font-size:10px">${ac.aircraftType}</span><br>` : '';
        const callsignText = `<b>${ac.flightNumber || ac.callsign || ac.icao24.toUpperCase()}</b><br>${ac.flightNumber && ac.flightNumber !== ac.callsign ? `<span style="opacity:0.6;font-size:10px">CS: ${ac.callsign}</span><br>` : ''}`;
        const statusText = `<span style="opacity:0.6;font-size:10px">${ac.onGround ? 'Ground' : `${Math.round(ac.altitude).toLocaleString()}ft · ${Math.round(ac.velocity)}kts`}</span>`;
        
        marker.bindTooltip(
          `<div style="text-align:center">
            ${callsignText}
            ${routeText}
            ${typeText}
            ${statusText}
          </div>`,
          { className: 'aircraft-tooltip', direction: 'top', offset: [0, -12] }
        );
        marker.addTo(map);
        markersRef.current.set(ac.icao24, marker);
      }
    }
  }, [handleAircraftClick]);

  function scheduleMarkerUpdate() {
    if (updateScheduled.current) return;
    updateScheduled.current = true;
    requestAnimationFrame(doMarkerUpdate);
  }

  // When aircraft data changes, schedule a single batched update
  useEffect(() => {
    if (!isReady) return;
    scheduleMarkerUpdate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraft, selectedAircraft, isReady]);

  // Handle flyToTarget from search
  useEffect(() => {
    if (flyToTarget && mapRef.current && isReady) {
      mapRef.current.flyTo([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom, { duration: 1.2 });
      setFlyToTarget(null);
    }
  }, [flyToTarget, isReady, setFlyToTarget]);

  // Render flight track/trajectory for selected aircraft
  useEffect(() => {
    if (!trackLayerRef.current) return;
    trackLayerRef.current.clearLayers();
    if (!selectedAircraft) return;

    const trackPoints = selectedTrack && selectedTrack.length > 1 ? selectedTrack : selectedAircraft.trail;
    if (!trackPoints || trackPoints.length < 2) return;

    // Draw trail as a single polyline (much cheaper than per-segment)
    const polyline = L.polyline(trackPoints as L.LatLngExpression[], {
      color: '#00ff88',
      weight: 2.5,
      opacity: 0.6,
      lineCap: 'round',
      lineJoin: 'round',
    });
    trackLayerRef.current.addLayer(polyline);

    // Start marker
    const sp = trackPoints[0];
    const startMarker = L.circleMarker([sp[0], sp[1]], {
      radius: 5, color: '#00ff88', fillColor: '#00ff88', fillOpacity: 0.3, weight: 1.5, opacity: 0.6,
    });
    startMarker.bindTooltip('Track Start', { className: 'aircraft-tooltip', direction: 'top', offset: [0, -8] });
    trackLayerRef.current.addLayer(startMarker);

    // Dashed connector to current position
    const lp = trackPoints[trackPoints.length - 1];
    if (Math.abs(lp[0] - selectedAircraft.latitude) > 0.001 || Math.abs(lp[1] - selectedAircraft.longitude) > 0.001) {
      const dash = L.polyline([lp, [selectedAircraft.latitude, selectedAircraft.longitude]], {
        color: '#00ff88', weight: 2, opacity: 0.8, dashArray: '6,4',
      });
      trackLayerRef.current.addLayer(dash);
    }
    // Draw origin and destination airports if available
    const routeInfo = selectedAircraft.route;
    if (routeInfo) {
      const { origin, destination } = routeInfo;
      
      const oLat = origin?.lat;
      const oLng = origin?.lng;
      const dLat = destination?.lat;
      const dLng = destination?.lng;

      // Origin Marker
      if (origin && oLat != null && oLng != null) {
        const originMarker = L.marker([oLat, oLng], { icon: getAirportIcon('origin') });
        originMarker.bindTooltip(`<b>${origin.name}</b><br>Origin`, { className: 'aircraft-tooltip', direction: 'top' });
        trackLayerRef.current.addLayer(originMarker);
      }

      // Destination Marker
      if (destination && dLat != null && dLng != null) {
        const destMarker = L.marker([dLat, dLng], { icon: getAirportIcon('destination') });
        destMarker.bindTooltip(`<b>${destination.name}</b><br>Destination`, { className: 'aircraft-tooltip', direction: 'top' });
        trackLayerRef.current.addLayer(destMarker);
      }

      // Great circle route line (simplified to a dashed straight line for performance)
      if (oLat != null && oLng != null && dLat != null && dLng != null) {
        const routeLine = L.polyline([[oLat, oLng], [dLat, dLng]], {
          color: '#ffffff',
          weight: 1,
          opacity: 0.2,
          dashArray: '4,8',
        });
        trackLayerRef.current.addLayer(routeLine);
      }
    }
  }, [selectedAircraft, selectedTrack]);

  // Fly to selected aircraft (only on new selection)
  const prevSelectedId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedAircraft && mapRef.current && selectedAircraft.icao24 !== prevSelectedId.current) {
      prevSelectedId.current = selectedAircraft.icao24;
      mapRef.current.flyTo(
        [selectedAircraft.latitude, selectedAircraft.longitude],
        Math.max(mapRef.current.getZoom(), 8),
        { duration: 1 }
      );
    } else if (!selectedAircraft) {
      prevSelectedId.current = null;
    }
  }, [selectedAircraft]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#0a0a1a' }} />

      {/* Altitude legend */}
      <div className="absolute bottom-24 left-3 z-[1000] glass-panel rounded-xl p-2.5">
        <div className="text-[9px] text-white/40 uppercase tracking-wider mb-1.5 font-medium">Altitude</div>
        {[
          { color: '#f59e0b', label: 'Ground' },
          { color: '#38bdf8', label: '< 10K ft' },
          { color: '#3b9dff', label: '10-20K ft' },
          { color: '#818cf8', label: '20-30K ft' },
          { color: '#f97316', label: '30-40K ft' },
          { color: '#ef4444', label: '> 40K ft' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5 py-0.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-[9px] text-white/50">{item.label}</span>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .aircraft-icon { background: none !important; border: none !important; overflow: visible !important; }
        .aircraft-selected { filter: drop-shadow(0 0 6px rgba(0, 255, 136, 0.6)); z-index: 1000 !important; }
        .aircraft-tooltip {
          background: rgba(10, 10, 30, 0.92) !important;
          border: 1px solid rgba(59, 157, 255, 0.3) !important;
          color: #e0e0ff !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-size: 11px !important;
          padding: 5px 10px !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
        }
        .aircraft-tooltip::before { border-top-color: rgba(59, 157, 255, 0.3) !important; }
        .leaflet-control-zoom a {
          background: rgba(10, 10, 30, 0.85) !important;
          color: #8899cc !important;
          border-color: rgba(59, 157, 255, 0.2) !important;
          backdrop-filter: blur(10px) !important;
        }
        .leaflet-control-zoom a:hover { color: #3b9dff !important; background: rgba(20, 20, 50, 0.9) !important; }
      `}</style>
    </div>
  );
}
