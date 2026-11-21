# Balance News — product and delivery roadmap

## Product principle

Balance News is a relevance layer, not an infinite general-news feed. Users select the themes they follow; Balance groups duplicate stories, explains why an update may matter, and always links to the original publisher for the full article.

The product should display only metadata that the source or commercial agreement allows: source, headline, short excerpt, publication time, permitted thumbnail, tags, and canonical link. Full article bodies and publisher images are not copied unless a specific licence grants that right.

## Phase 0 — vertical slice (started)

- News tab integrated into the existing navigation.
- Topic selection persisted locally in the existing preferences database.
- Feed cards, source attribution, external article navigation, and “why it matters” UI.
- Provider boundary between the app and future aggregation service.
- Pilot source catalogue with explicit licensing capabilities.
- Preview state while the live service is not configured.

## Phase 1 — aggregation MVP

- Small backend/edge service; no API keys or publisher parsing in the mobile app.
- Poll approved RSS/Atom feeds and commercial news APIs.
- Normalize title, excerpt, canonical URL, source, time, language, topics, and licensed image URL.
- URL/title deduplication and event clustering.
- Cache with source-specific retention rules; rate limiting and health monitoring.
- Mobile endpoint: `GET /v1/news?topics=markets,rates&locale=it-IT&cursor=...`.
- Start with official institutional feeds: ECB, Federal Reserve, SEC/Investor.gov, ESMA/European Commission where relevant.
- Add an Italian/general financial news provider only after confirming commercial rights.

### Current implementation status

- Live hybrid feed merges the commercial aggregator with official ECB, Federal Reserve monetary-policy, and SEC investor-alert RSS endpoints.
- Strict topic matching drops unclassified articles instead of assigning a fallback topic.
- Cross-source title/URL deduplication, per-source diversity limits, in-memory cache, and stale-cache fallback are active.
- Aggregator images are disabled until a source-specific display-rights rule is configured.
- Image delivery is policy-driven: `licensed-only` is the production-safe default, while `development` can preview unverified aggregator images locally. Missing or failed images use an in-app topic illustration.
- Pull-to-refresh, empty states, stale-feed messaging, and localized News copy are implemented in the app.
- Cursor pagination, per-client rate limiting, persistent disk cache, source-health diagnostics, and stale-cache recovery are implemented in the local service.
- Still required before production: hosted deployment, shared cache/storage for multi-instance hosting, external monitoring, and a legal review of each commercial source.

### Local news provider setup

1. Create a GNews account with Google and copy the API key from its dashboard. A NewsAPI.ai key remains supported as an optional alternative.
2. Add the key to the ignored `.env.local` file as `GNEWS_API_KEY=...`. Never use the `EXPO_PUBLIC_` prefix for the key.
3. Start the server-side proxy with `npm run news:proxy`.
4. Restart Expo with `npm run ios` so it reads `EXPO_PUBLIC_NEWS_API_URL`.

The proxy uses GNews by default and can fall back to the official NewsAPI.ai/Event Registry endpoint when that key is configured instead. It returns only a short excerpt to the app and caches one shared financial feed for thirty minutes. User topics are filtered locally from that shared cache, so API usage does not multiply by user or topic combination. In production this same handler should be deployed behind rate limiting and monitoring; the mobile app must never call a provider with the secret directly.

## Phase 2 — personalization and notifications

- Follow companies and general topics. The app and proxy share a local stock catalog. The November 2026 snapshot uses the [iShares Core S&P 500 holdings](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv) for US listings and the [Borsa Italiana FTSE MIB list](https://www.borsaitaliana.it/borsa/azioni/ftse-mib/lista.html) for Milan listings. Search runs on-device, and the proxy accepts only catalog IDs.
- Daily/weekly digest and high-importance alerts with quiet hours.
- Saved/read state and “more/less like this” feedback.
- Link relevant news to portfolio categories using local, privacy-preserving matching.
- Explain relevance without predicting price direction or presenting financial advice.

## Phase 3 — editorial quality

- Cluster several sources covering the same event.
- Separate facts, analysis, opinion, and sponsored content.
- Source controls, language controls, muted keywords, and transparent ranking reasons.
- Fact/source diversity signals and corrections workflow.
- Optional short summaries generated only from content we are licensed to process.

## Source strategy

| Source type | Examples | MVP use | Notes |
| --- | --- | --- | --- |
| Official institutions | ECB, Fed, SEC, ESMA | Yes | Strong primary sources; RSS/Atom where published. |
| Italian publisher RSS | ANSA Economia | Licence required | Public ANSA RSS terms limit use to non-commercial readers and prohibit republishing headlines on sites/weblogs without authorization. |
| Premium publisher | Bloomberg | Licence required | Use Bloomberg Media Distribution or another explicit agreement; do not scrape pages. |
| Commercial aggregator | GNews, NewsAPI.ai or equivalent | Evaluate | Paid commercial plan still does not automatically grant copyright in publisher text/images. Validate each plan and source rule. |

## Data and legal guardrails

- Maintain a source registry with allowed fields, image rights, cache duration, attribution, and takedown contact.
- Respect robots rules and publisher terms; robots permission alone is not a content licence.
- Never scrape around paywalls or authentication.
- Store canonical links and preserve publisher attribution.
- Use a neutral fallback illustration when an image is absent or its display rights are unclear.
- Record ingestion provenance and make individual items removable.
- Obtain legal review before production use of third-party publisher feeds.

## Suggested success metrics

- Useful-news feedback rate and article-open rate.
- Duplicate rate after clustering.
- Notification opt-out/mute rate.
- Source coverage and feed freshness.
- Percentage of opened articles that match a followed topic.
