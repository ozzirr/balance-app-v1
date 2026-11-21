const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const {
  loadPersistentCache,
  savePersistentCache,
} = require("../server/news-cache.js");

describe("persistent news cache", () => {
  it("survives a process-style write and reload", async () => {
    const directory = await mkdtemp(join(tmpdir(), "balance-news-cache-"));
    const file = join(directory, "nested", "feed.json");
    const value = {
      createdAt: Date.now(),
      result: { mode: "live", items: [{ id: "story-1" }] },
    };
    try {
      await savePersistentCache(file, value);
      await expect(loadPersistentCache(file)).resolves.toEqual(value);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("ignores malformed cache files", async () => {
    await expect(loadPersistentCache("/path/that/does/not/exist.json")).resolves.toBeNull();
  });
});
