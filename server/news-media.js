const { isIP } = require("node:net");

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp"]);

function allowedArchiveUrl(value, hosts) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
      !isIP(url.hostname) && url.hostname.includes(".") && hosts.has(url.hostname)) return url.href;
  } catch {
    // Only configured HTTPS origins can provide media.
  }
  return null;
}

async function readArchiveImage(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(5_000) });
  const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!response.ok || !SUPPORTED.has(mime) || !response.body ||
    Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new Error("Unsupported news image");
  }
  const reader = response.body.getReader();
  try {
    let size = 0;
    const chunks = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) throw new Error("News image too large");
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks, size);
    const valid = (mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      || (mime === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
      || (mime === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
    if (!valid) throw new Error("Invalid news image");
    return { mime, bytes };
  } finally {
    await reader.cancel().catch(() => {});
  }
}

module.exports = { allowedArchiveUrl, readArchiveImage };
