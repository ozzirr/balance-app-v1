const { classifyTopics, isEditorialNews } = require("./news-core");
const catalog = require("../src/features/news/instrumentCatalog.json");
const instruments = new Map(catalog.map((item) => [item.id, item]));

const getCatalogInstrument = (id) => instruments.get(id);
const instrumentQuery = (instrument) => instrument.aliases.map((alias) => `"${alias}"`).join(" OR ");

const ISSUER_FEEDS = {
  aapl: ["Apple Newsroom", "https://www.apple.com/newsroom/", "https://www.apple.com/newsroom/rss-feed.rss"],
  msft: ["Microsoft Official Blog", "https://blogs.microsoft.com/", "https://blogs.microsoft.com/feed/"],
  meta: ["Meta Newsroom", "https://about.fb.com/news/", "https://about.fb.com/news/feed/"],
  amzn: ["About Amazon", "https://www.aboutamazon.com/", "https://www.aboutamazon.com/rss"],
  googl: ["Google · The Keyword", "https://blog.google/", "https://blog.google/rss/"],
  g: ["Generali · Comunicati stampa", "https://www.generali.com/it/info/rss-feeds", "https://www.generali.com/.rest/rss/v1/feed?name=pressReleases"],
  isp: ["Intesa Sanpaolo · Investor Relations", "https://group.intesasanpaolo.com/en/investor-relations/press-releases", "https://group.intesasanpaolo.com/en/investor-relations/press-releases"],
};

function mentionsInstrument(title, summary, query) {
  const text = [title, summary].filter((value) => typeof value === "string" && value.length);
  const tokens = (value) => value.normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") ?? "";
  const term = tokens(query);
  if (!term) return false;
  if (/^[A-Z]{2,5}$/.test(query)) {
    return text.some((part) => (part.match(/[\p{L}\p{N}]+/gu) ?? []).includes(query));
  }
  return text.some((part) => ` ${tokens(part)} `.includes(` ${term} `));
}

// Company newsroom feeds also carry entertainment and product announcements.
function isInvestorStory(item) {
  const article = { title: item.title, body: item.summary, url: item.url };
  if (!isEditorialNews(article)) return false;
  if (classifyTopics(article).length) return true;
  return /\b(?:ricavi|fatturato|trimestrale|utili|bilancio|dividendi?|acquisizion[ei]|fusione|azionisti|partecipazione|opa|buyback|earnings|revenue|profits?|dividends?|shareholders?|acquisition|merger|guidance|financial results|capital increase|aumento di capitale)\b/i.test([item.title, item.summary].join(" "));
}

module.exports = { getCatalogInstrument, instrumentQuery, mentionsInstrument, isInvestorStory, ISSUER_FEEDS, catalog };
