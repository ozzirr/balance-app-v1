import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import {
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryLine,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from "victory-native";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { PillChip, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatCompact, formatEUR, formatMonthLabel } from "@/ui/dashboard/formatters";
import type { PortfolioPoint, WalletSeries } from "@/ui/dashboard/types";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassBlur from "@/ui/components/GlassBlur";

type Mode = "total" | "liquidity" | "investments";

type Props = {
  data: PortfolioPoint[];
  walletSeries?: WalletSeries[];
  hideHeader?: boolean;
  noCard?: boolean;
  modes?: ("total" | "liquidity" | "investments")[];
};

const WALLET_FILTER_ALL = "all" as const;
type WalletFilter = number | typeof WALLET_FILTER_ALL | null;
type WalletFilterState = {
  total: WalletFilter;
  liquidity: WalletFilter;
  investments: WalletFilter;
};

const STORAGE_KEY = "dashboard_portfolio_filters_v1";

export default function PortfolioLineChartCard({
  data,
  walletSeries,
  hideHeader = false,
  noCard = false,
  modes,
}: Props): JSX.Element {
  const { tokens, isDark } = useDashboardTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const availableModes = useMemo(
    () => (modes ?? ["total", "liquidity", "investments"]) as Mode[],
    [modes]
  );
  const [mode, setMode] = useState<Mode>(availableModes[0]);
  const [walletFilterByMode, setWalletFilterByMode] = useState<WalletFilterState>({
    total: WALLET_FILTER_ALL,
    liquidity: WALLET_FILTER_ALL,
    investments: WALLET_FILTER_ALL,
  });
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const walletPickerAnim = React.useRef(new Animated.Value(0)).current;
  const [hasLoadedPrefs, setHasLoadedPrefs] = useState(false);
  const { width } = useWindowDimensions();

  const walletSeriesByMode = useMemo(() => {
    if (!walletSeries) return [];
    if (mode === "total") return walletSeries;
    if (mode === "liquidity") return walletSeries.filter((item) => item.type === "LIQUIDITY");
    if (mode === "investments") return walletSeries.filter((item) => item.type === "INVEST");
    return [];
  }, [mode, walletSeries]);

  const walletFilter =
    mode === "total"
      ? walletFilterByMode.total
      : mode === "liquidity"
      ? walletFilterByMode.liquidity
      : mode === "investments"
        ? walletFilterByMode.investments
        : null;

  // Ensure mode is always one of the available options
  useEffect(() => {
    if (!availableModes.includes(mode)) {
      setMode(availableModes[0]);
    }
  }, [availableModes, mode]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          const parsed = JSON.parse(raw) as {
            mode?: Mode;
            walletFilterByMode?: Partial<WalletFilterState>;
          };
          if (parsed.mode && availableModes.includes(parsed.mode)) {
            setMode(parsed.mode);
          }
          if (parsed.walletFilterByMode) {
            setWalletFilterByMode((prev) => ({
              total: parsed.walletFilterByMode?.total ?? prev.total,
              liquidity: parsed.walletFilterByMode?.liquidity ?? prev.liquidity,
              investments: parsed.walletFilterByMode?.investments ?? prev.investments,
            }));
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHasLoadedPrefs(true);
      });

    return () => {
      active = false;
    };
  }, [availableModes]);

  useEffect(() => {
    if (!hasLoadedPrefs) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode,
        walletFilterByMode,
      })
    ).catch(() => {});
  }, [hasLoadedPrefs, mode, walletFilterByMode]);

  useEffect(() => {
    if (!walletSeriesByMode.length) {
      return;
    }
    const exists =
      walletFilter === WALLET_FILTER_ALL ||
      (walletFilter !== null && walletSeriesByMode.some((wallet) => wallet.walletId === walletFilter));
    if (!exists) {
      setWalletFilterByMode((prev) => ({
        ...prev,
        [mode]: WALLET_FILTER_ALL,
      }));
    }
  }, [mode, walletFilter, walletSeriesByMode]);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        x: point.date,
        y: mode === "total" ? point.total : mode === "liquidity" ? point.liquidity : point.investments,
      })),
    [data, mode]
  );

  const showWalletFilters = walletSeriesByMode.length > 0;
  const selectedWalletLabel = useMemo(() => {
    if (walletFilter === WALLET_FILTER_ALL || walletFilter === null) {
      return t("common.all", { defaultValue: "Tutti" });
    }
    return walletSeriesByMode.find((wallet) => wallet.walletId === walletFilter)?.name ?? t("common.all", { defaultValue: "Tutti" });
  }, [t, walletFilter, walletSeriesByMode]);

  const openWalletPicker = () => {
    setWalletPickerVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(walletPickerAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  };

  const closeWalletPicker = () => {
    Animated.timing(walletPickerAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setWalletPickerVisible(false);
      }
    });
  };

  const selectWalletFilter = (next: WalletFilter) => {
    setWalletFilterByMode((prev) => ({
      ...prev,
      [mode]: next,
    }));
    closeWalletPicker();
  };

  const toAlpha = (color: string, alpha: string) => {
    if (color.startsWith("#") && color.length === 7) {
      return `${color}${alpha}`;
    }
    return color;
  };

  const displaySeries = useMemo(() => {
    if (!showWalletFilters) {
      return [
        {
          id: mode,
          color: tokens.colors.accent,
          showArea: true,
          data: chartData,
        },
      ];
    }

    if (walletFilter === WALLET_FILTER_ALL) {
      return [
        {
          id: mode,
          color: tokens.colors.accent,
          showArea: true,
          data: chartData,
        },
      ];
    }

    const selected = walletSeriesByMode.find((wallet) => wallet.walletId === walletFilter);
    if (!selected) {
      return [
        {
          id: mode,
          color: tokens.colors.accent,
          showArea: true,
          data: chartData,
        },
      ];
    }

    return [
      {
        id: `wallet-${selected.walletId}`,
        color: selected.color,
        showArea: true,
        data: selected.points.map((point) => ({
          x: point.date,
          y: point.value,
          walletName: selected.name,
        })),
      },
    ];
  }, [chartData, mode, showWalletFilters, tokens.colors.accent, walletFilter, walletSeriesByMode]);

  const seriesValues = useMemo(
    () => displaySeries.flatMap((series) => series.data.map((point) => point.y ?? 0)),
    [displaySeries]
  );
  const highestValue = seriesValues.reduce((max, value) => Math.max(max, value), 0);
  const lowestValue = seriesValues.reduce((min, value) => Math.min(min, value), highestValue || 0);
  const range = Math.max(0, highestValue - lowestValue);
  const padding = range === 0 ? Math.max(highestValue * 0.05, 1) : range * 0.15;
  const domainMin = Math.max(0, lowestValue - padding);
  const domainMax = highestValue > 0 ? highestValue + padding : 1;
  const chartHeight = 260;

  const visibleWidth = Math.max(width - 64, 0);
  const pointSpacing = 70;
  const chartPaddingLeft = 15;
  const chartPaddingRight = 35;
  const pointCount = displaySeries[0]?.data.length ?? 0;
  const chartWidth = Math.max(
    visibleWidth,
    Math.max(pointCount - 1, 0) * pointSpacing + chartPaddingLeft + chartPaddingRight
  );
  const chartOffset = Math.max(chartWidth - visibleWidth, 0);
  const walletSheetTranslateY = walletPickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [64, 0],
  });
  const sheetBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
        ? "rgba(15, 18, 30, 0.78)"
        : "rgba(169, 124, 255, 0.5)";
  const sheetBorder =
    Platform.OS === "android" ? tokens.colors.border : isDark ? tokens.colors.border : "rgba(169, 124, 255, 0.5)";
  const overlayTint = isDark ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.8)";

  const content = (
    <>
      {!hideHeader && <SectionHeader title={t("dashboard.portfolio.header")} />}
      <View style={styles.filtersRow}>
        {availableModes.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={styles.modeScroll}
            style={styles.modeScrollView}
          >
            {availableModes.map((item) => {
              const label =
                item === "total"
                  ? t("dashboard.portfolio.toggle.total")
                  : item === "liquidity"
                    ? t("dashboard.portfolio.toggle.liquidity")
                    : t("dashboard.portfolio.toggle.investments");
              const active = item === mode;
              return (
                <PillChip
                  key={item}
                  label={label}
                  selected={active}
                  onPress={() => setMode(item)}
                />
              );
            })}
          </ScrollView>
        )}
        {showWalletFilters && (
          <Pressable
            onPress={openWalletPicker}
            style={({ pressed }) => [
              styles.walletPickerButton,
              {
                borderColor: tokens.colors.glassBorder,
                backgroundColor: tokens.colors.glassBg,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons name="filter-variant" size={16} color={tokens.colors.accent} />
            <Text style={[styles.walletPickerLabel, { color: tokens.colors.text }]}>Wallet</Text>
            {walletFilter !== WALLET_FILTER_ALL ? <View style={[styles.activeFilterDot, { backgroundColor: tokens.colors.accent }]} /> : null}
            <MaterialCommunityIcons name="chevron-down" size={18} color={tokens.colors.muted} />
          </Pressable>
        )}
      </View>
      {showWalletFilters && (
        <Modal
          visible={walletPickerVisible}
          transparent
          animationType="none"
          presentationStyle="overFullScreen"
          onRequestClose={closeWalletPicker}
        >
          <View style={styles.sheetOverlay} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={closeWalletPicker}>
              <Animated.View
                pointerEvents="none"
                style={[styles.sheetOverlayDim, { backgroundColor: overlayTint, opacity: walletPickerAnim }]}
              />
            </Pressable>
            <Animated.View
              pointerEvents="auto"
              style={[
                styles.walletSheet,
                {
                  backgroundColor: sheetBackground,
                  borderColor: sheetBorder,
                  paddingBottom: insets.bottom + 12,
                  transform: [{ translateY: walletSheetTranslateY }],
                  opacity: walletPickerAnim,
                },
              ]}
            >
              <GlassBlur intensity={35} tint={isDark ? "dark" : "light"} fallbackColor="transparent" />
              <View style={styles.walletSheetHeader}>
                <Text style={[styles.walletSheetTitle, { color: tokens.colors.text }]}>
                  {t("dashboard.portfolio.walletFilterTitle", { defaultValue: "Filtra per wallet" })}
                </Text>
                <SmallOutlinePillButton
                  label={t("dashboard.reorder.done", { defaultValue: "Fatto" })}
                  onPress={closeWalletPicker}
                  color={tokens.colors.accent}
                />
              </View>
              <Text style={[styles.walletSheetHint, { color: tokens.colors.muted }]}>
                {t("dashboard.portfolio.walletFilterHint", {
                  defaultValue: "Scegli quali valori mostrare nel grafico.",
                })}
              </Text>
              <ScrollView
                style={styles.walletSheetScroll}
                contentContainerStyle={styles.walletSheetList}
                showsVerticalScrollIndicator={false}
              >
                <Pressable
                  onPress={() => selectWalletFilter(WALLET_FILTER_ALL)}
                  style={({ pressed }) => [
                    styles.walletOption,
                    {
                      borderColor: tokens.colors.glassBorder,
                      backgroundColor: walletFilter === WALLET_FILTER_ALL ? `${tokens.colors.accent}22` : tokens.colors.glassBg,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <View style={styles.walletOptionContent}>
                    <Text style={[styles.walletOptionLabel, { color: tokens.colors.text }]}>
                      {t("common.all", { defaultValue: "Tutti" })}
                    </Text>
                    <Text style={[styles.walletOptionMeta, { color: tokens.colors.muted }]} numberOfLines={1}>
                      {selectedWalletLabel === t("common.all", { defaultValue: "Tutti" })
                        ? t("dashboard.portfolio.walletFilterAllMeta", { defaultValue: "Tutti i wallet disponibili" })
                        : selectedWalletLabel}
                    </Text>
                  </View>
                  {walletFilter === WALLET_FILTER_ALL ? (
                    <MaterialCommunityIcons name="check" size={18} color={tokens.colors.accent} />
                  ) : null}
                </Pressable>
                {walletSeriesByMode.map((wallet) => (
                  <Pressable
                    key={wallet.walletId}
                    onPress={() => selectWalletFilter(wallet.walletId)}
                    style={({ pressed }) => [
                      styles.walletOption,
                      {
                        borderColor: tokens.colors.glassBorder,
                        backgroundColor: walletFilter === wallet.walletId ? `${tokens.colors.accent}22` : tokens.colors.glassBg,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <View style={styles.walletOptionContent}>
                      <Text style={[styles.walletOptionLabel, { color: tokens.colors.text }]} numberOfLines={1}>
                        {wallet.name}
                      </Text>
                      <Text style={[styles.walletOptionMeta, { color: tokens.colors.muted }]} numberOfLines={1}>
                        {mode === "investments"
                          ? t("dashboard.portfolio.toggle.investments")
                          : mode === "liquidity"
                            ? t("dashboard.portfolio.toggle.liquidity")
                            : t("dashboard.portfolio.toggle.total")}
                      </Text>
                    </View>
                    {walletFilter === wallet.walletId ? (
                      <MaterialCommunityIcons name="check" size={18} color={tokens.colors.accent} />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      )}
      {displaySeries.length === 0 || displaySeries[0].data.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>{t("dashboard.portfolio.empty")}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          contentContainerStyle={[styles.chartScroll, { justifyContent: "flex-end" }]}
          contentOffset={{ x: chartOffset, y: 0 }}
        >
          <VictoryChart
            width={chartWidth}
            height={chartHeight}
            padding={{ left: chartPaddingLeft, right: chartPaddingRight, top: 18, bottom: 30 }}
            domain={{ y: [domainMin, domainMax] }}
            containerComponent={
              <VictoryVoronoiContainer
                voronoiBlacklist={displaySeries.map((series) => `area-${series.id}`)}
                labels={({ datum }) => {
                  const valueLabel = formatEUR(datum.y);
                  return `${valueLabel}`;
                }}
                labelComponent={
                  <VictoryTooltip
                    renderInPortal={false}
                    constrainToVisibleArea
                    flyoutStyle={{ fill: tokens.colors.surface2, stroke: tokens.colors.border, strokeWidth: 1 }}
                    style={{ fill: tokens.colors.text, fontSize: 13, fontWeight: "600" }}
                    cornerRadius={14}
                    pointerLength={0}
                    flyoutPadding={{ top: 6, bottom: 6, left: 10, right: 10 }}
                    dy={-12}
                  />
                }
              />
            }
          >
            <VictoryAxis
              tickFormat={(tick) => formatMonthLabel(String(tick))}
              style={{
                axis: { stroke: "transparent" },
                tickLabels: { fontSize: 11, fill: tokens.colors.muted, padding: 6 },
              }}
            />
            <VictoryAxis
              dependentAxis
              orientation="right"
              tickFormat={(tick) => formatCompact(Number(tick))}
              style={{
                axis: { stroke: "transparent" },
                grid: { stroke: tokens.colors.border },
                tickLabels: { fontSize: 11, fill: tokens.colors.muted, padding: 6 },
              }}
            />
            {displaySeries.map((series) =>
              series.showArea ? (
                <VictoryArea
                  key={`${series.id}-area`}
                  name={`area-${series.id}`}
                  data={series.data}
                  interpolation="natural"
                  style={{ data: { fill: toAlpha(series.color, "3B") } }}
                />
              ) : null
            )}
            {displaySeries.map((series) => (
              <VictoryLine
                key={series.id}
                data={series.data}
                interpolation="natural"
                style={{ data: { stroke: series.color, strokeWidth: 2.5 } }}
              />
            ))}
          </VictoryChart>
        </ScrollView>
      )}
    </>
  );

  if (noCard) {
    return <>{content}</>;
  }

  return (
    <View>
      <PremiumCard>{content}</PremiumCard>
    </View>
  );
}

const styles = StyleSheet.create({
  filtersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  modeScrollView: {
    flex: 1,
    minWidth: 0,
  },
  modeScroll: {
    gap: 8,
    paddingRight: 4,
  },
  walletPickerButton: {
    minHeight: 34,
    minWidth: 98,
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  walletPickerLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  activeFilterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetOverlayDim: {
    ...StyleSheet.absoluteFillObject,
  },
  walletSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    gap: 12,
  },
  walletSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  walletSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  walletSheetHint: {
    fontSize: 12,
  },
  walletSheetScroll: {
    maxHeight: 420,
  },
  walletSheetList: {
    paddingVertical: 4,
    gap: 10,
  },
  walletOption: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  walletOptionContent: {
    flex: 1,
    flexDirection: "column",
  },
  walletOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  walletOptionMeta: {
    fontSize: 12,
  },
  empty: {
    fontSize: 13,
  },
  chartScroll: {
    paddingRight: 4,
  },
});
