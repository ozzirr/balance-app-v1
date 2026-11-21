const { DatabaseSync } = require("node:sqlite");
const { createHash } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const { dirname } = require("node:path");

const DAY_MS = 86_400_000;
const RETENTION_MS = 60 * DAY_MS;
const hash = (value) => createHash("sha256").update(value).digest("hex");

function openNewsStore(file, now = Date.now) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA auto_vacuum = INCREMENTAL;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS news_queries (
      key TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, metadata TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS news_articles (
      key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, payload TEXT NOT NULL,
      image_key TEXT, image_url TEXT
    );
    CREATE TABLE IF NOT EXISTS news_query_articles (
      query_key TEXT NOT NULL REFERENCES news_queries(key) ON DELETE CASCADE,
      article_key TEXT NOT NULL REFERENCES news_articles(key) ON DELETE CASCADE,
      position INTEGER NOT NULL, topics TEXT NOT NULL, why TEXT,
      PRIMARY KEY (query_key, article_key)
    );
    CREATE TABLE IF NOT EXISTS news_images (
      key TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS news_image_references ON news_articles(image_key);
    CREATE INDEX IF NOT EXISTS news_article_expiry ON news_articles(expires_at);
  `);
  const query = db.prepare("SELECT updated_at, metadata FROM news_queries WHERE key = ? AND updated_at > ?");
  const items = db.prepare(`SELECT a.payload, q.topics, q.why FROM news_query_articles q
    JOIN news_articles a ON a.key = q.article_key WHERE q.query_key = ? AND a.expires_at > ? ORDER BY q.position`);
  const saveQuery = db.prepare(`INSERT INTO news_queries VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at, metadata = excluded.metadata`);
  const saveArticle = db.prepare(`INSERT INTO news_articles VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, image_key = excluded.image_key, image_url = excluded.image_url,
      expires_at = CASE WHEN ? THEN excluded.expires_at ELSE news_articles.expires_at END`);
  const saveLink = db.prepare("INSERT OR IGNORE INTO news_query_articles VALUES (?, ?, ?, ?, ?)");
  const clearLinks = db.prepare("DELETE FROM news_query_articles WHERE query_key = ?");
  const clearQueries = db.prepare("DELETE FROM news_queries WHERE updated_at <= ?");
  const clearArticles = db.prepare("DELETE FROM news_articles WHERE expires_at <= ?");
  const clearImages = db.prepare("DELETE FROM news_images WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE image_key = news_images.key)");
  const imageSource = db.prepare("SELECT image_url FROM news_articles WHERE image_key = ? AND expires_at > ? LIMIT 1");
  const imageBytes = db.prepare("SELECT mime, bytes FROM news_images WHERE key = ?");
  const saveImage = db.prepare("INSERT OR IGNORE INTO news_images VALUES (?, ?, ?)");

  function transaction(work) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      db.exec("COMMIT");
      return value;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return {
    read(key) {
      const time = now();
      const row = query.get(key, time - RETENTION_MS);
      if (!row) return null;
      return {
        createdAt: row.updated_at,
        result: {
          ...JSON.parse(row.metadata),
          items: items.all(key, time).map((item) => ({
            ...JSON.parse(item.payload), topics: JSON.parse(item.topics), whyItMatters: item.why ?? undefined,
          })),
        },
      };
    },
    write(key, snapshot, archiveImageUrl = () => null) {
      const { items: articles, ...metadata } = snapshot.result;
      transaction(() => {
        saveQuery.run(key, snapshot.createdAt, JSON.stringify(metadata));
        clearLinks.run(key);
        for (const [position, item] of articles.entries()) {
          let canonicalUrl;
          try { canonicalUrl = new URL(item.url); } catch { continue; }
          if (!["https:", "http:"].includes(canonicalUrl.protocol)) continue;
          canonicalUrl.hash = "";
          for (const param of [...canonicalUrl.searchParams.keys()]) {
            if (/^utm_/i.test(param) || param === "fbclid") canonicalUrl.searchParams.delete(param);
          }
          const articleKey = hash(canonicalUrl.href);
          const date = Date.parse(item.publishedAt);
          const dated = Number.isFinite(date) && date <= now();
          const expiresAt = (dated ? date : snapshot.createdAt) + RETENTION_MS;
          if (expiresAt <= now()) continue;
          const originalImage = archiveImageUrl(item);
          const imageKey = originalImage ? hash(originalImage) : null;
          const { topics, whyItMatters, ...payload } = item;
          saveArticle.run(articleKey, expiresAt, JSON.stringify(payload), imageKey, originalImage, Number(dated));
          saveLink.run(key, articleKey, position, JSON.stringify(topics), whyItMatters ?? null);
        }
      });
      return this.read(key)?.result;
    },
    image(key) {
      const origin = imageSource.get(key, now());
      return origin ? { url: origin.image_url, ...imageBytes.get(key) } : null;
    },
    writeImage(key, mime, bytes) {
      if (imageSource.get(key, now())) saveImage.run(key, mime, bytes);
    },
    prune() {
      transaction(() => {
        clearQueries.run(now() - RETENTION_MS);
        clearArticles.run(now());
        clearImages.run();
      });
      db.exec("PRAGMA incremental_vacuum(256)");
    },
    close() { db.close(); },
  };
}

module.exports = { openNewsStore, DAY_MS, imageKeyForUrl: hash };
