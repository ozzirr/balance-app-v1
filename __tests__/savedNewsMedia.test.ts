import { copySavedNewsImage, discardSavedNewsImage, savedNewsImageUri } from "@/features/news/savedNewsMedia";
import type { NewsItem } from "@/features/news/types";

jest.mock("expo-crypto", () => ({ randomUUID: () => "11111111-2222-3333-4444-555555555555" }));
jest.mock("expo-file-system", () => {
  const files = new Map();
  return {
    Paths: { document: "file:///documents" },
    Directory: class { create() {} },
    File: class {
      uri: string;
      constructor(...segments: string[]) { this.uri = segments.join("/"); }
      get exists() { return files.has(this.uri); }
      async write(bytes: Uint8Array) { files.set(this.uri, bytes); }
      delete() { files.delete(this.uri); }
    },
  };
});

it("keeps a licensed archived image on the device independently of the cached article", async () => {
  const previous = process.env.EXPO_PUBLIC_NEWS_API_URL;
  process.env.EXPO_PUBLIC_NEWS_API_URL = "https://balance.example";
  const download = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    headers: { get: (key: string) => key === "content-type" ? "image/png" : "3" },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as Response);
  let name: string | undefined;
  try {
    const article = {
      imageUrl: `https://balance.example/v1/news/image/${"a".repeat(64)}`,
      imageStatus: "licensed",
    } as NewsItem;
    expect(await copySavedNewsImage({ ...article, imageStatus: "unverified" })).toBeUndefined();
    expect(await copySavedNewsImage({ ...article, imageUrl: "https://publisher.example/photo.png" })).toBeUndefined();
    expect(download).not.toHaveBeenCalled();
    name = await copySavedNewsImage(article);
    expect(name).toMatch(/\.png$/);
    download.mockRejectedValue(new Error("Offline"));
    expect(savedNewsImageUri(name)).toMatch(/^file:\/\/\/documents\/saved-news\//);
    discardSavedNewsImage(name);
    expect(savedNewsImageUri(name)).toBeUndefined();
  } finally {
    discardSavedNewsImage(name);
    download.mockRestore();
    if (previous === undefined) delete process.env.EXPO_PUBLIC_NEWS_API_URL;
    else process.env.EXPO_PUBLIC_NEWS_API_URL = previous;
  }
});
