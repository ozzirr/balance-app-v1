import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import newsCore from "./news-core.js";
import newsCache from "./news-cache.js";
import instruments from "./news-instruments.js";
import newsStore from "./news-store.js";
import newsMedia from "./news-media.js";
import { createMarketQuotes, isMarketPeriod } from "./market-quotes.mjs";

const { getCatalogInstrument, instrumentQuery, mentionsInstrument, isInvestorStory, ISSUER_FEEDS } = instruments;
const { openNewsStore, DAY_MS: WINDOW_MS, imageKeyForUrl } = newsStore;
const { allowedArchiveUrl, readArchiveImage } = newsMedia;

const {
  TOPIC_KEYWORDS,
  classifyTopics,
  fetchOfficialFeeds,
  limitBySource,
  mergeNewsItems,
  normalizeAggregatorArticle,
  paginateItems,
  parseOfficialFeed,
  parseIntesaReleases,
} = newsCore;
const { loadPersistentCache, resolveCacheFile } = newsCache;

function loadLocalEnv() {
  try {
    const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Environment variables can also be supplied by the hosting platform.
  }
}

loadLocalEnv();

const gnewsApiKey = process.env.GNEWS_API_KEY?.trim();
const newsApiAiKey = process.env.NEWSAPI_AI_KEY?.trim();
const getMarketQuote = createMarketQuotes({ apiKey: process.env.TWELVE_DATA_API_KEY?.trim() });
const commercialProvider = gnewsApiKey ? "gnews" : newsApiAiKey ? "newsapi.ai" : null;
const activeProvider = commercialProvider ? `official+${commercialProvider}` : "official";
const port = Number(process.env.NEWS_PROXY_PORT ?? 8787);
const cacheTtlMs = Number(process.env.NEWS_CACHE_TTL_SECONDS ?? 1800) * 1000;
const imagePolicy = process.env.NEWS_IMAGE_POLICY === "development" ? "development" : "licensed-only";
const allowedImageHosts = (process.env.NEWS_IMAGE_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim().toLocaleLowerCase())
  .filter(Boolean);
const archiveImageHosts = new Set((process.env.NEWS_IMAGE_ARCHIVE_HOSTS ?? "")
  .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
const instrumentRequests = new Map();
const cacheFile = resolveCacheFile(process.env.NEWS_CACHE_FILE);
const store = openNewsStore(resolve(process.env.NEWS_DB_FILE || ".cache/news.sqlite"));
const globalKey = "global-finance-feed";
const instrumentRetryAfter = new Map();
const imageRequests = new Map();
let gnewsRequestSlots = Promise.resolve();
let nextGNewsRequestAt = 0;
let globalFeedRequest;

function archiveImageUrl(item) {
  return item.imageStatus === "licensed" && item.source.canDisplayImage
    ? archiveSource(item.imageUrl) : null;
}

function archiveSource(value) {
  const url = allowedArchiveUrl(value, archiveImageHosts);
  if (!url) return null;
  const host = new URL(url).hostname;
  return allowedImageHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ? url : null;
}

function forClient(item) {
  const url = archiveImageUrl(item);
  return url ? { ...item, imageUrl: `/v1/news/image/${imageKeyForUrl(url)}` } : item;
}

function readSnapshot(key) {
  const snapshot = store.read(key);
  return snapshot?.result.imagePolicy === imagePolicy ? snapshot : null;
}

async function migrateLegacySnapshot(key, file) {
  if (store.read(key)) return;
  const snapshot = await loadPersistentCache(file);
  if (snapshot?.result.imagePolicy === imagePolicy && Date.now() - snapshot.createdAt < 60 * WINDOW_MS) {
    store.write(key, snapshot, archiveImageUrl);
  }
}

const legacySnapshots = [
  [globalKey, cacheFile],
  ...instruments.catalog.map(({ id }) => [`instrument:${id}`, `${cacheFile}.instrument-${id}.json`]),
];
await Promise.all(legacySnapshots.map(([key, file]) => migrateLegacySnapshot(key, file)));

async function pruneLegacySnapshots() {
  await Promise.all(legacySnapshots.map(async ([, file]) => {
    const snapshot = await loadPersistentCache(file);
    if (snapshot && Date.now() - snapshot.createdAt >= 60 * WINDOW_MS) {
      await unlink(file).catch(() => {});
    }
  }));
}

store.prune();
await pruneLegacySnapshots();
const pruneTimer = setInterval(() => {
  try { store.prune(); } catch { console.warn("[news-proxy] News retention cleanup failed"); }
  void pruneLegacySnapshots();
}, 60 * 60 * 1000);
pruneTimer.unref();

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": status === 200 ? "public, max-age=120" : "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

async function fetchNews(selectedTopics) {
  const officialPromise = fetchOfficialFeeds();
  const commercialPromise = commercialProvider === "gnews"
    ? fetchGNews(selectedTopics)
    : commercialProvider === "newsapi.ai"
      ? fetchNewsApiAi(selectedTopics)
      : Promise.resolve([]);
  const [official, commercial] = await Promise.allSettled([officialPromise, commercialPromise]);
  const officialItems = official.status === "fulfilled" ? official.value.items : [];
  const commercialItems = commercial.status === "fulfilled" ? commercial.value : [];
  const merged = mergeNewsItems(officialItems, commercialItems);
  if (merged.length === 0) {
    const errors = [
      official.status === "rejected" ? String(official.reason) : official.value.errors.join("; "),
      commercial.status === "rejected" ? String(commercial.reason) : "",
    ].filter(Boolean);
    throw new Error(errors.join("; ") || "No news available");
  }
  const officialSources = official.status === "fulfilled"
    ? official.value.sources
    : ["ecb", "fed", "sec"].map((id) => ({ id, status: "error", itemCount: 0, error: "Official feed group unavailable" }));
  const commercialSource = {
    id: commercialProvider ?? "commercial",
    status: commercialProvider ? (commercial.status === "fulfilled" ? "ok" : "error") : "disabled",
    itemCount: commercialItems.length,
    error: commercial.status === "rejected" ? String(commercial.reason).slice(0, 160) : undefined,
  };
  return { items: limitBySource(merged), sources: [...officialSources, commercialSource] };
}

function sendNewsResult(response, result, topics, url, metadata = {}, headers = {}) {
  const filteredItems = result.items.flatMap((item) => {
    const validTopics = item.source.kind === "institutional" ? item.topics
      : classifyTopics({ title: item.title, body: item.summary, url: item.url }, item.topics);
    return validTopics.some((topic) => topics.includes(topic)) ? [{ ...item, topics: validTopics }] : [];
  });
  const page = paginateItems(filteredItems, url.searchParams.get("cursor"), url.searchParams.get("limit"));
  sendJson(response, 200, { ...result, ...metadata, ...page, items: page.items.map(forClient) }, headers);
}

async function fetchGNews(selectedTopics, instrument) {
  const searchParams = new URLSearchParams({
    q: '"borsa valori" OR "Wall Street" OR Nasdaq OR "mercati finanziari" OR obbligazioni OR ETF OR "tassi di interesse" OR inflazione OR mutui OR pensioni OR bitcoin OR "mercato immobiliare" OR fisco',
    in: "title,description",
    lang: "it",
    country: "it",
    max: "10",
    nullable: "description,content,image",
  });
  if (instrument) {
    searchParams.set("q", instrumentQuery(instrument));
    searchParams.delete("country");
    searchParams.set("sortby", "relevance");
  }
  const slot = gnewsRequestSlots.then(async () => {
    const wait = nextGNewsRequestAt - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    nextGNewsRequestAt = Date.now() + 1100;
  });
  gnewsRequestSlots = slot.catch(() => {});
  await slot;
  const upstreamResponse = await fetch(`https://gnews.io/api/v4/search?${searchParams}`, {
    headers: { Accept: "application/json", "X-Api-Key": gnewsApiKey },
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await upstreamResponse.json();
  if (!upstreamResponse.ok || payload?.errors) {
    console.warn(`[news-proxy] GNews returned status ${upstreamResponse.status}`);
    const message = Array.isArray(payload?.errors) ? payload.errors.join(", ") : payload?.message;
    throw new Error(message || `GNews returned ${upstreamResponse.status}`);
  }

  const results = Array.isArray(payload?.articles) ? payload.articles : [];
  return results
    .filter((article) => article?.title && article?.url &&
      (!instrument || instrument.aliases.some((alias) => mentionsInstrument(article.title, article.description || article.content, alias))))
    .map((article, index) =>
      normalizeAggregatorArticle(
        {
          uri: article.url || `gnews-${index}`,
          title: article.title,
          body: article.description || article.content,
          url: article.url,
          image: article.image,
          dateTimePub: article.publishedAt,
          source: {
            title: article.source?.name,
            uri: article.source?.url,
          },
        },
        selectedTopics,
        { allowUnverifiedImages: imagePolicy === "development", allowedImageHosts, fallbackTopic: instrument ? "investing" : undefined }
      )
    )
    .filter(Boolean);
}

async function fetchIssuerNews(instrument) {
  const issuer = ISSUER_FEEDS[instrument.id];
  if (!issuer) return [];
  const [name, homepageUrl, feedUrl] = issuer;
  const response = await fetch(feedUrl, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("Issuer feed unavailable");
  const parse = instrument.id === "isp" ? parseIntesaReleases : parseOfficialFeed;
  const items = parse(await response.text(), {
    id: `issuer-${instrument.id}`, name, homepageUrl, feedUrl, topics: ["investing"],
  });
  const newest = Date.now() - 30 * WINDOW_MS;
  return items.filter((item) => Date.parse(item.publishedAt) >= newest && isInvestorStory(item)).slice(0, 5);
}

async function loadInstrumentNews(instrument) {
  const id = instrument.id;
  const key = `instrument:${id}`;
  const cached = readSnapshot(key);
  const ttl = cached?.result.degraded ? 60 * 60 * 1000
    : cached?.result.items.length ? WINDOW_MS : 6 * 60 * 60 * 1000;
  const version = id === "isp" || id === "g" ? 4 : 3;
  if (cached?.result.instrumentVersion === version && Date.now() - cached.createdAt < ttl) {
    return { items: cached.result.items, stale: cached.result.degraded };
  }
  if (Date.now() < (instrumentRetryAfter.get(id) ?? 0)) {
    if (cached?.result.items.length) return { items: cached.result.items, stale: true };
    throw new Error("Instrument search cooling down");
  }
  let request = instrumentRequests.get(id);
  if (!request) {
    request = Promise.allSettled([
      gnewsApiKey ? fetchGNews(Object.keys(TOPIC_KEYWORDS), instrument) : Promise.resolve([]),
      fetchIssuerNews(instrument),
    ])
      .then(async ([commercial, issuer]) => {
        const shared = (readSnapshot(globalKey)?.result.items ?? []).filter((item) =>
          Date.parse(item.publishedAt) >= Date.now() - 7 * WINDOW_MS &&
          classifyTopics({ title: item.title, body: item.summary, url: item.url }).length &&
          instrument.aliases.some((alias) => mentionsInstrument(item.title, item.summary, alias))
        );
        const merged = mergeNewsItems(
          issuer.status === "fulfilled" ? issuer.value : [],
          commercial.status === "fulfilled" ? commercial.value : [],
          shared,
        ).filter(isInvestorStory);
        if (!merged.length && (commercial.status === "rejected" || issuer.status === "rejected")) {
          throw new Error("Instrument sources unavailable");
        }
        const degraded = commercial.status === "rejected" || issuer.status === "rejected";
        const snapshot = { createdAt: Date.now(), result: { mode: "live", items: merged, imagePolicy, instrumentVersion: version, degraded } };
        const result = store.write(key, snapshot, archiveImageUrl);
        return { items: result.items, stale: degraded };
      })
      .catch((error) => {
        instrumentRetryAfter.set(id, Date.now() + 60 * 60 * 1000);
        if (cached?.result.items.length) return { items: cached.result.items, stale: true };
        throw error;
      })
      .finally(() => instrumentRequests.delete(id));
    instrumentRequests.set(id, request);
  }
  return request;
}

async function loadArchivedImage(key) {
  const stored = store.image(key);
  if (!stored || !archiveSource(stored.url)) return null;
  if (stored.bytes) return stored;
  let pending = imageRequests.get(key);
  if (!pending) {
    pending = readArchiveImage(stored.url).then((image) => {
      store.writeImage(key, image.mime, image.bytes);
      return store.image(key);
    }).finally(() => imageRequests.delete(key));
    imageRequests.set(key, pending);
  }
  return pending;
}

async function fetchNewsApiAi(selectedTopics) {
  const keywords = [...new Set(selectedTopics.flatMap((topic) => TOPIC_KEYWORDS[topic] ?? []))].slice(0, 60);
  const upstreamResponse = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getArticles",
      keyword: keywords,
      keywordOper: "or",
      keywordLoc: "title,body",
      keywordSearchMode: "simple",
      lang: ["ita", "eng"],
      dataType: ["news", "pr"],
      articlesPage: 1,
      articlesCount: 50,
      articlesSortBy: "date",
      articlesSortByAsc: false,
      articlesArticleBodyLen: 400,
      includeArticleImage: true,
      includeArticleConcepts: false,
      includeArticleCategories: false,
      resultType: "articles",
      forceMaxDataTimeWindow: 7,
      apiKey: newsApiAiKey,
    }),
  });

  const payload = await upstreamResponse.json();
  if (!upstreamResponse.ok || payload?.error) {
    const message = payload?.error?.message || payload?.error || `NewsAPI.ai returned ${upstreamResponse.status}`;
    throw new Error(String(message));
  }

  const results = Array.isArray(payload?.articles?.results) ? payload.articles.results : [];
  return results
    .filter((article) => article && article.isDuplicate !== true && article.title && article.url)
    .map((article) => normalizeAggregatorArticle(article, selectedTopics, {
      allowUnverifiedImages: imagePolicy === "development",
      allowedImageHosts,
    }))
    .filter(Boolean);
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const imageKey = /^\/v1\/news\/image\/([0-9a-f]{64})$/.exec(url.pathname)?.[1];
  if (request.method === "GET" && imageKey) {
    try {
      const image = await loadArchivedImage(imageKey);
      if (!image?.bytes) return sendJson(response, 404, { error: "Image unavailable" });
      response.writeHead(200, {
        "Content-Type": image.mime,
        "Content-Length": image.bytes.byteLength,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      });
      return response.end(image.bytes);
    } catch {
      return sendJson(response, 502, { error: "Image unavailable" });
    }
  }
  if (request.method === "GET" && url.pathname === "/health") {
    const cached = readSnapshot(globalKey);
    sendJson(response, 200, {
      ok: true,
      provider: activeProvider,
      configured: true,
      cache: cached ? {
        ageSeconds: Math.max(0, Math.round((Date.now() - cached.createdAt) / 1000)),
        itemCount: cached.result.items.length,
        persistent: true,
      } : null,
      sources: cached?.result.sources ?? [],
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/market/quote") {
    const instrument = getCatalogInstrument(url.searchParams.get("id"));
    const period = url.searchParams.get("period") ?? "1m";
    const headers = { "Cache-Control": "private, no-store" };
    if (!instrument || !isMarketPeriod(period)) {
      return sendJson(response, 400, { error: "Invalid instrument or period" }, headers);
    }
    const result = await getMarketQuote(instrument, period);
    return result
      ? sendJson(response, 200, result, headers)
      : sendJson(response, 503, { error: "Market data unavailable" }, headers);
  }

  if (request.method !== "GET" || !["/v1/news", "/v1/news/instrument"].includes(url.pathname)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (url.pathname === "/v1/news/instrument") {
    const instrument = getCatalogInstrument(url.searchParams.get("id"));
    const headers = { "Cache-Control": "private, no-store" };
    if (!instrument) return sendJson(response, 400, { error: "Unknown catalog instrument" }, headers);
    if (!gnewsApiKey && !ISSUER_FEEDS[instrument.id]) return sendJson(response, 503, { error: "Instrument search unavailable" }, headers);
    try {
      const result = await loadInstrumentNews(instrument);
      return sendJson(response, 200, { ...result, items: result.items.filter(isInvestorStory).map(forClient) }, headers);
    } catch {
      return sendJson(response, 502, { error: "Instrument search unavailable" }, headers);
    }
  }

  const selectedTopics = (url.searchParams.get("topics") ?? "markets,rates,investing,personal-finance")
    .split(",")
    .filter((topic) => topic in TOPIC_KEYWORDS);
  const topics = selectedTopics.length > 0 ? selectedTopics : ["markets", "rates"];
  const cached = readSnapshot(globalKey);

  if (cached && Date.now() - cached.createdAt < cacheTtlMs) {
    sendNewsResult(response, cached.result, topics, url, { cached: true });
    return;
  }

  try {
    if (!globalFeedRequest) {
      globalFeedRequest = fetchNews(Object.keys(TOPIC_KEYWORDS)).then((news) => {
        const result = { ...news, mode: "live", refreshedAt: new Date().toISOString(), provider: activeProvider, imagePolicy };
        return store.write(globalKey, { createdAt: Date.now(), result }, archiveImageUrl);
      }).finally(() => { globalFeedRequest = undefined; });
    }
    const result = await globalFeedRequest;
    sendNewsResult(response, result, topics, url);
  } catch (error) {
    if (cached) {
      sendNewsResult(response, cached.result, topics, url, { cached: true, stale: true });
      return;
    }
    sendJson(response, 502, { error: "Unable to load news" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[news-proxy] Listening on http://127.0.0.1:${port}`);
  console.log(`[news-proxy] Provider ${activeProvider ?? "not configured"}`);
  console.log(`[news-proxy] Image policy ${imagePolicy}`);
});
