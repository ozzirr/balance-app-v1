const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { mkdtempSync, rmSync, rmdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { openNewsStore, DAY_MS, imageKeyForUrl } = require("./news-store");
const { allowedArchiveUrl, readArchiveImage } = require("./news-media");

test("queries share articles and image bytes on disk across restarts, then expire together", () => {
  const folder = mkdtempSync(join(tmpdir(), "balance-news-"));
  const path = join(folder, "news.sqlite");
  let clock = Date.parse("2026-11-20T10:00:00Z");
  let store = openNewsStore(path, () => clock);
  const imageUrl = "https://licensed.example/cover.png";
  const key = imageKeyForUrl(imageUrl);
  const item = {
    url: "https://example.com/story?utm_source=feed", title: "Market news",
    publishedAt: new Date(clock).toISOString(), topics: ["markets"], imageUrl,
  };
  const snapshot = (items) => ({ createdAt: clock, result: { mode: "live", items } });
  try {
    store.write("feed", snapshot([item]), () => imageUrl);
    store.write("instrument:aapl", snapshot([{ ...item, url: "https://example.com/story", topics: ["investing"] }]), () => imageUrl);
    store.write("empty", snapshot([]));
    store.writeImage(key, "image/png", Buffer.from([1, 2, 3]));
    store.close();
    store = openNewsStore(path, () => clock);

    assert.deepEqual(store.read("feed").result.items[0].topics, ["markets"]);
    assert.deepEqual(store.read("instrument:aapl").result.items[0].topics, ["investing"]);
    assert.deepEqual(store.read("empty").result.items, []);
    assert.deepEqual([...store.image(key).bytes], [1, 2, 3]);
    const inspect = new DatabaseSync(path, { readOnly: true });
    try {
      assert.equal(inspect.prepare("SELECT count(*) AS count FROM news_articles").get().count, 1);
      clock += 60 * DAY_MS;
      store.prune();
      assert.equal(store.read("feed"), null);
      assert.equal(store.image(key), null);
      assert.equal(inspect.prepare("SELECT count(*) AS count FROM news_images").get().count, 0);
    } finally {
      inspect.close();
    }
  } finally {
    store.close();
    for (const suffix of ["", "-shm", "-wal"]) rmSync(path + suffix, { force: true });
    rmdirSync(folder);
  }
});

test("only explicitly allowed HTTPS hosts and bounded raster images can be archived", async () => {
  const hosts = new Set(["licensed.example"]);
  assert.equal(allowedArchiveUrl("https://licensed.example/cover.png", hosts), "https://licensed.example/cover.png");
  assert.equal(allowedArchiveUrl("https://cdn.licensed.example/cover.png", hosts), null);
  assert.equal(allowedArchiveUrl("https://name:secret@licensed.example/cover.png", hosts), null);
  assert.equal(allowedArchiveUrl("https://127.0.0.1/a", new Set(["127.0.0.1"])), null);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const result = await readArchiveImage("https://licensed.example/cover.png", async (_, options) => {
    assert.equal(options.redirect, "error");
    return new Response(png, { headers: { "Content-Type": "image/png" } });
  });
  assert.deepEqual(result.bytes, png);
  await assert.rejects(readArchiveImage("https://licensed.example/cover.png", async () =>
    new Response("<svg/>", { headers: { "Content-Type": "image/png" } })), /Invalid news image/);
});
