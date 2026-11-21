import { randomUUID } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { newsApiUrl } from "./newsService";
import type { NewsItem } from "./types";

const MAX_BYTES = 2 * 1024 * 1024;
const extensions = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

function savedFile(name: string | undefined) {
  if (Platform.OS === "web" || !name || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(name)) return;
  return new File(Paths.document, "saved-news", name);
}

export async function copySavedNewsImage(item: NewsItem): Promise<string | undefined> {
  const apiUrl = newsApiUrl();
  const url = item.imageUrl;
  if (Platform.OS === "web" || item.imageStatus !== "licensed" || !apiUrl || !url ||
    !url.startsWith(apiUrl) || !/^\/v1\/news\/image\/[a-f0-9]{64}$/.test(url.slice(apiUrl.length))) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  let name: string | undefined;
  try {
    const response = await fetch(url, { signal: controller.signal });
    const ext = extensions.get(response.headers.get("content-type") ?? "");
    const length = Number(response.headers.get("content-length"));
    if (!response.ok || !ext || length <= 0 || length > MAX_BYTES) return;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== length) return;
    name = `${randomUUID()}.${ext}`;
    new Directory(Paths.document, "saved-news").create({ idempotent: true, intermediates: true });
    await savedFile(name)?.write(bytes);
    return name;
  } catch {
    discardSavedNewsImage(name);
  } finally {
    clearTimeout(timeout);
  }
}

export function savedNewsImageUri(name: string | undefined): string | undefined {
  try {
    const file = savedFile(name);
    return file?.exists ? file.uri : undefined;
  } catch {
    return undefined;
  }
}

export function discardSavedNewsImage(name: string | undefined): void {
  try {
    const file = savedFile(name);
    if (file?.exists) file.delete();
  } catch {
    // The article metadata is managed independently of the image file.
  }
}
