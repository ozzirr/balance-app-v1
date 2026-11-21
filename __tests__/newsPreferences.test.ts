import { getNewsInterests, setNewsInterests, remainingChanges, RADAR_WEEK_MS, RadarLimitError } from "@/features/news/newsPreferences";
import { DEFAULT_NEWS_TOPICS } from "@/features/news/catalog";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";

jest.mock("@/repositories/preferencesRepo", () => ({
  getPreference: jest.fn(),
  setPreference: jest.fn(),
}));

const stored = new Map<string, string>();

beforeEach(() => {
  stored.clear();
  jest.mocked(getPreference).mockImplementation(async (key) => {
    const value = stored.get(key);
    return value === undefined ? null : { key, value };
  });
  jest.mocked(setPreference).mockImplementation(async (key, value) => {
    stored.set(key, value);
  });
});

it("offers defaults on first visit and remembers confirmed choices without followed stocks", async () => {
  expect(await getNewsInterests(false)).toMatchObject({ configured: false, topics: DEFAULT_NEWS_TOPICS.slice(0, 2), instruments: [] });
  await setNewsInterests(["taxes"], [], false);
  expect(await getNewsInterests(false)).toMatchObject({ configured: true, topics: ["taxes"], instruments: [] });
});

it("keeps valid preferences across upgrades and uses the legacy selection when needed", async () => {
  stored.set("news.interests", "{");
  stored.set("news.followedTopics", JSON.stringify(["markets", "unknown"]));
  expect(await getNewsInterests(false)).toMatchObject({ configured: true, topics: ["markets"], instruments: [] });
  await setNewsInterests(["investing"], ["aapl"], false);
  expect(await getNewsInterests(false)).toMatchObject({ configured: true, topics: ["investing"], instruments: ["aapl"] });
});

it("counts confirmed edits separately and restores each allowance after seven days", async () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000000000);
  try {
    const stocks = ["aapl", "msft", "amzn"];
    const initial = await setNewsInterests(["markets", "rates"], stocks, false);
    expect(remainingChanges(initial.history)).toEqual({ instruments: 2, topics: 1 });
    const same = await setNewsInterests(["rates", "markets"], [...stocks].reverse(), false);
    expect(same.history).toEqual(initial.history);
    await expect(setNewsInterests(["markets", "rates", "taxes"], stocks, false)).rejects.toThrow(RadarLimitError);
    await expect(setNewsInterests(["markets"], [...stocks, "meta"], false)).rejects.toThrow(RadarLimitError);
    await setNewsInterests(["taxes"], ["meta", "msft", "amzn"], false);
    clock.mockReturnValue(1000000000 + 60000);
    const last = await setNewsInterests(["taxes"], ["meta", "aapl", "amzn"], false);
    expect(remainingChanges(last.history)).toEqual({ instruments: 0, topics: 0 });
    await expect(setNewsInterests(["markets"], [], false)).rejects.toThrow(RadarLimitError);
    expect((await getNewsInterests(false)).instruments).toEqual(last.instruments);
    clock.mockReturnValue(1000000000 + RADAR_WEEK_MS);
    expect(remainingChanges((await getNewsInterests(false)).history)).toEqual({ instruments: 1, topics: 1 });
  } finally {
    clock.mockRestore();
  }
});

it("retains the whole Pro watchlist on downgrade and counts concurrent saves once", async () => {
  const ids = require("../src/features/news/instrumentCatalog.json").slice(0, 12).map((row: { id: string }) => row.id);
  await setNewsInterests(DEFAULT_NEWS_TOPICS, ids, true);
  const free = await getNewsInterests(false);
  expect(free.instruments).toHaveLength(3);
  expect(free.topics).toHaveLength(2);
  await Promise.all([1, 2].map(() => setNewsInterests(["taxes"], free.instruments, false)));
  const pro = await getNewsInterests(true);
  expect(pro.instruments).toEqual(ids);
  expect(pro.history.topics).toHaveLength(1);
  await setNewsInterests(["rates"], ids, true);
  await setNewsInterests(DEFAULT_NEWS_TOPICS, ids, true);
  expect((await getNewsInterests(true)).topics).toHaveLength(DEFAULT_NEWS_TOPICS.length);
});
