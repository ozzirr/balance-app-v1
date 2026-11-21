import type { NewsItem, NewsTopicId } from "./types";

export function selectNewsBriefing(items: NewsItem[], topics: NewsTopicId[]) {
  const usedTopics = new Set<NewsTopicId>();
  const usedUrls = new Set<string>();
  const entries: { item: NewsItem; topic: NewsTopicId }[] = [];

  for (const item of items) {
    const topic = item.topics.find((id) => topics.includes(id));
    const date = Date.parse(item.publishedAt ?? "");
    if (!topic || usedTopics.has(topic) || usedUrls.has(item.url) || item.isPreview) continue;
    if (!Number.isFinite(date) || !/^https:\/\//i.test(item.url) || !item.source.name.trim() || !item.title.trim()) continue;
    const summary = item.summary.trim();
    if (!summary || summary.toLowerCase() === item.title.trim().toLowerCase()) continue;
    entries.push({ item, topic });
    usedTopics.add(topic);
    usedUrls.add(item.url);
    if (entries.length === 2) break;
  }
  return entries;
}

export function excludeBriefingStories(items: NewsItem[], briefing: ReturnType<typeof selectNewsBriefing>): NewsItem[] {
  if (!briefing.length) return items;
  const featuredUrls = new Set(briefing.map(({ item }) => item.url));
  return items.filter((item) => !featuredUrls.has(item.url));
}
