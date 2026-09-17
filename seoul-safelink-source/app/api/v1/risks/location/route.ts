import { fetchBackendRisk, nearestDistrict } from "../_shared";

export async function POST(request:Request){
  const body=await request.json() as {latitude?:number;longitude?:number};
  if(!Number.isFinite(body.latitude)||!Number.isFinite(body.longitude)){
    return Response.json({message:"latitude와 longitude가 필요합니다."},{status:400});
  }
  return fetchBackendRisk(nearestDistrict(body.latitude!,body.longitude!));
}
