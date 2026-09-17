import type { RiskResponse } from "@/lib/risk-api";

const presets: Record<string, [number, number, number, number, number]> = {
  "관악구": [126.9516, 37.4784, 63, 124, 78], "강남구": [127.0473, 37.5172, 48, 92, 62],
  "서초구": [127.0327, 37.4837, 52, 103, 66], "종로구": [126.9788, 37.5735, 31, 71, 39],
};

function level(score:number):RiskResponse["risks"]["overall"]["level"] {
  return score >= 80 ? "위험" : score >= 60 ? "경계" : score >= 40 ? "주의" : score >= 20 ? "관심" : "안전";
}

export function demoRisk(name="관악구", coordinates?:[number,number]):RiskResponse {
  const p=presets[name] ?? presets["관악구"]; const [lng,lat]=coordinates ?? [p[0],p[1]]; const score=p[4];
  const mapLevel=score>=80?"danger":score>=60?"alert":score>=40?"caution":score>=20?"interest":"safe";
  const mapColor={safe:"#16948A",interest:"#FFC94A",caution:"#FF8647",alert:"#E34836",danger:"#AD5CE3"}[mapLevel];
  const ring=(radius:number):GeoJSON.Position[]=>Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return[lng+Math.cos(a)*radius,lat+Math.sin(a)*radius]});
  return {
    region:{name:`서울특별시 ${name}`,latitude:lat,longitude:lng}, rainfall:{forecastMm:p[2],accumulated3dMm:p[3]},
    risks:{overall:{score,level:level(score)},landslide:{score:Math.min(96,score+5),level:level(score+5)},flood:{score:Math.max(15,score-13),level:level(score-13)},cascade:{score,level:level(score)}},
    analysis:{headline:"집중호우로 인한 연쇄재난 가능성에 주의하세요.",description:"최근 누적 강수량이 높고 산사태 위험지역과 과거 침수지역이 인접해 있습니다. 산사태 발생 시 토사가 배수시설을 막아 저지대 침수로 이어질 가능성이 있습니다.",flow:["집중호우","토양 포화","산사태","침수 확산"]},
    map:{features:{type:"FeatureCollection",features:[{type:"Feature",properties:{risk_level:mapLevel,risk_score:score,risk_label:level(score),risk_color:mapColor,name},geometry:{type:"Polygon",coordinates:[ring(.025)]}}]}}, meta:{source:"demo",analyzedAt:new Date().toISOString()}
  };
}

export async function forwardOrDemo(path:string,body:unknown,fallback:()=>RiskResponse){
  const base=process.env.BACKEND_API_URL?.replace(/\/$/,"");
  if(!base) return Response.json(fallback());
  try{const res=await fetch(`${base}${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});const data=await res.json();return Response.json(data,{status:res.status})}
  catch{return Response.json({message:"백엔드 서버에 연결할 수 없습니다."},{status:502})}
}
