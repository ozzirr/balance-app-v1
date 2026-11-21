// The proxy core is CommonJS so it can run directly in Node without a build step.
const {
  OFFICIAL_SOURCES,
  classifyTopics,
  deduplicateItems,
  normalizeAggregatorArticle,
  paginateItems,
  parseOfficialFeed,
  parseIntesaReleases,
  validDate,
} = require("../server/news-core.js");

describe("news proxy core", () => {
  it("does not force an unrelated article into the first topic", () => {
    expect(classifyTopics({ title: "Una nuova mostra apre a Roma", body: "Arte contemporanea" })).toEqual([]);
    expect(normalizeAggregatorArticle({
      title: "Una nuova mostra apre a Roma",
      body: "Arte contemporanea",
      url: "https://example.com/arte",
      source: { title: "Example", uri: "example.com" },
    })).toBeNull();
  });

  it("rejects the TGCOM handbag story while keeping a stock-market debut", () => {
    const article = {
      title: "Rihanna, sua figlia, la borsa di Lady D: ci salverà la dolcezza",
      body: "Una campagna moda dedicata alla celebre borsa amata da Diana",
      url: "https://www.tgcom24.mediaset.it/lifestyle/moda/articolo.shtml",
    };
    expect(classifyTopics(article)).toEqual([]);
    expect(classifyTopics({ ...article, url: undefined })).toEqual([]);
    expect(normalizeAggregatorArticle(article, undefined, { fallbackTopic: "investing" })).toBeNull();
    expect(classifyTopics({
      title: "Anthropic debutta in Borsa",
      body: "Il titolo apre al Nasdaq",
    })).toContain("markets");
  });

  it("rejects generic investments without financial context", () => {
    expect(classifyTopics({
      title: "Cultura e turismo cambiano la città",
      body: "Il Comune annuncia settanta milioni di investimenti nelle piazze.",
    })).not.toContain("investing");
  });

  it("does not treat generic cost savings as personal finance", () => {
    expect(classifyTopics({
      title: "La prevenzione genera risparmio per il servizio sanitario",
      body: "Riduzione dei costi ospedalieri nei prossimi dieci anni.",
    })).not.toContain("personal-finance");
  });

  it("classifies the full set of supported finance topics", () => {
    const topics = classifyTopics({
      title: "Bitcoin, tasse e prezzi delle case",
      body: "Novità per criptovalute, fisco e mercato immobiliare",
    });
    expect(topics).toEqual(expect.arrayContaining(["crypto", "taxes", "real-estate"]));
  });

  it("never exposes an aggregator image without a source rights rule", () => {
    const item = normalizeAggregatorArticle({
      title: "Inflazione e tassi di interesse in Europa",
      body: "La politica monetaria resta al centro dei mercati finanziari.",
      url: "https://example.com/economia",
      image: "https://example.com/protected.jpg",
      source: { title: "Example", uri: "example.com" },
    });
    expect(item.imageUrl).toBeUndefined();
    expect(item.source.canDisplayImage).toBe(false);
  });

  it("can expose unverified images only in explicit development mode", () => {
    const item = normalizeAggregatorArticle({
      title: "Inflazione e tassi di interesse in Europa",
      body: "La politica monetaria resta al centro dei mercati finanziari.",
      url: "https://example.com/economia",
      image: "https://cdn.example.com/cover.jpg",
      source: { title: "Example", uri: "example.com" },
    }, undefined, { allowUnverifiedImages: true });
    expect(item.imageUrl).toBe("https://cdn.example.com/cover.jpg");
    expect(item.imageStatus).toBe("unverified");
    expect(item.source.canDisplayImage).toBe(true);
  });

  it("preserves a licensed image when the proxy also serves development previews", () => {
    const item = normalizeAggregatorArticle({
      title: "Inflazione e tassi di interesse in Europa",
      url: "https://example.com/economia",
      image: "https://cdn.example.com/cover.jpg",
    }, undefined, { allowUnverifiedImages: true, allowedImageHosts: ["cdn.example.com"] });
    expect(item.imageStatus).toBe("licensed");
    expect(item.imageUrl).toBe("https://cdn.example.com/cover.jpg");
  });

  it("parses official RSS items with rights-safe source metadata", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title>ECB keeps interest rates unchanged</title>
      <link>https://www.ecb.europa.eu/press/pr/date/2026/html/example.en.html</link>
      <description>Monetary policy and inflation update.</description>
      <pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate>
    </item></channel></rss>`;
    const [item] = parseOfficialFeed(xml, OFFICIAL_SOURCES[0]);
    expect(item.source.id).toBe("ecb");
    expect(item.source.requiresCommercialAgreement).toBe(false);
    expect(item.topics).toEqual(expect.arrayContaining(["rates"]));
    expect(item.publishedAt).toBe("2026-11-18T12:00:00.000Z");
  });

  it("uses the article URL rather than an image enclosure in an Atom feed", () => {
    const xml = `<feed><entry><title>Apple reports results</title>
      <link href="https://www.apple.com/newsroom/story/"/>
      <link href="https://www.apple.com/cover.jpg" rel="enclosure"/>
      <updated>2026-11-19T15:59:07Z</updated></entry></feed>`;
    const [item] = parseOfficialFeed(xml, OFFICIAL_SOURCES[0]);
    expect(item.url).toBe("https://www.apple.com/newsroom/story/");
  });

  it("reads dated releases from the Intesa listing and the Generali RSS format", () => {
    const source = { id: "issuer-isp", name: "Intesa", homepageUrl: "https://group.intesasanpaolo.com", topics: ["investing"] };
    const html = `<div><p class="co-list__date-value x-small-copy">11.11.2026 - 14:59</p></div>
      <div class="co-list__text"><a href="/en/investor-relations/press-releases/2026/report">Interim Statement</a></div>`;
    expect(parseIntesaReleases(html, source)[0]).toMatchObject({
      title: "Interim Statement",
      url: "https://group.intesasanpaolo.com/en/investor-relations/press-releases/2026/report",
      publishedAt: "2026-11-11T00:00:00.000Z",
    });
    const xml = `<rss><channel><item><title>18.11.2026 - 08:00</title>
      <description>Investor Day - Press Release</description>
      <link>https://www.generali.com/report.pdf</link></item></channel></rss>`;
    expect(parseOfficialFeed(xml, { ...source, id: "issuer-g" })[0]).toMatchObject({
      title: "Investor Day - Press Release",
      publishedAt: "2026-11-18T00:00:00.000Z",
    });
  });

  it("deduplicates the same headline across different publishers", () => {
    const base = { title: "BCE lascia i tassi invariati", topics: ["rates"] };
    const items = deduplicateItems([
      { ...base, id: "one", url: "https://one.example/a", source: { id: "one" } },
      { ...base, id: "two", url: "https://two.example/b", source: { id: "two" } },
    ]);
    expect(items).toHaveLength(1);
  });

  it("drops invalid publication dates", () => {
    expect(validDate("not-a-date")).toBeUndefined();
  });

  it("paginates with an opaque cursor and bounded page size", () => {
    const items = Array.from({ length: 25 }, (_, index) => ({ id: String(index) }));
    const first = paginateItems(items, undefined, 10);
    const second = paginateItems(items, first.nextCursor, 50);
    expect(first.items.map((item: { id: string }) => item.id)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(second.items).toHaveLength(15);
    expect(second.nextCursor).toBeUndefined();
    expect(first.total).toBe(25);
  });
});
