import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listWallets } from "@/repositories/walletsRepo";
import { getLatestSnapshot, listSnapshotLines, listSnapshots } from "@/repositories/snapshotsRepo";
import { listIncomeEntries } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries } from "@/repositories/expenseEntriesRepo";
import { listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import type { SnapshotLineDetail } from "@/repositories/types";
import { todayIso } from "@/utils/dates";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import type { DashboardData } from "@/ui/dashboard/types";
import { buildDashboardData, createMockDashboardData } from "@/ui/dashboard/adapter";
import KPIStrip from "@/ui/dashboard/components/KPIStrip";
import PortfolioLineChartCard from "@/ui/dashboard/components/PortfolioLineChartCard";
import DonutDistributionCard from "@/ui/dashboard/components/DonutDistributionCard";
import CashflowOverviewCard from "@/ui/dashboard/components/CashflowOverviewCard";
import CategoriesBreakdownCard from "@/ui/dashboard/components/CategoriesBreakdownCard";
import RecurrencesTableCard from "@/ui/dashboard/components/RecurrencesTableCard";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import Skeleton from "@/ui/dashboard/components/Skeleton";

type Nav = {
  navigate: (name: string, params?: Record<string, unknown>) => void;
};

export default function DashboardScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [walletsCount, setWalletsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [prompted, setPrompted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const wallets = await listWallets(true);
      setWalletsCount(wallets.length);

      const [snapshots, incomeEntries, expenseEntries, expenseCategories, pref, prefName, prefSurname] = await Promise.all([
        listSnapshots(),
        listIncomeEntries(),
        listExpenseEntries(),
        listExpenseCategories(),
        getPreference("chart_points"),
        getPreference("profile_name"),
        getPreference("profile_surname"),
      ]);

      const latestSnapshot = await getLatestSnapshot();
      let latestLines: SnapshotLineDetail[] = [];
      if (latestSnapshot) {
        latestLines = await listSnapshotLines(latestSnapshot.id);
      }

      const snapshotLines: Record<number, SnapshotLineDetail[]> = {};
      await Promise.all(
        snapshots.map(async (snapshot) => {
          snapshotLines[snapshot.id] = await listSnapshotLines(snapshot.id);
        })
      );

      const chartPointsRaw = pref ? Number(pref.value) : 6;
      const chartPoints = Number.isFinite(chartPointsRaw) ? Math.min(12, Math.max(3, chartPointsRaw)) : 6;
      const firstName = prefName?.value?.trim();
      setUserName(firstName || null);

      const data = buildDashboardData({
        latestLines,
        snapshots: snapshots.slice(-chartPoints),
        snapshotLines,
        incomeEntries,
        expenseEntries,
        expenseCategories,
      });
      setDashboard(data);

      const ask = await getPreference("ask_snapshot_on_start");
      if (!prompted && ask?.value === "true") {
        const today = todayIso();
        if (!latestSnapshot || latestSnapshot.date !== today) {
          setPrompted(true);
          navigation.navigate("Snapshot", { openNew: true });
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento.");
      setDashboard(createMockDashboardData());
    }
  }, [navigation, prompted]);

  useEffect(() => {
    setLoading(true);
    load()
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const emptyState = walletsCount === 0 && !loading;

  const skeleton = useMemo(
    () => (
      <View style={styles.section}>
        <Skeleton height={140} radius={tokens.radius.md} />
        <Skeleton height={220} radius={tokens.radius.md} />
        <Skeleton height={220} radius={tokens.radius.md} />
      </View>
    ),
    [tokens.radius.md]
  );

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top - 40,
            paddingBottom: 160 + insets.bottom,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !dashboard && skeleton}

        {error && !loading ? (
          <PremiumCard>
            <Text style={[styles.errorTitle, { color: tokens.colors.text }]}>Impossibile caricare la dashboard</Text>
            <Text style={[styles.errorBody, { color: tokens.colors.muted }]}>{error}</Text>
          </PremiumCard>
        ) : null}

        {emptyState ? (
          <PremiumCard>
            <Text style={[styles.emptyTitle, { color: tokens.colors.text }]}>Nessun dato disponibile</Text>
            <Text style={[styles.emptyBody, { color: tokens.colors.muted }]}>Crea almeno un wallet per iniziare.</Text>
          </PremiumCard>
        ) : null}

        {dashboard ? (
          <>
            <View style={styles.section}>
              <KPIStrip items={dashboard.kpis} />
            </View>

            <View style={styles.section}>
              <Text style={[styles.greeting, { color: tokens.colors.text }]}>
                {userName ? `Ciao ${userName}` : "Ciao"}
              </Text>
              <PortfolioLineChartCard data={dashboard.portfolioSeries} />
            </View>

            <View style={styles.section}>
              <DonutDistributionCard items={dashboard.distributions} />
            </View>

            <View style={styles.section}>
              <CashflowOverviewCard cashflow={dashboard.cashflow} />
            </View>

            <View style={styles.section}>
              <CategoriesBreakdownCard items={dashboard.categories} />
            </View>

            <View style={styles.section}>
              <RecurrencesTableCard rows={dashboard.recurrences} />
            </View>
          </>
        ) : null}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    marginTop: 6,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  errorBody: {
    marginTop: 6,
  },
});
