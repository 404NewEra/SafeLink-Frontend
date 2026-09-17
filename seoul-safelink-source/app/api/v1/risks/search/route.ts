import { fetchBackendRisk, resolveDistrict } from "../_shared";

export async function POST(request:Request){
  const body=await request.json() as {query?:string};
  const query=body.query?.trim();
  if(!query)return Response.json({message:"query가 필요합니다."},{status:400});
  if(/^\d+$/.test(query))return fetchBackendRisk(query);
  const region=resolveDistrict(query);
  if(!region)return Response.json({message:"서울의 구 이름으로 검색해 주세요. 예: 송파구, 마포구"},{status:400});
  return fetchBackendRisk(region);
}
