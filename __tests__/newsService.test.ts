import { loadNewsFeed } from "@/features/news/newsService";

describe("news feed preview", () => {
  it("returns only stories matching at least one followed topic", async () => {
    const result = await loadNewsFeed(["crypto"]);

    expect(result.mode).toBe("preview");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].source.id).toBe("sec");
  });

  it("keeps source rights metadata available to consumers", async () => {
    const result = await loadNewsFeed(["rates"]);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.source.requiresCommercialAgreement === false)).toBe(true);
  });
});
