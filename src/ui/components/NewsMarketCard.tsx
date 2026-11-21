import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Svg, { Line, Polyline } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { marketLabel, type NewsInstrument } from "@/features/news/instrumentCatalog";
import { loadMarketSnapshot, type MarketPeriod, type MarketSnapshot } from "@/features/news/marketService";
import { useDashboardTheme } from "@/ui/dashboard/theme";

const periods = ["1d", "1m", "1y"] as const;
const chartHeight = 92;

export default function NewsMarketCard({ instrument, refresh }: { instrument: NewsInstrument; refresh: number }) {
  const { t, i18n } = useTranslation();
  const { tokens: { colors } } = useDashboardTheme();
  const [period, setPeriod] = useState<MarketPeriod>("1m");
  const [result, setResult] = useState<{ period: MarketPeriod; data: MarketSnapshot | null }>();
  const [latestQuote, setLatestQuote] = useState<MarketSnapshot | null>(null);
  const [chartAvailable, setChartAvailable] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setResult({ period, data: null });
    }, 8_000);
    loadMarketSnapshot(instrument.id, period, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult({ period, data });
        if (data && data.points.length >= 2) setChartAvailable(true);
        if (data?.quote) setLatestQuote(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ period, data: null });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [instrument.id, period, refresh]);

  const locale = i18n.resolvedLanguage || i18n.language;
  const selected = result?.period === period ? result : undefined;
  const series = selected?.data?.points ?? [];
  const quote = latestQuote?.quote;
  if (!quote && !chartAvailable && series.length < 2) return null;

  const priceFormat = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: latestQuote?.currency ?? selected?.data?.currency ?? (instrument.group === "usa" ? "USD" : "EUR"),
  });
  const change = quote?.changePercent == null ? null : new Intl.NumberFormat(locale, {
    signDisplay: "exceptZero", style: "percent", maximumFractionDigits: 2,
  }).format(quote.changePercent / 100);
  const first = series[0];
  const last = series[series.length - 1];
  const closes = series.map(({ close }) => close);
  const lower = Math.min(...closes);
  const range = Math.max(...closes) - lower;
  const chart = series.map(({ close }, index) => {
    const x = 2 + index * (chartWidth - 4) / (series.length - 1);
    const y = range ? chartHeight - 8 - (close - lower) * (chartHeight - 16) / range : chartHeight / 2;
    return `${x},${y}`;
  }).join(" ");
  const formatPoint = (date: string) => period === "1d"
    ? date.slice(11, 16)
    : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" })
      .format(new Date(date.slice(0, 10) + "T00:00:00Z"));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
      <Text variant="titleMedium" style={{ color: colors.text }}>{instrument.name}</Text>
      <Text variant="labelMedium" style={{ color: colors.muted }}>
        {instrument.ticker} · {marketLabel(instrument.exchange)}
      </Text>
      {quote && latestQuote ? (
        <View style={styles.quote}>
          <Text variant="labelMedium" style={{ color: colors.muted }}>{t("news.market.latest")}</Text>
          <View style={styles.priceRow}>
            <Text variant="headlineMedium" style={[styles.price, { color: colors.text }]}>
              {priceFormat.format(quote.price)}
            </Text>
            {change ? (
              <Text variant="labelLarge" style={{ color: colors.accent }} accessibilityLabel={t("news.market.dailyChange", { value: change })}>
                {change}
              </Text>
            ) : null}
          </View>
          {quote.timestamp ? <Text variant="labelSmall" style={{ color: colors.muted }}>
            {new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(quote.timestamp * 1000)}
          </Text> : null}
        </View>
      ) : null}
      <View style={styles.periods}>
        {periods.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: value === period }}
            accessibilityLabel={t(`news.market.periods.${value}.label`)}
            onPress={() => {
              if (value !== period) {
                setResult(undefined);
                setPeriod(value);
              }
            }}
            style={[styles.period, { borderColor: value === period ? colors.accent : colors.glassBorder }]}
          >
            <Text variant="labelMedium" style={{ color: value === period ? colors.accent : colors.muted }}>
              {t(`news.market.periods.${value}.short`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View onLayout={({ nativeEvent }) => setChartWidth(nativeEvent.layout.width)}>
        {!selected ? <ActivityIndicator color={colors.accent} style={styles.chartState} accessibilityLabel={t("news.market.loading")} />
          : first && last && series.length >= 2 ? (
            <>
              <View accessible accessibilityLabel={t("news.market.graph", {
                first: priceFormat.format(first.close),
                last: priceFormat.format(last.close),
              })}>
                {chartWidth > 4 ? (
                  <Svg width={chartWidth} height={chartHeight}>
                    {[8, chartHeight / 2, chartHeight - 8].map((y) => (
                      <Line key={y} x1={0} x2={chartWidth} y1={y} y2={y} stroke={colors.glassBorder} />
                    ))}
                    <Polyline points={chart} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" />
                  </Svg>
                ) : <View style={{ height: chartHeight }} />}
              </View>
              <View style={styles.axis}>
                <Text variant="labelSmall" style={{ color: colors.muted }}>{formatPoint(first.date)}</Text>
                <Text variant="labelSmall" style={{ color: colors.muted }}>{formatPoint(last.date)}</Text>
              </View>
            </>
          ) : <Text variant="bodySmall" style={[styles.chartState, { color: colors.muted }]}>{t("news.market.chartUnavailable")}</Text>}
      </View>
      {selected?.data && !quote ? <Text variant="bodySmall" style={{ color: colors.muted }}>{t("news.market.quoteUnavailable")}</Text> : null}
      {selected?.data || latestQuote ? <Text variant="labelSmall" style={{ color: colors.muted }}>Twelve Data</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 24, borderWidth: 1, borderRadius: 22, padding: 16, gap: 6 },
  quote: { marginTop: 8, gap: 2 },
  priceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  price: { fontWeight: "700" },
  periods: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  period: { paddingHorizontal: 12, minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: 14 },
  chartState: { paddingVertical: 16 },
  axis: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
});
