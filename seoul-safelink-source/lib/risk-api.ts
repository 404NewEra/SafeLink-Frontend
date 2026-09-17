export type RiskLevel = "안전" | "관심" | "주의" | "경계" | "위험";

export type RiskRequest =
  | { type: "search"; query: string }
  | { type: "location"; latitude: number; longitude: number };

export type RiskResponse = {
  region: { name: string; latitude: number; longitude: number };
  rainfall: { forecastMm: number; accumulated3dMm: number };
  risks: {
    overall: { score: number; level: RiskLevel };
    landslide: { score: number; level: RiskLevel };
    flood: { score: number; level: RiskLevel };
    cascade: { score: number; level: RiskLevel };
  };
  analysis: { headline: string; description: string; flow: string[] };
  map: { features: GeoJSON.FeatureCollection };
  meta: { source: "backend" | "demo"; analyzedAt: string };
};

async function post<TBody, TResponse>(path: string, body: TBody): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? "위험도 분석 요청에 실패했습니다.");
  return data as TResponse;
}

export const riskApi = {
  search: (query: string) => post<{ query: string }, RiskResponse>("/api/v1/risks/search", { query }),
  location: (latitude: number, longitude: number) =>
    post<{ latitude: number; longitude: number }, RiskResponse>("/api/v1/risks/location", { latitude, longitude }),
};
