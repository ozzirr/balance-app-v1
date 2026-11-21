const { mkdir, readFile, rename, writeFile } = require("node:fs/promises");
const { dirname, resolve } = require("node:path");

function resolveCacheFile(configuredPath, cwd = process.cwd()) {
  return resolve(cwd, configuredPath || ".cache/news-feed.json");
}

function isValidCache(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    Number.isFinite(value.createdAt) &&
    value.result &&
    value.result.mode === "live" &&
    Array.isArray(value.result.items)
  );
}

async function loadPersistentCache(filePath) {
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    return isValidCache(value) ? value : null;
  } catch {
    return null;
  }
}

async function savePersistentCache(filePath, value) {
  if (!isValidCache(value)) throw new Error("Refusing to persist an invalid news cache");
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(value), "utf8");
  await rename(temporaryFile, filePath);
}

module.exports = {
  isValidCache,
  loadPersistentCache,
  resolveCacheFile,
  savePersistentCache,
};
