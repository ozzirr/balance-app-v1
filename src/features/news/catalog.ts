import type { NewsSource, NewsTopicId } from "./types";

export type NewsTopic = {
  id: NewsTopicId;
  icon:
    | "chart-line"
    | "bank-outline"
    | "finance"
    | "piggy-bank-outline"
    | "account-clock-outline"
    | "currency-btc"
    | "home-city-outline"
    | "file-document-outline";
};

export const NEWS_TOPICS: NewsTopic[] = [
  { id: "markets", icon: "chart-line" },
  { id: "rates", icon: "bank-outline" },
  { id: "investing", icon: "finance" },
  { id: "personal-finance", icon: "piggy-bank-outline" },
  { id: "pensions", icon: "account-clock-outline" },
  { id: "crypto", icon: "currency-btc" },
  { id: "real-estate", icon: "home-city-outline" },
  { id: "taxes", icon: "file-document-outline" },
];

export const DEFAULT_NEWS_TOPICS: NewsTopicId[] = ["markets", "rates", "personal-finance", "investing"];

export const NEWS_SOURCES: Record<string, NewsSource> = {
  ecb: {
    id: "ecb",
    name: "Banca Centrale Europea",
    kind: "institutional",
    homepageUrl: "https://www.ecb.europa.eu/press/html/index.en.html",
    feedUrl: "https://www.ecb.europa.eu/rss/press.html",
    canDisplayImage: false,
    requiresCommercialAgreement: false,
  },
  fed: {
    id: "fed",
    name: "Federal Reserve",
    kind: "institutional",
    homepageUrl: "https://www.federalreserve.gov/newsevents.htm",
    feedUrl: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    canDisplayImage: false,
    requiresCommercialAgreement: false,
  },
  sec: {
    id: "sec",
    name: "SEC / Investor.gov",
    kind: "institutional",
    homepageUrl: "https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins",
    feedUrl: "https://www.sec.gov/rss/investor/alerts",
    canDisplayImage: false,
    requiresCommercialAgreement: false,
  },
  ansa: {
    id: "ansa",
    name: "ANSA Economia",
    kind: "publisher",
    homepageUrl: "https://www.ansa.it/economia/",
    canDisplayImage: true,
    requiresCommercialAgreement: true,
  },
  bloomberg: {
    id: "bloomberg",
    name: "Bloomberg",
    kind: "publisher",
    homepageUrl: "https://www.bloomberg.com/europe",
    canDisplayImage: true,
    requiresCommercialAgreement: true,
  },
};
