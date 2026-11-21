const periods = {
  "1d": { interval: "5min", outputsize: 120, ttl: 5 * 60_000 },
  "1m": { interval: "1day", outputsize: 32, ttl: 30 * 60_000 },
  "1y": { interval: "1week", outputsize: 54, ttl: 60 * 60_000 },
};

const markets = {
  NASDAQ: { query: { exchange: "NASDAQ" }, mics: ["XNAS", "XNGS", "XNMS", "XNCM"], currency: "USD", name: "Nasdaq" },
  NYSE: { query: { exchange: "NYSE" }, mics: ["XNYS"], currency: "USD", name: "NYSE" },
  "Cboe BZX": { query: { mic_code: "BATS" }, mics: ["BATS"], currency: "USD", name: "Cboe BZX" },
  XMIL: { query: { mic_code: "XMIL" }, mics: ["XMIL"], currency: "EUR", name: "Euronext Milan" },
};

function price(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function isListing(data, symbol, market) {
  return data?.symbol === symbol && data.currency === market.currency && market.mics.includes(data.mic_code);
}

export function isMarketPeriod(period) {
  return Object.hasOwn(periods, period);
}

export function createMarketQuotes({ apiKey, fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();

  function cached(key, ttl, load) {
    const entry = cache.get(key);
    if (entry && entry.until > now()) return Promise.resolve(entry.value);
    if (pending.has(key)) return pending.get(key);
    const task = load().catch(() => null).then((value) => {
      cache.set(key, { value, until: now() + (value ? ttl : 60_000) });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }

  async function request(path, symbol, market, params) {
    const url = new URL(path, "https://api.twelvedata.com");
    url.search = new URLSearchParams({ symbol, ...market.query, ...params });
    const response = await fetchImpl(url, {
      headers: { Authorization: `apikey ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result?.status === "error" ? null : result;
  }

  return async function getMarketQuote(instrument, period) {
    if (!apiKey || !isMarketPeriod(period)) return null;
    const market = markets[instrument.exchange];
    if (!market) return null;
    const symbol = instrument.ticker;
    const { interval, outputsize, ttl } = periods[period];
    const [quote, points] = await Promise.all([
      cached(`${instrument.id}:quote`, 5 * 60_000, async () => {
        const result = await request("/quote", symbol, market, { interval: "1day" });
        if (!isListing(result, symbol, market)) return null;
        const latest = price(result.close);
        if (latest === undefined) return null;
        const previous = price(result.previous_close);
        const timestamp = Number(result.last_quote_at);
        return {
          price: latest,
          changePercent: previous ? (latest / previous - 1) * 100 : null,
          timestamp: Number.isSafeInteger(timestamp) && timestamp > 0 && timestamp <= now() / 1000 + 60 ? timestamp : null,
        };
      }),
      cached(`${instrument.id}:${period}`, ttl, async () => {
        const result = await request("/time_series", symbol, market, { interval, outputsize, order: "desc", timezone: "Exchange" });
        if (!isListing(result?.meta, symbol, market) || !Array.isArray(result.values)) return null;
        const values = new Map();
        for (const row of result.values) {
          const close = price(row?.close);
          if (close !== undefined && typeof row.datetime === "string" &&
            /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(row.datetime)) {
            values.set(row.datetime, close);
          }
        }
        const sorted = [...values].sort(([a], [b]) => a.localeCompare(b));
        const lastDate = sorted.at(-1)?.[0].slice(0, 10);
        if (!lastDate) return null;
        let selected;
        if (period === "1d") {
          selected = sorted.filter(([date]) => date.startsWith(lastDate));
        } else {
          const cutoff = new Date(lastDate + "T00:00:00Z");
          cutoff.setUTCDate(cutoff.getUTCDate() - (period === "1m" ? 30 : 365));
          selected = sorted.filter(([date]) => date.slice(0, 10) >= cutoff.toISOString().slice(0, 10));
        }
        return selected.length >= 2 ? selected.map(([date, close]) => ({ date, close })) : null;
      }),
    ]);
    if (!quote && !points) return null;
    return { symbol, exchange: market.name, currency: market.currency, quote, points: points ?? [] };
  };
}
