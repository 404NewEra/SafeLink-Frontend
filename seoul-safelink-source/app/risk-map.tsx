"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RiskResponse } from "@/lib/risk-api";

const SEOUL_CENTER: [number, number] = [126.978, 37.5665];
const SEOUL_BOUNDS: [[number, number], [number, number]] = [
  [126.76, 37.41],
  [127.19, 37.72],
];

type DistrictCollection = {
  type: "FeatureCollection";
  features: Array<{
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: number[][][] | number[][][][];
    };
  }>;
};

type BoundaryFeature = {
  type: "Feature";
  properties: { name: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
};

function signedArea(ring: number[][]) {
  return ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
}

function clockwise(ring: number[][]) {
  return signedArea(ring) < 0 ? ring : [...ring].reverse();
}

function createOutsideMask(boundary: BoundaryFeature) {
  const seoulHole = clockwise(boundary.geometry.coordinates[0]);
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [[126.55, 37.2], [127.4, 37.2], [127.4, 37.9], [126.55, 37.9], [126.55, 37.2]],
        seoulHole,
      ],
    },
  };
}

export default function RiskMap({ data, onLocation }: { data: RiskResponse; onLocation: (lat: number, lng: number) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const latestDataRef = useRef(data);
  latestDataRef.current = data;

  const showResult = (map: Map, result: RiskResponse) => {
    const source = map.getSource("risk") as GeoJSONSource | undefined;
    source?.setData(result.map.features);
    map.easeTo({ center: [result.region.longitude, result.region.latitude], zoom: 12.2, duration: 700 });
    markerRef.current?.remove();
    const marker = document.createElement("div");
    marker.className = "search-result-marker";
    marker.textContent = result.region.name.replace("서울특별시 ", "");
    markerRef.current = new maplibregl.Marker({ element: marker, anchor: "bottom" }).setLngLat([result.region.longitude, result.region.latitude]).addTo(map);
  };

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const tileUrl = `${window.location.origin}/api/map-tile?z={z}&x={x}&y={y}`;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: { seoulBase: { type: "raster", tiles: [tileUrl], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "seoul-base", type: "raster", source: "seoulBase", minzoom: 0, maxzoom: 19 }],
      },
      center: SEOUL_CENTER,
      zoom: 10.7,
      minZoom: 9.8,
      maxZoom: 16,
      maxBounds: SEOUL_BOUNDS,
      renderWorldCopies: false,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("load", async () => {
      map.fitBounds(SEOUL_BOUNDS, { padding: 28, duration: 0 });
      map.addSource("risk", { type: "geojson", data: latestDataRef.current.map.features });
      map.addLayer({ id: "risk-fill", type: "fill", source: "risk", paint: { "fill-color": ["coalesce",["get","risk_color"],["match",["get","risk_level"],"safe","#16948A","interest","#FFC94A","caution","#FF8647","alert","#E34836","danger","#AD5CE3",["match",["get","risk"],"high","#AD5CE3","watch","#FF8647","#FFC94A"]]], "fill-opacity": 0.58 } });
      map.addLayer({ id: "risk-line", type: "line", source: "risk", paint: { "line-color": ["coalesce",["get","risk_color"],"#8b3cc5"], "line-width": 2 } });
      showResult(map, latestDataRef.current);
      try {
        const [districtResponse, boundaryResponse] = await Promise.all([
          fetch("/seoul-districts.geojson"),
          fetch("/seoul-boundary.geojson"),
        ]);
        if (!districtResponse.ok || !boundaryResponse.ok) throw new Error("Seoul boundary unavailable");
        const districts = (await districtResponse.json()) as DistrictCollection;
        const boundary = (await boundaryResponse.json()) as BoundaryFeature;
        map.addSource("seoul-districts", { type: "geojson", data: districts });
        map.addSource("outside-seoul", { type: "geojson", data: createOutsideMask(boundary) });
        map.addLayer({ id: "outside-seoul-mask", type: "fill", source: "outside-seoul", paint: { "fill-color": "#52605d", "fill-opacity": 0.56 } });
        map.addLayer({ id: "seoul-boundary", type: "line", source: "seoul-districts", paint: { "line-color": "#0d756f", "line-width": 1.4 } });
      } catch {}

      const label = document.createElement("div");
      label.className = "seoul-map-label";
      label.textContent = "서울특별시";
      new maplibregl.Marker({ element: label, anchor: "bottom" }).setLngLat(SEOUL_CENTER).addTo(map);
    });
    map.on("click", (event) => onLocation(event.lngLat.lat, event.lngLat.lng));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => showResult(map, data);
    if (map.loaded()) update();
    else map.once("load", update);
  }, [data]);

  return <div className="maplibre-wrap"><div ref={container} className="maplibre-map"/><div className="legend five-levels"><span><i className="safe"/>안전</span><span><i className="interest"/>관심</span><span><i className="caution"/>주의</span><span><i className="alert"/>경계</span><span><i className="danger"/>위험</span></div><p className="map-hint">서울 지역만 조회할 수 있어요. 지도를 클릭해 분석하세요.</p></div>;
}
