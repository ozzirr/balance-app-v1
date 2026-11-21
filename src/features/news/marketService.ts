import { newsApiUrl } from "./newsService";

export type MarketPeriod = "1d" | "1m" | "1y";

export type MarketSnapshot = {
  symbol: string;
  exchange: string;
  currency: string;
  quote: { price: number; changePercent: number | null; timestamp: number | null } | null;
  points: { date: string; close: number }[];
};

export async function loadMarketSnapshot(id: string, period: MarketPeriod, signal: AbortSignal): Promise<MarketSnapshot | null> {
  const apiUrl = newsApiUrl();
  if (!apiUrl) return null;
  const response = await fetch(`${apiUrl}/v1/market/quote?id=${encodeURIComponent(id)}&period=${period}`, { signal });
  if (!response.ok) return null;
  const data = await response.json() as MarketSnapshot;
  return Array.isArray(data?.points) && /^[A-Z]{3}$/.test(data.currency) ? data : null;
}
