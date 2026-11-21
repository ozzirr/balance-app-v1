import { INSTRUMENT_CATALOG, resolveStoredInstrument, searchInstruments } from "@/features/news/instrumentCatalog";
const { getCatalogInstrument, instrumentQuery, mentionsInstrument, isInvestorStory } = require("../server/news-instruments");

it("uses only catalog IDs and migrates supported saved names and tickers", () => {
  expect(getCatalogInstrument("Microsoft")).toBeUndefined();
  expect(getCatalogInstrument("risiko bancario")).toBeUndefined();
  expect(instrumentQuery(getCatalogInstrument("meta"))).toBe('"Meta Platforms" OR "Meta AI" OR "Facebook"');
  expect(resolveStoredInstrument("Microsoft")).toBe("msft");
  expect(resolveStoredInstrument("UCG")).toBe("ucg");
  expect(resolveStoredInstrument("IE00BK5BQT80")).toBeUndefined();
  expect(resolveStoredInstrument("vwce")).toBeUndefined();
  expect(getCatalogInstrument("vwce")).toBeUndefined();
  expect(resolveStoredInstrument("Risiko bancario")).toBeUndefined();
});

it("searches the local USA and Italy stock catalog by name, ticker and common name", () => {
  expect(INSTRUMENT_CATALOG.length).toBeGreaterThanOrEqual(500);
  expect(INSTRUMENT_CATALOG.filter((item) => item.group === "italy")).toHaveLength(40);
  expect(searchInstruments("brk b")[0].name).toBe("Berkshire Hathaway Class B");
  expect(searchInstruments("JP Morgan", "usa")[0].ticker).toBe("JPM");
  expect(searchInstruments("móncler")[0].ticker).toBe("MONC");
  expect(searchInstruments("Ferrari", "italy")[0].id).toBe("race");
  expect(searchInstruments("Intesa", "usa")).toEqual([]);
  expect(searchInstruments("VWCE")).toEqual([]);
  expect(getCatalogInstrument("us-jpm").exchange).toBe("NYSE");
});

it("matches complete mentions without confusing uppercase tickers with ordinary words", () => {
  expect(mentionsInstrument("Microsoft (MSFT) in rialzo", "", "MSFT")).toBe(true);
  expect(mentionsInstrument("Piano per la nuova sede", "", "PER")).toBe(false);
  expect(mentionsInstrument("ETF Vanguard", "Vanguard FTSE All-World", "Vanguard FTSE All World")).toBe(true);
  expect(mentionsInstrument("Un report su IE00BK5BQT800", "", "IE00BK5BQT80")).toBe(false);
});

it("keeps investor news and drops product rumors and programming announcements", () => {
  expect(isInvestorStory({ title: "Apple TV becomes the new U.S. home of F1 ACADEMY" })).toBe(false);
  expect(isInvestorStory({ title: "iPhone, Apple valuta il ritorno al titanio" })).toBe(false);
  expect(isInvestorStory({ title: "Commerzbank apre a UniCredit", summary: "Cosa cambia per chi ha azioni e conti correnti" })).toBe(true);
  expect(isInvestorStory({ title: "Apple reports quarterly earnings" })).toBe(true);
});
