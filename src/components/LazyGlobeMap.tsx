import React, { memo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RoutePoint {
  lat: number;
  lon: number;
  name?: string;
}

interface GlobeMapProps {
  containerId?: string;
  globeKey?: string;
  routeGeometry?: [number, number][];
  origin?: RoutePoint | null;
  destination?: RoutePoint | null;
}

export function MapSkeletonFallback() {
  return (
    <div 
      className="w-full h-full min-h-[600px] flex flex-col items-center justify-center bg-slate-900 text-slate-100"
      style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}
    >
      {/* Spinner */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="h-16 w-16 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin"></div>
        <div className="absolute h-3 w-3 rounded-full bg-cyan-400"></div>
      </div>
      <h2 className="text-2xl font-bold tracking-wide text-white">Land Charter Core PRO</h2>
      <p className="mt-3 text-sm text-cyan-400 animate-pulse font-medium">Iniciando mapa 2D Europa...</p>
    </div>
  );
}

// Iconos minimalistas compactos (14x14px con borde blanco stroke y relieve)
export const createMinimalMarkerIcon = (color = '#0f172a', borderColor = '#ffffff', size = 14) => {
  return L.divIcon({
    className: 'minimal-route-dot-icon',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid ${borderColor};
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export const minimalOriginIcon = createMinimalMarkerIcon('#0f172a', '#ffffff', 14); // Gris carbón / oscuro
export const minimalDestIcon = createMinimalMarkerIcon('#0f766e', '#ffffff', 14);   // Teal corporativo

function RouteAutoFitter({ positions }: { positions?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      try {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (err) {
        console.warn('[RouteAutoFitter] Error al ajustar límites de la ruta:', err);
      }
    }
  }, [map, positions]);
  return null;
}

const GlobeCanvasContent = memo(function GlobeCanvasContent({
  containerId = 'map-container',
  globeKey = 'main',
  routeGeometry,
  origin: initialOrigin,
  destination: initialDest
}: GlobeMapProps) {
  const [routePoints, setRoutePoints] = useState<[number, number][]>(routeGeometry || []);
  const [origin, setOrigin] = useState<RoutePoint | null>(initialOrigin || null);
  const [dest, setDest] = useState<RoutePoint | null>(initialDest || null);

  useEffect(() => {
    if (routeGeometry) setRoutePoints(routeGeometry);
    if (initialOrigin) setOrigin(initialOrigin);
    if (initialDest) setDest(initialDest);
  }, [routeGeometry, initialOrigin, initialDest]);

  // Escuchar eventos globales de actualización de ruta OSRM
  useEffect(() => {
    const handleOsrmUpdate = (event: Event) => {
      const customEv = event as CustomEvent<{
        routePoints?: [number, number][];
        origin?: RoutePoint;
        destination?: RoutePoint;
      }>;
      if (customEv.detail?.routePoints) {
        setRoutePoints(customEv.detail.routePoints);
      }
      if (customEv.detail?.origin) {
        setOrigin(customEv.detail.origin);
      }
      if (customEv.detail?.destination) {
        setDest(customEv.detail.destination);
      }
    };

    window.addEventListener('osrm:route-updated', handleOsrmUpdate);
    return () => {
      window.removeEventListener('osrm:route-updated', handleOsrmUpdate);
    };
  }, []);

  useEffect(() => {
    let mountTimerId: number | undefined;
    let resizeFrameId: number | undefined;
    let resizeObserver: ResizeObserver | undefined;

    return () => {
      if (mountTimerId !== undefined) window.clearTimeout(mountTimerId);
      if (resizeFrameId !== undefined) window.cancelAnimationFrame(resizeFrameId);
      resizeObserver?.disconnect();
      const globeWindow = window as unknown as { GlobalFleetGlobe?: { destroy?: (key?: string) => void } };
      globeWindow.GlobalFleetGlobe?.destroy?.(globeKey);
    };
  }, [containerId, globeKey]);

  return (
    <div id={containerId} className="h-full w-full min-h-[600px] rounded-lg border border-slate-200 bg-slate-100 overflow-hidden relative">
      <MapContainer
        center={[50.5, 10.5]}
        zoom={4}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', minHeight: '600px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routePoints && routePoints.length > 0 && (
          <>
            <Polyline
              positions={routePoints}
              pathOptions={{
                color: '#0f766e',
                weight: 5,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
            <RouteAutoFitter positions={routePoints} />
          </>
        )}

        {origin && (
          <Marker position={[origin.lat, origin.lon]} icon={minimalOriginIcon} />
        )}

        {dest && (
          <Marker position={[dest.lat, dest.lon]} icon={minimalDestIcon} />
        )}
      </MapContainer>
    </div>
  );
});

const LazyGlobeMap = memo(function LazyGlobeMap({
  containerId = 'map-container',
  globeKey = 'main',
  routeGeometry,
  origin,
  destination
}: GlobeMapProps) {
  const [showGlobe, setShowGlobe] = useState(false);

  useEffect(() => {
    let idleCallbackId: number | undefined;
    const checkTimer: number | undefined = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleCallbackId = window.requestIdleCallback(() => setShowGlobe(true), { timeout: 1000 });
      } else {
        setShowGlobe(true);
      }
    }, 100);

    return () => {
      window.clearTimeout(checkTimer);
      if (idleCallbackId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, []);

  if (!showGlobe) return <MapSkeletonFallback />;
  return (
    <GlobeCanvasContent
      containerId={containerId}
      globeKey={globeKey}
      routeGeometry={routeGeometry}
      origin={origin}
      destination={destination}
    />
  );
});

export default LazyGlobeMap;
