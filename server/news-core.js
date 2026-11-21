const { XMLParser } = require("fast-xml-parser");

const TOPIC_KEYWORDS = {
  markets: ["mercati finanziari", "borsa", "azioni", "obbligazioni", "financial markets", "stock market", "stocks", "bonds"],
  rates: ["tassi di interesse", "inflazione", "politica monetaria", "interest rates", "inflation", "monetary policy"],
  investing: ["etf", "fondi comuni", "portafoglio", "portfolio", "investitori", "broker", "gestione patrimoniale", "rendimento", "ipo"],
  "personal-finance": ["finanza personale", "risparmio personale", "bilancio familiare", "conto corrente", "conto deposito", "mutui", "credito al consumo", "personal finance", "household savings", "mortgage"],
  pensions: ["pensioni", "previdenza", "fondi pensione", "retirement", "pension"],
  crypto: ["bitcoin", "criptovalute", "crypto", "ethereum"],
  "real-estate": ["mercato immobiliare", "immobiliare", "prezzi delle case", "real estate", "housing market"],
  taxes: ["fisco", "tasse", "fiscalità", "taxation", "taxes", "tax"],
};

const WHY_IT_MATTERS = {
  markets: "Può incidere sull'andamento di azioni, obbligazioni e portafogli diversificati.",
  rates: "Tassi e inflazione possono influenzare mutui, liquidità e rendimenti obbligazionari.",
  investing: "È rilevante per valutare rischi, costi e opportunità degli investimenti.",
  "personal-finance": "Può avere effetti sulle decisioni quotidiane di spesa, risparmio e credito.",
  pensions: "Può modificare regole, rendimenti o scelte legate alla previdenza.",
  crypto: "Può influenzare volatilità, regolamentazione e rischi degli asset digitali.",
  "real-estate": "Può incidere su prezzi delle case, mutui e accessibilità del credito.",
  taxes: "Può cambiare obblighi, agevolazioni o tassazione di risparmi e investimenti.",
};

const OFFICIAL_SOURCES = [
  {
    id: "ecb",
    name: "Banca Centrale Europea",
    homepageUrl: "https://www.ecb.europa.eu/press/html/index.en.html",
    feedUrl: "https://www.ecb.europa.eu/rss/press.html",
    topics: ["rates", "markets"],
  },
  {
    id: "fed",
    name: "Federal Reserve",
    homepageUrl: "https://www.federalreserve.gov/newsevents.htm",
    feedUrl: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    topics: ["rates", "markets"],
  },
  {
    id: "sec",
    name: "SEC / Investor.gov",
    homepageUrl: "https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins",
    feedUrl: "https://www.sec.gov/rss/investor/alertsandbulletins.xml",
    topics: ["investing", "personal-finance", "crypto"],
  },
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  processEntities: true,
});

function compactText(value, limit = 260) {
  if (value && typeof value === "object") {
    value = value["#text"] ?? value.__cdata ?? "";
  }
  if (typeof value !== "string") return "";
  const text = value.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}

function cleanTitle(value) {
  return compactText(value, 180).replace(/\s+-\d+-\s*$/, "").trim();
}

function isEditorialNews(article) {
  const title = compactText(article.title).toLowerCase();
  let path = "";
  try { path = new URL(article.url).pathname.toLowerCase(); } catch { /* Some providers omit the URL during classification. */ }
  if (/\/(?:lifestyle|gossip|spettacolo|spettacoli|celebrities|fashion|sport)\//.test(path)) return false;
  if (/\b(?:sciopero generale|calciomercato)\b/.test(title)) return false;
  if (/\bbors[ae]\b/.test(title) && /\b(?:moda|figlia|principessa|look|outfit|borsetta|rihanna)\b/.test(title)) {
    return /\b(?:azioni|listino|nasdaq|wall street|quotazione|borsa valori)\b/.test(title);
  }
  return true;
}

function classifyTopics(article, candidateTopics = Object.keys(TOPIC_KEYWORDS)) {
  if (!isEditorialNews(article)) return [];
  const rawText = `${article.title ?? ""} ${article.body ?? ""}`.toLocaleLowerCase();
  const haystack = ` ${rawText.replace(/[^a-zà-öø-ÿ0-9]+/gi, " ").replace(/\s+/g, " ").trim()} `;
  const matches = candidateTopics.filter((topic) =>
    (TOPIC_KEYWORDS[topic] ?? []).some((keyword) => {
      const normalizedKeyword = keyword.toLocaleLowerCase().replace(/[^a-zà-öø-ÿ0-9]+/gi, " ").trim();
      return haystack.includes(` ${normalizedKeyword} `);
    })
  );
  return matches.filter((topic) => {
    if (topic === "markets" && /\bbors[ae]\b/.test(rawText)) {
      return /\b(?:azioni|obbligazioni|mercat[io]|finanziari[oa]|listin[oi]|milano|piazza affari|wall street|nasdaq|quotat[oa]|quotazione|ipo|stock|stocks|bonds|indice|indici|ftse|seduta|debutta|debutto|titoli)\b/.test(rawText);
    }
    return true;
  });
}

function titleFingerprint(title) {
  return String(title)
    .toLocaleLowerCase()
    .replace(/\s+-\d+-\s*$/, "")
    .replace(/[^a-zà-öø-ÿ0-9]+/gi, " ")
    .trim();
}

function deduplicateItems(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  return items.filter((item) => {
    const urlKey = item.url.replace(/\?.*$/, "").replace(/\/$/, "");
    const titleKey = titleFingerprint(item.title);
    if (!urlKey || !titleKey || seenUrls.has(urlKey) || seenTitles.has(titleKey)) return false;
    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    return true;
  });
}

function sourceHomepage(source, articleUrl) {
  if (typeof source?.uri === "string" && source.uri.length > 0) {
    return source.uri.startsWith("http") ? source.uri : `https://${source.uri}`;
  }
  try {
    return new URL(articleUrl).origin;
  } catch {
    return articleUrl;
  }
}

function normalizeAggregatorArticle(
  article,
  candidateTopics = Object.keys(TOPIC_KEYWORDS),
  { allowUnverifiedImages = false, allowedImageHosts = [], fallbackTopic } = {}
) {
  const topics = classifyTopics(article, candidateTopics);
  if (!topics.length && fallbackTopic && isEditorialNews(article)) topics.push(fallbackTopic);
  const articleUrl = typeof article.url === "string" ? article.url : "";
  const title = cleanTitle(article.title);
  if (!title || !articleUrl || topics.length === 0) return null;
  const sourceName = article.source?.title || article.source?.uri || "Fonte non disponibile";
  const imageHost = safeHost(article.image);
  const licensedImage = Boolean(imageHost) &&
    allowedImageHosts.some((host) => imageHost === host || imageHost.endsWith(`.${host}`));
  const imageAllowed = Boolean(imageHost) && (licensedImage || allowUnverifiedImages);
  return {
    id: String(article.uri ?? articleUrl),
    title,
    summary: compactText(article.body, 260),
    source: {
      id: String(article.source?.uri ?? sourceName),
      name: String(sourceName),
      kind: "aggregator",
      homepageUrl: sourceHomepage(article.source, articleUrl),
      canDisplayImage: imageAllowed,
      requiresCommercialAgreement: true,
    },
    url: articleUrl,
    publishedAt: validDate(article.dateTimePub ?? article.dateTime),
    imageUrl: imageAllowed ? article.image : undefined,
    imageStatus: licensedImage ? "licensed" : imageAllowed ? "unverified" : "none",
    topics,
    whyItMatters: WHY_IT_MATTERS[topics[0]],
    isPreview: false,
  };
}

function safeHost(value) {
  if (typeof value !== "string") return "";
  try {
    return new URL(value).hostname.toLocaleLowerCase();
  } catch {
    return "";
  }
}

function validDate(value) {
  if (typeof value !== "string" && !(value instanceof Date)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function arrayOf(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function linkValue(value) {
  if (Array.isArray(value)) {
    const articleLink = value.find((link) => !link?.["@_rel"] || link["@_rel"] === "alternate");
    return articleLink ? linkValue(articleLink) : "";
  }
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  return String(value.href ?? value["@_href"] ?? value["#text"] ?? "").trim();
}

function parseOfficialFeed(xml, source) {
  const parsed = xmlParser.parse(xml);
  const rssItems = arrayOf(parsed?.rss?.channel?.item);
  const atomItems = arrayOf(parsed?.feed?.entry);
  return mapOfficialEntries([...rssItems, ...atomItems], source);
}

function localPublicationDay(value) {
  const date = /^(\d{2})\.(\d{2})\.(\d{4})\b/.exec(String(value ?? ""));
  return date ? `${date[3]}-${date[2]}-${date[1]}T00:00:00Z` : undefined;
}

function parseIntesaReleases(html, source) {
  const rows = html.matchAll(/class="co-list__date-value[^"]*"[^>]*>\s*([^<]+)<\/p>\s*<\/div>\s*<div class="co-list__text">\s*<a\s+href="(\/en\/investor-relations\/press-releases\/[^"]+)"[^>]*>([^<]+)<\/a>/gi);
  const entries = Array.from(rows, ([, date, path, title]) => ({
    title, link: new URL(path, source.homepageUrl).href, pubDate: localPublicationDay(date.trim()),
  }));
  return mapOfficialEntries(entries, source);
}

function mapOfficialEntries(entries, source) {
  return entries
    .map((entry, index) => {
      const generali = source.id === "issuer-g" && localPublicationDay(entry.title);
      const title = cleanTitle(generali ? entry.description : entry.title);
      const url = linkValue(entry.link);
      if (!title || !/^https?:\/\//i.test(url)) return null;
      const body = generali ? "" : compactText(entry.description ?? entry.summary ?? entry.content, 260);
      const matchedTopics = classifyTopics({ title, body }, source.topics);
      const topics = matchedTopics.length > 0 ? matchedTopics : source.topics;
      return {
        id: `${source.id}:${entry.guid?.["#text"] ?? entry.guid ?? entry.id ?? url ?? index}`,
        title,
        summary: body,
        source: {
          id: source.id,
          name: source.name,
          kind: "institutional",
          homepageUrl: source.homepageUrl,
          feedUrl: source.feedUrl,
          canDisplayImage: false,
          requiresCommercialAgreement: false,
        },
        url,
        publishedAt: validDate(entry.pubDate ?? entry.published ?? entry.updated ?? generali),
        topics,
        whyItMatters: WHY_IT_MATTERS[topics[0]],
        isPreview: false,
      };
    })
    .filter(Boolean);
}

async function fetchOfficialFeeds(fetchImpl = fetch) {
  const settled = await Promise.allSettled(
    OFFICIAL_SOURCES.map(async (source) => {
      const response = await fetchImpl(source.feedUrl, {
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
          "User-Agent": "BalanceNews/1.0 (+https://github.com/ozzirr/balance-app-v1)",
        },
      });
      if (!response.ok) throw new Error(`${source.id} feed returned ${response.status}`);
      return parseOfficialFeed(await response.text(), source);
    })
  );
  const items = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const errors = settled.flatMap((result) => result.status === "rejected" ? [String(result.reason)] : []);
  const sources = settled.map((result, index) => ({
    id: OFFICIAL_SOURCES[index].id,
    status: result.status === "fulfilled" ? "ok" : "error",
    itemCount: result.status === "fulfilled" ? result.value.length : 0,
    error: result.status === "rejected" ? compactError(result.reason) : undefined,
  }));
  return { items, errors, sources };
}

function compactError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return compactText(message, 160);
}

function mergeNewsItems(...groups) {
  return deduplicateItems(groups.flat())
    .sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

function limitBySource(items, maxTotal = 30, maxPerSource = 5) {
  const sourceCounts = new Map();
  return items.filter((item) => {
    if (sourceCounts.size > 0 && sourceCounts.get("__total__") >= maxTotal) return false;
    const sourceId = item.source.id;
    const count = sourceCounts.get(sourceId) ?? 0;
    if (count >= maxPerSource) return false;
    sourceCounts.set(sourceId, count + 1);
    sourceCounts.set("__total__", (sourceCounts.get("__total__") ?? 0) + 1);
    return true;
  });
}

function encodeCursor(offset) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const value = Number(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function paginateItems(items, cursor, requestedLimit = 10) {
  const limit = Math.min(20, Math.max(1, Number(requestedLimit) || 10));
  const offset = Math.min(decodeCursor(cursor), items.length);
  const pageItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pageItems.length;
  return {
    items: pageItems,
    total: items.length,
    nextCursor: nextOffset < items.length ? encodeCursor(nextOffset) : undefined,
  };
}

module.exports = {
  OFFICIAL_SOURCES,
  TOPIC_KEYWORDS,
  WHY_IT_MATTERS,
  classifyTopics,
  isEditorialNews,
  decodeCursor,
  compactText,
  deduplicateItems,
  fetchOfficialFeeds,
  limitBySource,
  mergeNewsItems,
  normalizeAggregatorArticle,
  paginateItems,
  parseOfficialFeed,
  parseIntesaReleases,
  validDate,
};
