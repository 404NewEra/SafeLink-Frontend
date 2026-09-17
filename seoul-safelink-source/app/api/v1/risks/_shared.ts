import type { RiskLevel, RiskResponse } from "@/lib/risk-api";

const BACKEND_URL = "http://127.0.0.1:8000";

export const districts: Record<string, [number, number]> = {
  강남구:[127.0473,37.5172],강동구:[127.1238,37.5301],강북구:[127.0255,37.6396],강서구:[126.8495,37.5509],
  관악구:[126.9516,37.4784],광진구:[127.0824,37.5385],구로구:[126.8876,37.4955],금천구:[126.8954,37.4569],
  노원구:[127.0568,37.6542],도봉구:[127.0471,37.6688],동대문구:[127.0396,37.5744],동작구:[126.9395,37.5124],
  마포구:[126.9018,37.5663],서대문구:[126.9368,37.5791],서초구:[127.0327,37.4837],성동구:[127.0368,37.5633],
  성북구:[127.0167,37.5894],송파구:[127.1059,37.5145],양천구:[126.8665,37.5170],영등포구:[126.8962,37.5264],
  용산구:[126.9900,37.5326],은평구:[126.9291,37.6027],종로구:[126.9788,37.5735],중구:[126.9976,37.5641],중랑구:[127.0927,37.6063],
};

export const aliases: Record<string, string> = {
  잠실:"송파구",홍대:"마포구",여의도:"영등포구",이태원:"용산구",명동:"중구",광화문:"종로구",신림:"관악구",
  압구정:"강남구",청담:"강남구",강남역:"강남구",건대:"광진구",왕십리:"성동구",목동:"양천구",
};

type BackendDetail = {
  region: { id:string; name:string; center:number[] };
  risk: { overall_score:number; landslide_risk_score:number; heavy_rain_risk_score:number; cascade_risk_score:number };
  weather_summary: { observed_to:string; latest_rain_60m_mm?:number; latest_rain_1h_mm?:number; latest_rain_24h_mm:number };
  cascading_disasters:Array<{ type:string; possibility:string; description:string }>;
  action_recommendation:string;
};

type BackendMap = {
  geojson:GeoJSON.FeatureCollection;
  observation_date:string;
  weather_source:string;
};

function riskLevel(score:number):RiskLevel {
  return score>=80?"매우 위험":score>=60?"위험":score>=40?"주의":score>=20?"관심":"안전";
}

function risk(score:number){
  const value=Math.max(0,Math.min(100,Math.round(score)));
  return {score:value,level:riskLevel(value)};
}

function isBackendDetail(value:unknown):value is BackendDetail {
  if(!value||typeof value!=="object")return false;
  const detail=value as Partial<BackendDetail>;
  return Boolean(detail.region&&Array.isArray(detail.region.center)&&detail.risk&&detail.weather_summary);
}

export function resolveDistrict(query:string){
  return Object.keys(districts).find(district=>query.includes(district))
    ??Object.entries(aliases).find(([alias])=>query.includes(alias))?.[1];
}

export function nearestDistrict(latitude:number,longitude:number){
  return Object.entries(districts).reduce((nearest,[name,[lng,lat]])=>{
    const distance=(latitude-lat)**2+(longitude-lng)**2;
    return distance<nearest.distance?{name,distance}:nearest;
  },{name:"관악구",distance:Number.POSITIVE_INFINITY}).name;
}

export async function fetchBackendRisk(region:string){
  try{
    const url=`${BACKEND_URL}/map/${encodeURIComponent(region)}`;
    let detailResponse=await fetch(url,{cache:"no-store"});
    if(detailResponse.status>=500){
      await new Promise(resolve=>setTimeout(resolve,250));
      detailResponse=await fetch(url,{cache:"no-store"});
    }
    if(!detailResponse.ok){
      const message=detailResponse.status===404?"해당 지역을 찾을 수 없습니다.":"백엔드에서 위험 정보를 불러오지 못했습니다.";
      return Response.json({message},{status:detailResponse.status});
    }
    const detail:unknown=await detailResponse.json();
    if(!isBackendDetail(detail))return Response.json({message:"백엔드 응답 형식이 올바르지 않습니다."},{status:502});
    const [longitude,latitude]=detail.region.center;
    const cascade=detail.cascading_disasters?.[0];
    const regionName=detail.region.name.startsWith("서울특별시")?detail.region.name:`서울특별시 ${detail.region.name}`;
    const result:RiskResponse={
      region:{name:regionName,latitude,longitude},
      rainfall:{
        forecastMm:detail.weather_summary.latest_rain_60m_mm??detail.weather_summary.latest_rain_1h_mm??0,
        accumulated3dMm:detail.weather_summary.latest_rain_24h_mm??0,
      },
      risks:{
        overall:risk(detail.risk.overall_score),
        landslide:risk(detail.risk.landslide_risk_score),
        flood:risk(detail.risk.heavy_rain_risk_score),
        cascade:risk(detail.risk.cascade_risk_score),
      },
      analysis:{
        headline:cascade?`${cascade.type} 가능성: ${cascade.possibility}`:"지역 위험 분석 결과입니다.",
        description:cascade?.description||detail.action_recommendation,
        flow:["집중호우","토양 포화","산사태","침수 확산"],
      },
      actionRecommendation:detail.action_recommendation,
      map:{features:{type:"FeatureCollection",features:[]}},
      meta:{source:"backend",analyzedAt:detail.weather_summary.observed_to||new Date().toISOString()},
    };
    return Response.json(result);
  }catch{
    return Response.json({message:"백엔드 서버에 연결할 수 없습니다."},{status:502});
  }
}

export async function fetchBackendMap(){
  try{
    const response=await fetch(`${BACKEND_URL}/map`,{cache:"no-store"});
    if(!response.ok)return Response.json({message:"백엔드에서 위험지도를 불러오지 못했습니다."},{status:response.status});
    const map=await response.json() as BackendMap;
    if(!map?.geojson||map.geojson.type!=="FeatureCollection"){
      return Response.json({message:"백엔드 지도 응답 형식이 올바르지 않습니다."},{status:502});
    }
    return Response.json({features:map.geojson,observationDate:map.observation_date,weatherSource:map.weather_source});
  }catch{
    return Response.json({message:"백엔드 서버에 연결할 수 없습니다."},{status:502});
  }
}
