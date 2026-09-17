import { fetchBackendMap } from "../_shared";

export async function GET(){
  return fetchBackendMap();
}
