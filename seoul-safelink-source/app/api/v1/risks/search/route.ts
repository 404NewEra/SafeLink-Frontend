import { demoRisk, forwardOrDemo } from "../_shared";

const districts: Record<string, [number, number]> = {
  강남구:[127.0473,37.5172],강동구:[127.1238,37.5301],강북구:[127.0255,37.6396],강서구:[126.8495,37.5509],
  관악구:[126.9516,37.4784],광진구:[127.0824,37.5385],구로구:[126.8876,37.4955],금천구:[126.8954,37.4569],
  노원구:[127.0568,37.6542],도봉구:[127.0471,37.6688],동대문구:[127.0396,37.5744],동작구:[126.9395,37.5124],
  마포구:[126.9018,37.5663],서대문구:[126.9368,37.5791],서초구:[127.0327,37.4837],성동구:[127.0368,37.5633],
  성북구:[127.0167,37.5894],송파구:[127.1059,37.5145],양천구:[126.8665,37.5170],영등포구:[126.8962,37.5264],
  용산구:[126.9900,37.5326],은평구:[126.9291,37.6027],종로구:[126.9788,37.5735],중구:[126.9976,37.5641],중랑구:[127.0927,37.6063],
};

const aliases: Record<string, string> = {
  잠실:"송파구",홍대:"마포구",여의도:"영등포구",이태원:"용산구",명동:"중구",광화문:"종로구",신림:"관악구",
  압구정:"강남구",청담:"강남구",강남역:"강남구",건대:"광진구",왕십리:"성동구",목동:"양천구",
};

export async function POST(request:Request){
  const body=await request.json() as {query?:string};
  const query=body.query?.trim();
  if(!query)return Response.json({message:"query가 필요합니다."},{status:400});
  const name=Object.keys(districts).find(district=>query.includes(district))??Object.entries(aliases).find(([alias])=>query.includes(alias))?.[1];
  if(!name)return Response.json({message:"서울의 구 이름으로 검색해 주세요. 예: 송파구, 마포구"},{status:400});
  return forwardOrDemo("/api/v1/risks/search",body,()=>demoRisk(name,districts[name]));
}
