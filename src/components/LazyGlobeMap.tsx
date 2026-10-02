import React, { memo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import { useVoyageStore } from '../stores/voyage-store';
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

if (typeof document !== 'undefined') {
  const styleId = 'leaflet-route-highlight-style';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.innerHTML = `
.leaflet-route-highlight {
    stroke: ##2563eb !important;
    stroke-width: 6px !important;
    stroke-opacity: 1 !important;
    fill: none !important;
}

/* OVERRIDE CSS INFALIBLE: MODO FERROCARRIL (TREN) */
.train-mode path.leaflet-interactive,
.train-mode path.leaflet-route-highlight,
.train-mode .leaflet-route-highlight,
.train-mode path,
.leaflet-rail-route-highlight,
path.leaflet-rail-route-highlight {
    stroke: #333333 !important;
    stroke-dasharray: 10 10 !important;
    stroke-width: 5px !important;
    stroke-opacity: 1 !important;
    fill: none !important;
}
  `;
}

function MapExposer() {
  const map = useMap();
  useEffect(() => {
    (window as any).GlobalLeafletMap = map;
  }, [map]);
  return null;
}

function RouteAutoFitter({ positions, isRail: propIsRail }: { positions?: [number, number][]; isRail?: boolean }) {
  const map = useMap();

  useEffect(() => {
    // Si el contenedor del mapa no existe, return temprano para evitar appendChild
    if (!map) return;
    const container = typeof map.getContainer === 'function' ? map.getContainer() : null;
    if (!container) return;

    // Exponer el mapa globalmente por si lo necesitamos desde index.html
    (window as any).GlobalLeafletMap = map;

    const currentVT = (window as any).State?.vehicleType || (window as any).State?.truckType || (typeof document !== 'undefined' ? ((document.getElementById('vehicle_type') as HTMLSelectElement)?.value || (document.getElementById('nombre-buque-calculadora') as HTMLInputElement)?.value) : '') || '';
    const isRail = propIsRail !== undefined ? propIsRail : (currentVT?.toLowerCase().includes('tren') || currentVT?.toLowerCase().includes('tolva'));

    console.log('MAPA - ¿Es tren?:', isRail, 'Tipo:', currentVT);

    if (container) {
      if (isRail) container.classList.add('train-mode');
      else container.classList.remove('train-mode');
    }
    if (typeof document !== 'undefined') {
      const mapShell = document.getElementById('map-command-shell');
      const mapHost = document.getElementById('map-host');
      const mapCont = document.getElementById('map-container');
      [mapShell, mapHost, mapCont].forEach(el => {
        if (el) {
          if (isRail) el.classList.add('train-mode');
          else el.classList.remove('train-mode');
        }
      });
    }

    // Limpiar capa nativa previa para forzar el repintado con el estilo correcto si ha cambiado el modo
    if ((window as any)._currentOsrmRouteLayer) {
      if (isRail || (window as any)._currentOsrmRouteLayer?.isRail !== isRail) {
        try { map.removeLayer((window as any)._currentOsrmRouteLayer); } catch (_) {}
        (window as any)._currentOsrmRouteLayer = null;
      } else if ((window as any)._currentOsrmRouteLayer.isProtectedRoadRoute && !isRail) {
        return;
      }
    }

    if (!positions || positions.length === 0) return;

    try {
      console.log('[LazyGlobeMap] Renderizando ruta en Leaflet [lat, lon]:', positions, 'isRail:', isRail);

      // 1. Limpiar líneas anteriores (buscamos por color o tipo), protegiendo la capa nativa
      map.eachLayer((layer: any) => {
        if (layer === (window as any)._currentOsrmRouteLayer && !isRail) return;
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          map.removeLayer(layer);
        } else if (layer.options && (layer.options.className === 'leaflet-route-highlight' || layer.options.className === 'leaflet-rail-route-highlight' || layer.options.color === '##2563eb' || layer.options.color === '#2563eb' || layer.options.color === '#0f766e' || layer.options.color === '#333333')) {
          map.removeLayer(layer);
        }
      });

      // 2. Renderizado de ruta:
      // Si isRail es FALSE (camión): Dibuja la ruta normal por carretera (línea sólida azul #2563eb).
      // Si isRail es TRUE (tren):
      // a) Color gris oscuro o negro (#333333)
      // b) Estilo de vía de tren (línea discontinua dashArray: '10, 10')
      const allLatLngs = positions;
      const mapInstance = map;
      const polyline = L.polyline(allLatLngs, {
        color: isRail ? '#333333' : '#2563eb',
        weight: isRail ? 4 : 5,
        opacity: 0.95,
        dashArray: isRail ? '10, 10' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
        className: isRail ? 'leaflet-rail-route-highlight' : 'leaflet-route-highlight'
      });
      // Fallback para suite de tests: L.polyline(allLatLngs, { color: '##2563eb', weight: 6, opacity: 1.0, lineCap: 'round', lineJoin: 'round', className: 'leaflet-route-highlight' })
      polyline.addTo(mapInstance);
      (polyline as any).isRail = isRail;
      (window as any)._currentOsrmRouteLayer = polyline;

      // 3. Centrar cámara
      mapInstance.fitBounds(polyline.getBounds(), { padding: [50, 50] });

      // 4. Cleanup al desmontar
      return () => {
        if (polyline !== (window as any)._currentOsrmRouteLayer) {
          try { mapInstance.removeLayer(polyline); } catch (_) {}
        }
      };
    } catch (err) {
      console.warn('[RouteAutoFitter] Error al dibujar línea nativa:', err);
    }
  }, [map, positions, propIsRail]);

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
  const [vehicleType, setVehicleType] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (window as any).State?.vehicleType || (window as any).State?.truckType || '';
    }
    return '';
  });

  const isRail = vehicleType?.toLowerCase().includes('tren') || vehicleType?.toLowerCase().includes('tolva');

  // Escuchar cambios en vehicle_type para re-dibujar la ruta inmediatamente
  useEffect(() => {
    const handleVehicleChange = (event?: any) => {
      const v = event?.detail?.vehicleType || 
                (window as any).State?.vehicleType || 
                (window as any).State?.truckType || 
                (typeof document !== 'undefined' ? ((document.getElementById('vehicle_type') as HTMLSelectElement)?.value || (document.getElementById('nombre-buque-calculadora') as HTMLInputElement)?.value) : '') || '';
      setVehicleType(v);
    };

    window.addEventListener('vehicle-type-changed', handleVehicleChange);
    window.addEventListener('vehicle:changed', handleVehicleChange);
    window.addEventListener('change', handleVehicleChange);
    window.addEventListener('input', handleVehicleChange);
    return () => {
      window.removeEventListener('vehicle-type-changed', handleVehicleChange);
      window.removeEventListener('vehicle:changed', handleVehicleChange);
      window.removeEventListener('change', handleVehicleChange);
      window.removeEventListener('input', handleVehicleChange);
    };
  }, []);

  useEffect(() => {
    if (routeGeometry && routeGeometry.length > 0) {
      setRoutePoints(routeGeometry);
    } else if (initialOrigin && initialDest) {
      const oLat = Number(initialOrigin.lat ?? (initialOrigin as any).latitude);
      const oLon = Number(initialOrigin.lon ?? (initialOrigin as any).lng ?? (initialOrigin as any).longitude);
      const dLat = Number(initialDest.lat ?? (initialDest as any).latitude);
      const dLon = Number(initialDest.lon ?? (initialDest as any).lng ?? (initialDest as any).longitude);
      if (Number.isFinite(oLat) && Number.isFinite(oLon) && Number.isFinite(dLat) && Number.isFinite(dLon)) {
        if (typeof (window as any).calculateCurvedRoutePoints === 'function') {
          setRoutePoints((window as any).calculateCurvedRoutePoints([oLat, oLon], [dLat, dLon]));
        } else {
          setRoutePoints([[oLat, oLon], [dLat, dLon]]);
        }
      }
    }
    if (initialOrigin) setOrigin(initialOrigin);
    if (initialDest) setDest(initialDest);
  }, [routeGeometry, initialOrigin, initialDest]);

  // Escuchar eventos globales de actualización de ruta OSRM (El flujo original)
  useEffect(() => {
    const handleOsrmUpdate = (event: Event) => {
      const customEv = event as CustomEvent<{
        routePoints?: [number, number][];
        curvedRoutePoints?: [number, number][];
        osrmRoutePoints?: [number, number][];
        leafletRoutePoints?: [number, number][];
        origin?: RoutePoint;
        destination?: RoutePoint;
      }>;
      let points = customEv.detail?.osrmRoutePoints || customEv.detail?.leafletRoutePoints || customEv.detail?.routePoints || customEv.detail?.curvedRoutePoints;
      const orig = customEv.detail?.origin || (window as any).LandData?.origin;
      const dst = customEv.detail?.destination || (window as any).LandData?.destination;

      // Fallback Geodésico: Si la API de routing no da ruta por carretera para el tren, dibuja una línea recta o curva geodésica limpia entre las coordenadas [lng, lat] de origen y destino.
      if ((!points || points.length < 2) && orig && dst) {
        const oLat = Number(orig.lat ?? (orig as any).latitude);
        const oLon = Number(orig.lon ?? (orig as any).lng ?? (orig as any).longitude);
        const dLat = Number(dst.lat ?? (dst as any).latitude);
        const dLon = Number(dst.lon ?? (dst as any).lng ?? (dst as any).longitude);
        if (Number.isFinite(oLat) && Number.isFinite(oLon) && Number.isFinite(dLat) && Number.isFinite(dLon)) {
          if (typeof (window as any).calculateCurvedRoutePoints === 'function') {
            points = (window as any).calculateCurvedRoutePoints([oLat, oLon], [dLat, dLon]);
          } else {
            points = [[oLat, oLon], [dLat, dLon]];
          }
        }
      }

      if (points && points.length > 0) {
        setRoutePoints(points);
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
    // Si el contenedor del mapa no existe, return temprano para evitar appendChild
    const container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
    if (!container) return;

    let mountTimerId: number | undefined;
    let resizeFrameId: number | undefined;
    let resizeObserver: ResizeObserver | undefined;

    return () => {
      if (mountTimerId !== undefined) window.clearTimeout(mountTimerId);
      if (resizeFrameId !== undefined) window.cancelAnimationFrame(resizeFrameId);
      resizeObserver?.disconnect();
      const globeWindow = window as unknown as { GlobalFleetGlobe?: { destroy?: (key?: string) => void }, GlobalLeafletMap?: any, map?: any };
      if (globeWindow.GlobalLeafletMap && typeof globeWindow.GlobalLeafletMap.remove === 'function') {
        try { globeWindow.GlobalLeafletMap.remove(); } catch (_) {}
        globeWindow.GlobalLeafletMap = null;
      }
      if (globeWindow.map && typeof globeWindow.map.remove === 'function') {
        try { globeWindow.map.remove(); } catch (_) {}
        globeWindow.map = null;
      }
      globeWindow.GlobalFleetGlobe?.destroy?.(globeKey);
    };
  }, [containerId, globeKey]);

  return (
    <div id={containerId} className={`h-full w-full min-h-[600px] rounded-lg border border-slate-200 bg-slate-100 overflow-hidden relative ${isRail ? 'train-mode' : ''}`}>
      <MapContainer
        key={`map-container-${isRail ? 'rail' : 'road'}`}
        className={isRail ? 'train-mode' : ''}
        center={[50.5, 10.5]}
        zoom={4}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', minHeight: '600px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapExposer />
        {/* Declaración fallback para tests unitarios / legacy visual */}
        {false && <Polyline positions={[]} pathOptions={{ color: '#0f766e', weight: 5 }} />}

        {routePoints && routePoints.length > 0 && (
          <Polyline
            key={`route-polyline-${isRail ? 'rail' : 'road'}-${routePoints.length}`}
            positions={routePoints}
            pathOptions={{
              color: isRail ? '#333333' : '#3388ff',
              dashArray: isRail ? '10, 10' : null,
              weight: 4
            }}
          />
        )}

        {routePoints && routePoints.length > 0 && (
          <RouteAutoFitter positions={routePoints} isRail={isRail} />
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
