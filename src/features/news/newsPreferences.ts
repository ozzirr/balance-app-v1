import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import { DEFAULT_NEWS_TOPICS, NEWS_TOPICS } from "./catalog";
import { getInstrument, resolveStoredInstrument } from "./instrumentCatalog";
import type { NewsItem, NewsTopicId } from "./types";

const TOPICS_PREFERENCE_KEY = "news.followedTopics";
const INTERESTS_PREFERENCE_KEY = "news.interests";
const SAVED_NEWS_PREFERENCE_KEY = "news.savedArticles";
const VALID_TOPIC_IDS = new Set(NEWS_TOPICS.map((topic) => topic.id));

async function getLegacyNewsTopics(): Promise<NewsTopicId[]> {
  const preference = await getPreference(TOPICS_PREFERENCE_KEY);
  if (!preference) return [];

  try {
    const value: unknown = JSON.parse(preference.value);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (topic): topic is NewsTopicId => typeof topic === "string" && VALID_TOPIC_IDS.has(topic as NewsTopicId)
    );
  } catch {
    return [];
  }
}

export const FREE_RADAR = { instruments: 3, topics: 2, instrumentChanges: 2, topicChanges: 1 } as const;
export const RADAR_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
type History = { topics: number[]; instruments: number[] };
type Interests = { topics: NewsTopicId[]; instruments: string[]; configured: boolean; history: History };

function timestamps(raw: unknown): number[] {
  return Array.isArray(raw) ? raw.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b) : [];
}

export function remainingChanges(history: History, now = Date.now()) {
  const recent = (dates: number[]) => dates.filter((date) => date + RADAR_WEEK_MS > now).length;
  return {
    topics: Math.max(0, FREE_RADAR.topicChanges - recent(history.topics)),
    instruments: Math.max(0, FREE_RADAR.instrumentChanges - recent(history.instruments)),
  };
}

async function readInterests(): Promise<Interests> {
  const preference = await getPreference(INTERESTS_PREFERENCE_KEY);
  if (preference) {
    try {
      const value = JSON.parse(preference.value);
      if (Array.isArray(value?.topics) && Array.isArray(value?.instruments)) {
        const topics = NEWS_TOPICS.map(({ id }) => id).filter((id) => value.topics.includes(id));
        const instruments = [...new Set<string>(value.instruments
          .filter((item: unknown): item is string => typeof item === "string")
          .map(resolveStoredInstrument)
          .filter((item: string | undefined): item is string => item !== undefined))];
        return { topics: topics.length ? topics : DEFAULT_NEWS_TOPICS, instruments, configured: true,
          history: { topics: timestamps(value.history?.topics), instruments: timestamps(value.history?.instruments) } };
      }
    } catch {
      // Fall back to the previous preference format.
    }
  }
  const topics = await getLegacyNewsTopics();
  return { topics: topics.length ? topics : DEFAULT_NEWS_TOPICS, instruments: [], configured: topics.length > 0,
    history: { topics: [], instruments: [] } };
}

function visibleInterests(all: Interests, isPro: boolean): Interests {
  if (isPro) return all;
  return { ...all, topics: all.topics.slice(0, FREE_RADAR.topics), instruments: all.instruments.slice(0, FREE_RADAR.instruments) };
}

export async function getNewsInterests(isPro: boolean): Promise<Interests> {
  return visibleInterests(await readInterests(), isPro);
}

export class RadarLimitError extends Error {
  constructor(readonly section: keyof History) { super(section); }
}

let pendingSave = Promise.resolve();
export function setNewsInterests(topics: NewsTopicId[], instruments: string[], isPro: boolean): Promise<Interests> {
  const task = pendingSave.then(async () => {
    const all = await readInterests();
    const previous = visibleInterests(all, isPro);
    const next = {
      topics: NEWS_TOPICS.map(({ id }) => id).filter((id) => topics.includes(id)),
      instruments: [...new Set(instruments)].filter(getInstrument),
    };
    if (!next.topics.length) throw new Error("Select at least one topic");
    const now = Date.now();
    const history: History = { topics: [], instruments: [] };
    const remaining = remainingChanges(all.history, now);
    const changed = (before: string[], after: string[]) =>
      before.length !== after.length || after.some((id) => !before.includes(id));
    for (const section of ["topics", "instruments"] as const) {
      history[section] = all.history[section].filter((date) => date + RADAR_WEEK_MS > now);
      if (isPro) continue;
      if (next[section].length > FREE_RADAR[section]) throw new RadarLimitError(section);
      if (all.configured && changed(previous[section], next[section])) {
        if (!remaining[section]) throw new RadarLimitError(section);
        history[section].push(now);
      }
    }
    const saved = { ...next, history, configured: true };
    // Preserve overflow from an older or Pro watchlist until that selection is edited.
    if (!changed(previous.instruments, next.instruments)) saved.instruments = all.instruments;
    if (all.configured && !changed(previous.topics, next.topics)) saved.topics = all.topics;
    await setPreference(INTERESTS_PREFERENCE_KEY, JSON.stringify(saved));
    return visibleInterests(saved, isPro);
  });
  pendingSave = task.then(() => {}, () => {});
  return task;
}

export async function getSavedNews(): Promise<NewsItem[]> {
  const preference = await getPreference(SAVED_NEWS_PREFERENCE_KEY);
  if (!preference) return [];
  try {
    const value: unknown = JSON.parse(preference.value);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is NewsItem =>
      typeof item?.id === "string" &&
      typeof item.title === "string" &&
      typeof item.url === "string" &&
      /^https?:\/\//i.test(item.url) &&
      typeof item.source?.name === "string" &&
      Array.isArray(item.topics)
    );
  } catch {
    return [];
  }
}

export async function setSavedNews(items: NewsItem[]): Promise<void> {
  await setPreference(SAVED_NEWS_PREFERENCE_KEY, JSON.stringify(items));
}
