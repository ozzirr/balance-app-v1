export type NewsTopicId =
  | "markets"
  | "rates"
  | "investing"
  | "personal-finance"
  | "pensions"
  | "crypto"
  | "real-estate"
  | "taxes";

export type NewsSourceKind = "institutional" | "publisher" | "aggregator";

export type NewsSource = {
  id: string;
  name: string;
  kind: NewsSourceKind;
  homepageUrl: string;
  feedUrl?: string;
  canDisplayImage: boolean;
  requiresCommercialAgreement: boolean;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source: NewsSource;
  url: string;
  publishedAt?: string;
  imageUrl?: string;
  savedImageFile?: string;
  imageStatus?: "licensed" | "unverified" | "none";
  topics: NewsTopicId[];
  whyItMatters?: string;
  isPreview?: boolean;
};

export type NewsFeedResult = {
  items: NewsItem[];
  mode: "preview" | "live";
  refreshedAt: string;
  provider?: string;
  imagePolicy?: "licensed-only" | "development";
  total?: number;
  nextCursor?: string;
  sources?: Array<{
    id: string;
    status: "ok" | "error" | "disabled";
    itemCount: number;
    error?: string;
  }>;
  cached?: boolean;
  stale?: boolean;
  fallbackReason?: "not-configured" | "unavailable";
};
