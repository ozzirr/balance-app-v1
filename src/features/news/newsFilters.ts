import type { NewsItem, NewsTopicId } from "@/features/news/types";

export type NewsTopicFilter = NewsTopicId | "all";

export function filterNewsByTopic(items: NewsItem[], filter: NewsTopicFilter): NewsItem[] {
  if (filter === "all") return items;
  return items.filter((item) => item.topics.includes(filter));
}

export function countNewsByTopic(items: NewsItem[]): Record<NewsTopicId, number> {
  const counts: Record<NewsTopicId, number> = {
    markets: 0,
    rates: 0,
    investing: 0,
    "personal-finance": 0,
    pensions: 0,
    crypto: 0,
    "real-estate": 0,
    taxes: 0,
  };

  items.forEach((item) => {
    new Set(item.topics).forEach((topic) => {
      counts[topic] += 1;
    });
  });

  return counts;
}
