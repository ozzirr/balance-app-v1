import catalog from "./instrumentCatalog.json";

export const INSTRUMENT_GROUPS = ["usa", "italy"] as const;
export type InstrumentGroup = typeof INSTRUMENT_GROUPS[number];
export type NewsInstrument = {
  id: string;
  name: string;
  ticker: string;
  group: InstrumentGroup;
  exchange: string;
  aliases: string[];
  featured?: boolean;
  color?: string;
  icon?: string;
};

export const INSTRUMENT_CATALOG = catalog as NewsInstrument[];
const byId = new Map(INSTRUMENT_CATALOG.map((item) => [item.id, item]));

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

const searchIndex = INSTRUMENT_CATALOG.map((item) => ({
  item,
  ticker: normalize(item.ticker),
  names: [item.name, ...item.aliases].map(normalize),
}));

export function searchInstruments(query: string, group: InstrumentGroup | "all" = "all") {
  const term = normalize(query);
  if (!term) return [];
  const words = term.split(" ");
  const results = [];
  for (const { item, ticker, names } of searchIndex) {
    if (group !== "all" && item.group !== group) continue;
    const score = ticker === term ? 0
      : names.includes(term) ? 1
      : ticker.startsWith(term) ? 2
      : names.some((name) => name.startsWith(term)) ? 3
      : names.some((name) => words.every((word) => name.includes(word))) ? 4 : -1;
    if (score >= 0) results.push({ item, score });
  }
  return results.sort((a, b) => a.score - b.score).map(({ item }) => item);
}

export function marketLabel(exchange: string) {
  if (exchange === "NASDAQ") return "Nasdaq";
  if (exchange === "XMIL") return "Euronext Milan";
  return exchange;
}

export function getInstrument(id: string) {
  return byId.get(id);
}

export function resolveStoredInstrument(value: string) {
  const key = value.trim().toLowerCase();
  return byId.get(key)?.id ?? INSTRUMENT_CATALOG.find((entry) =>
    [entry.name, entry.ticker, ...entry.aliases].some((alias) => alias.toLowerCase() === key)
  )?.id;
}
