import { excludeBriefingStories, selectNewsBriefing } from "@/features/news/newsBriefing";
import type { NewsItem, NewsTopicId } from "@/features/news/types";

function story(id: string, topic: NewsTopicId, overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id,
    title: `Story ${id}`,
    summary: "Publisher summary",
    source: {
      id: "source", name: "Source", kind: "publisher", homepageUrl: "https://example.com",
      canDisplayImage: false, requiresCommercialAgreement: false,
    },
    url: `https://example.com/${id}`,
    publishedAt: "2026-01-10T10:00:00Z",
    topics: [topic],
    ...overrides,
  };
}

it("selects at most two eligible stories on distinct followed topics in feed order", () => {
  const items = [
    story("preview", "rates", { isPreview: true }),
    story("unfollowed", "crypto"),
    story("missing-date", "rates", { publishedAt: undefined }),
    story("repeats-title", "rates", { summary: "Story repeats-title" }),
    story("missing-summary", "rates", { summary: "" }),
    story("first", "rates"),
    story("same-topic", "rates"),
    story("second", "taxes"),
    story("third", "investing"),
  ];
  expect(selectNewsBriefing(items, ["rates", "taxes", "investing"]).map(({ item }) => item.id))
    .toEqual(["first", "second"]);
});

it("keeps stories shown in the briefing out of the list while preserving its order", () => {
  const featured = story("featured", "rates");
  const items = [featured, story("first", "rates"), story("second", "rates")];
  const briefing = selectNewsBriefing(items, ["rates"]);
  expect(excludeBriefingStories(items, briefing)).toEqual(items.slice(1));
  expect(excludeBriefingStories([featured], briefing)).toEqual([]);
  expect(excludeBriefingStories(items, [])).toEqual(items);
});

it("uses the active topic for a multi-topic story and excludes a duplicate URL", () => {
  const item = story("multi", "rates", { topics: ["rates", "taxes"] });
  expect(selectNewsBriefing([item], ["taxes"])).toEqual([{ item, topic: "taxes" }]);
  expect(selectNewsBriefing([item, story("duplicate", "taxes", { url: item.url })], ["rates", "taxes"]))
    .toEqual([{ item, topic: "rates" }]);
});
