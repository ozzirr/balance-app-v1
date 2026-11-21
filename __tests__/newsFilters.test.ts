import { countNewsByTopic, filterNewsByTopic } from "@/features/news/newsFilters";
import type { NewsItem } from "@/features/news/types";

const source = {
  id: "test",
  name: "Test",
  kind: "publisher" as const,
  homepageUrl: "https://example.com",
  canDisplayImage: false,
  requiresCommercialAgreement: false,
};

const items: NewsItem[] = [
  { id: "1", title: "Mercati", summary: "", source, url: "https://example.com/1", topics: ["markets", "investing"] },
  { id: "2", title: "Tassi", summary: "", source, url: "https://example.com/2", topics: ["rates"] },
  { id: "3", title: "Altro", summary: "", source, url: "https://example.com/3", topics: ["markets", "markets"] },
];

describe("news topic filters", () => {
  it("returns every story for the all filter", () => {
    expect(filterNewsByTopic(items, "all")).toEqual(items);
  });

  it("keeps only stories tagged with the selected topic", () => {
    expect(filterNewsByTopic(items, "markets").map((item) => item.id)).toEqual(["1", "3"]);
    expect(filterNewsByTopic(items, "crypto")).toEqual([]);
  });

  it("counts a topic once per story", () => {
    const counts = countNewsByTopic(items);
    expect(counts.markets).toBe(2);
    expect(counts.investing).toBe(1);
    expect(counts.rates).toBe(1);
  });
});
