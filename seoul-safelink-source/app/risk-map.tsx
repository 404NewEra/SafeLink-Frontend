"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map, MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RiskResponse } from "@/lib/risk-api";

const SEOUL_CENTER: [number, number] = [126.978, 37.5665];
const SEOUL_BOUNDS: [[number, number], [number, number]] = [[126.76,37.41],[127.19,37.72]];
const RISK_SCALE=[
  {min:80,label:"매우 위험",color:"#8E44AD"},
  {min:60,label:"위험",color:"#E74C3C"},
  {min:40,label:"주의",color:"#F39C12"},
  {min:20,label:"관심",color:"#F1C40F"},
  {min:0,label:"안전",color:"#2ECC71"},
] as const;

type DistrictCollection={type:"FeatureCollection";features:Array<{geometry:{type:"Polygon"|"MultiPolygon";coordinates:number[][][]|number[][][][]}}>};
type BoundaryFeature={type:"Feature";properties:{name:string};geometry:{type:"Polygon";coordinates:number[][][]}};

function signedArea(ring:number[][]){return ring.reduce((sum,point,index)=>{const next=ring[(index+1)%ring.length];return sum+point[0]*next[1]-next[0]*point[1]},0)}
function clockwise(ring:number[][]){return signedArea(ring)<0?ring:[...ring].reverse()}
function createOutsideMask(boundary:BoundaryFeature){return{type:"Feature" as const,properties:{},geometry:{type:"Polygon" as const,coordinates:[[[126.55,37.2],[127.4,37.2],[127.4,37.9],[126.55,37.9],[126.55,37.2]],clockwise(boundary.geometry.coordinates[0])]}}}

function featureCenter(feature:GeoJSON.Feature):[number,number]|null{
  const geometry=feature.geometry;
  if(!geometry)return null;
  const points:number[][]=[];
  if(geometry.type==="Point")return geometry.coordinates as [number,number];
  if(geometry.type==="MultiPoint"||geometry.type==="LineString")points.push(...geometry.coordinates);
  if(geometry.type==="MultiLineString")geometry.coordinates.forEach(line=>points.push(...line));
  if(geometry.type==="Polygon")points.push(...geometry.coordinates[0]);
  if(geometry.type==="MultiPolygon")geometry.coordinates.forEach(polygon=>points.push(...polygon[0]));
  if(!points.length)return null;
  const lngs=points.map(point=>point[0]);const lats=points.map(point=>point[1]);
  return[(Math.min(...lngs)+Math.max(...lngs))/2,(Math.min(...lats)+Math.max(...lats))/2];
}

function riskDisplay(scoreValue:unknown){
  const score=Math.max(0,Math.min(100,Number(scoreValue)||0));
  const scale=RISK_SCALE.find(item=>score>=item.min)??RISK_SCALE[RISK_SCALE.length-1];
  return{score,label:scale.label,color:scale.color};
}

function normalizedFeatures(collection:GeoJSON.FeatureCollection):GeoJSON.FeatureCollection{
  return{...collection,features:collection.features.map(feature=>{const display=riskDisplay(feature.properties?.risk_score);return{...feature,properties:{...feature.properties,display_color:display.color,display_level:display.label}}})};
}

type ProjectedRisk={id:string;name:string;score:number;label:string;color:string;size:number;left:number;top:number};

function projectFeatures(map:Map,collection:GeoJSON.FeatureCollection):ProjectedRisk[]{
  return collection.features.flatMap(feature=>{
    const center=featureCenter(feature);const id=feature.id??feature.properties?.id??feature.properties?.name;
    if(!center||id===undefined)return[];
    const display=riskDisplay(feature.properties?.risk_score);const point=map.project(center);
    return[{id:String(id),name:String(feature.properties?.name??id),...display,size:Math.round(30+display.score*.2),left:point.x,top:point.y}];
  });
}

function selectedRegionId(feature:MapGeoJSONFeature){
  const id=feature.id??feature.properties?.id??feature.properties?.name;
  return id===undefined?null:String(id);
}

export default function RiskMap({features,selected,onRegion}:{features:GeoJSON.FeatureCollection;selected:RiskResponse|null;onRegion:(id:string)=>void}){
  const container=useRef<HTMLDivElement>(null);const mapRef=useRef<Map|null>(null);const markerRef=useRef<maplibregl.Marker|null>(null);const[projectedRisks,setProjectedRisks]=useState<ProjectedRisk[]>([]);
  const latestFeaturesRef=useRef(features);const latestSelectedRef=useRef(selected);const onRegionRef=useRef(onRegion);latestFeaturesRef.current=features;latestSelectedRef.current=selected;onRegionRef.current=onRegion;

  const showSelection=(map:Map,result:RiskResponse|null)=>{
    markerRef.current?.remove();markerRef.current=null;if(!result)return;
    map.easeTo({center:[result.region.longitude,result.region.latitude],zoom:12.2,duration:700});
    const marker=document.createElement("div");marker.className="search-result-marker";marker.textContent=result.region.name.replace("서울특별시 ","");
    markerRef.current=new maplibregl.Marker({element:marker,anchor:"bottom"}).setLngLat([result.region.longitude,result.region.latitude]).addTo(map);
  };

  useEffect(()=>{
    if(!container.current||mapRef.current)return;
    const tileUrl=`${window.location.origin}/api/map-tile?z={z}&x={x}&y={y}`;
    const map=new maplibregl.Map({container:container.current,style:{version:8,sources:{seoulBase:{type:"raster",tiles:[tileUrl],tileSize:256,attribution:"© OpenStreetMap contributors"}},layers:[{id:"seoul-base",type:"raster",source:"seoulBase",minzoom:0,maxzoom:19}]},center:SEOUL_CENTER,zoom:10.7,minZoom:9.8,maxZoom:16,maxBounds:SEOUL_BOUNDS,renderWorldCopies:false,attributionControl:false});
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),"bottom-right");map.addControl(new maplibregl.AttributionControl({compact:true}),"bottom-left");
    map.on("load",async()=>{
      map.fitBounds(SEOUL_BOUNDS,{padding:28,duration:0});
      map.addSource("risk",{type:"geojson",data:normalizedFeatures(latestFeaturesRef.current)});
      map.addLayer({id:"risk-fill",type:"fill",source:"risk",paint:{"fill-color":["get","display_color"],"fill-opacity":0.16}});
      map.addLayer({id:"risk-line",type:"line",source:"risk",paint:{"line-color":["get","display_color"],"line-width":1.5,"line-opacity":0.8}});
      setProjectedRisks(projectFeatures(map,latestFeaturesRef.current));
      showSelection(map,latestSelectedRef.current);
      try{const[districtResponse,boundaryResponse]=await Promise.all([fetch("/seoul-districts.geojson"),fetch("/seoul-boundary.geojson")]);if(!districtResponse.ok||!boundaryResponse.ok)throw new Error();const districts=await districtResponse.json() as DistrictCollection;const boundary=await boundaryResponse.json() as BoundaryFeature;map.addSource("seoul-districts",{type:"geojson",data:districts});map.addSource("outside-seoul",{type:"geojson",data:createOutsideMask(boundary)});map.addLayer({id:"outside-seoul-mask",type:"fill",source:"outside-seoul",paint:{"fill-color":"#52605d","fill-opacity":0.56}});map.addLayer({id:"seoul-boundary",type:"line",source:"seoul-districts",paint:{"line-color":"#0d756f","line-width":1.4}})}catch{}
      const label=document.createElement("div");label.className="seoul-map-label";label.textContent="서울특별시";new maplibregl.Marker({element:label,anchor:"bottom"}).setLngLat(SEOUL_CENTER).addTo(map);
    });
    const syncRiskPositions=()=>setProjectedRisks(projectFeatures(map,latestFeaturesRef.current));
    map.on("move",syncRiskPositions);map.on("resize",syncRiskPositions);
    map.on("click",event=>{const hit=map.queryRenderedFeatures(event.point,{layers:["risk-fill"]})[0];if(!hit)return;const id=selectedRegionId(hit);if(id)onRegionRef.current(id)});
    map.on("mouseenter","risk-fill",()=>{map.getCanvas().style.cursor="pointer"});map.on("mouseleave","risk-fill",()=>{map.getCanvas().style.cursor=""});
    mapRef.current=map;return()=>{map.remove();mapRef.current=null};
  },[]);

  useEffect(()=>{const map=mapRef.current;if(!map)return;setProjectedRisks(projectFeatures(map,features));const source=map.getSource("risk") as GeoJSONSource|undefined;if(source)source.setData(normalizedFeatures(features));else map.once("load",()=>{(map.getSource("risk") as GeoJSONSource|undefined)?.setData(normalizedFeatures(features));setProjectedRisks(projectFeatures(map,features))})},[features]);
  useEffect(()=>{const map=mapRef.current;if(!map)return;if(map.getCanvas())showSelection(map,selected);else map.once("load",()=>showSelection(map,selected))},[selected]);

  return <div className="maplibre-wrap" data-risk-count={features.features.length}><div ref={container} className="maplibre-map"/><div className="risk-marker-overlay" aria-label={`위험 지역 ${projectedRisks.length}곳`}>{projectedRisks.map(point=><button key={point.id} type="button" className="risk-score-marker" style={{left:point.left,top:point.top,width:point.size,height:point.size,backgroundColor:point.color}} aria-label={`${point.name} 위험도 ${point.label} ${Math.round(point.score)}점`} title={`${point.name} · ${point.label} · ${Math.round(point.score)}점`} onClick={()=>onRegion(point.id)}>{Math.round(point.score)}</button>)}</div><div className="legend five-levels"><span><i className="safe"/>안전</span><span><i className="interest"/>관심</span><span><i className="caution"/>주의</span><span><i className="alert"/>위험</span><span><i className="danger"/>매우 위험</span></div><p className="map-hint">위험도 원을 선택하면 지역 상세 정보를 확인할 수 있어요.</p></div>;
}
