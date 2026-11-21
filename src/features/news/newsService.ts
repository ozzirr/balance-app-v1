import { NEWS_SOURCES } from "./catalog";
import type { NewsFeedResult, NewsItem, NewsTopicId } from "./types";

// The UI consumes this boundary instead of fetching publisher feeds directly.
// A backend implementation can replace this preview provider without changing the screen.
const PREVIEW_ITEMS: NewsItem[] = [
  {
    id: "preview-ecb",
    title: "Decisioni sui tassi e comunicazioni di politica monetaria",
    summary: "Aggiornamenti ufficiali della BCE su tassi, inflazione e condizioni finanziarie nell'area euro.",
    source: NEWS_SOURCES.ecb,
    url: NEWS_SOURCES.ecb.homepageUrl,
    topics: ["rates", "markets", "personal-finance"],
    whyItMatters: "Tassi e inflazione possono incidere su mutui, liquidità e obbligazioni.",
    isPreview: true,
  },
  {
    id: "preview-fed",
    title: "Politica monetaria e mercati internazionali",
    summary: "Comunicati ufficiali della Federal Reserve e aggiornamenti sulle decisioni di politica monetaria USA.",
    source: NEWS_SOURCES.fed,
    url: NEWS_SOURCES.fed.homepageUrl,
    topics: ["rates", "markets", "investing"],
    whyItMatters: "Le decisioni della Fed influenzano valute, azioni e rendimenti globali.",
    isPreview: true,
  },
  {
    id: "preview-sec",
    title: "Avvisi per investitori e tutela del risparmio",
    summary: "Alert ufficiali su rischi, frodi, nuovi prodotti finanziari e buone pratiche per gli investitori.",
    source: NEWS_SOURCES.sec,
    url: NEWS_SOURCES.sec.homepageUrl,
    topics: ["investing", "personal-finance", "crypto"],
    whyItMatters: "Aiuta a riconoscere rischi e offerte finanziarie potenzialmente ingannevoli.",
    isPreview: true,
  },
];

let lastLiveResult: NewsFeedResult | null = null;

export function newsApiUrl() {
  return process.env.EXPO_PUBLIC_NEWS_API_URL?.trim().replace(/\/$/, "");
}

function resolveArchivedImages(items: NewsItem[], apiUrl: string): NewsItem[] {
  return items.map((item) => item.imageUrl && /^\/v1\/news\/image\/[a-f0-9]{64}$/.test(item.imageUrl)
    ? { ...item, imageUrl: `${apiUrl}${item.imageUrl}` }
    : item);
}

export async function loadInstrumentNews(instrument: string, signal: AbortSignal): Promise<{ items: NewsItem[]; stale: boolean }> {
  const apiUrl = newsApiUrl();
  if (!apiUrl) throw new Error("News service not configured");
  const response = await fetch(`${apiUrl}/v1/news/instrument?id=${encodeURIComponent(instrument)}`, { signal });
  if (!response.ok) throw new Error("Instrument search unavailable");
  const result = await response.json();
  if (!Array.isArray(result.items)) throw new Error("Invalid instrument results");
  return { items: resolveArchivedImages(result.items, apiUrl), stale: result.stale === true };
}

export async function loadNewsFeed(topics: NewsTopicId[], cursor?: string): Promise<NewsFeedResult> {
  const apiUrl = newsApiUrl();
  if (apiUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const query = encodeURIComponent(topics.join(","));
      const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const response = await fetch(`${apiUrl}/v1/news?topics=${query}&locale=it-IT&limit=10${cursorQuery}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`News proxy returned ${response.status}`);
      const result = (await response.json()) as NewsFeedResult;
      if (result.mode !== "live" || !Array.isArray(result.items)) {
        throw new Error("Invalid news proxy response");
      }
      lastLiveResult = { ...result, items: resolveArchivedImages(result.items, apiUrl) };
      return lastLiveResult;
    } catch (error) {
      console.warn("Live news unavailable, using preview feed:", error);
      if (cursor) throw error;
      if (lastLiveResult) {
        return {
          ...lastLiveResult,
          items: lastLiveResult.items.filter((item) => item.topics.some((topic) => topics.includes(topic))),
          cached: true,
          stale: true,
          fallbackReason: "unavailable",
        };
      }
      return buildPreviewFeed(topics, "unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  return buildPreviewFeed(topics, "not-configured");
}

function buildPreviewFeed(
  topics: NewsTopicId[],
  fallbackReason: NewsFeedResult["fallbackReason"]
): NewsFeedResult {
  const items = PREVIEW_ITEMS.filter((item) => item.topics.some((topic) => topics.includes(topic)));
  return {
    items,
    mode: "preview",
    refreshedAt: new Date().toISOString(),
    fallbackReason,
  };
}
