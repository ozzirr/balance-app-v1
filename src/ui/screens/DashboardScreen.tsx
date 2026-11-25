import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  LayoutAnimation,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listWallets } from "@/repositories/walletsRepo";
import { listSnapshotLines, listSnapshots } from "@/repositories/snapshotsRepo";
import { listIncomeEntries } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries } from "@/repositories/expenseEntriesRepo";
import { listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import type { SnapshotLineDetail } from "@/repositories/types";
import { todayIso } from "@/utils/dates";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import type { DashboardData, KpiDeltaRange } from "@/ui/dashboard/types";
import { buildDashboardData, buildKpiDeltaForRange, createMockDashboardData } from "@/ui/dashboard/adapter";
import { formatEUR, formatPct, formatShortDate } from "@/ui/dashboard/formatters";
import PortfolioSummaryCard from "@/ui/dashboard/components/PortfolioSummaryCard";
import PortfolioCompositionCard from "@/ui/dashboard/components/PortfolioCompositionCard";
import BalanceReport from "@/ui/dashboard/components/BalanceReport";
import MonthlyPulse from "@/ui/dashboard/components/MonthlyPulse";
import PortfolioLineChartCard from "@/ui/dashboard/components/PortfolioLineChartCard";
import DonutDistributionCard from "@/ui/dashboard/components/DonutDistributionCard";
import CashflowOverviewCard from "@/ui/dashboard/components/CashflowOverviewCard";
import CategoriesBreakdownCard from "@/ui/dashboard/components/CategoriesBreakdownCard";
import RecurrencesTableCard from "@/ui/dashboard/components/RecurrencesTableCard";
import PressScale from "@/ui/dashboard/components/PressScale";
import Skeleton from "@/ui/dashboard/components/Skeleton";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import AppBackground from "@/ui/components/AppBackground";
import AppHeader from "@/ui/components/AppHeader";
import LimitReachedModal from "@/ui/components/LimitReachedModal";
import { GlassCardContainer } from "@/ui/components/EntriesUI";
import CoachTipCard from "@/ui/components/CoachTipCard";
import BottomSheet from "@/ui/components/BottomSheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/settings/useSettings";
import { onDataChanged, onDataReset } from "@/app/dataEvents";

type Nav = {
  navigate: (name: string, params?: Record<string, unknown>) => void;
  setParams?: (params: Record<string, unknown>) => void;
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SECTION_STATE_KEY = "dashboard.section.states";
const SECTION_ORDER_KEY = "dashboard.section.order";
const DEFAULT_SECTION_STATES: Record<string, boolean> = {
  andamento: true,
  distribuzione: false,
  cashflow: false,
  categories: false,
  prossimi: false,
};

type SectionId = "andamento" | "distribuzione" | "cashflow" | "categories" | "prossimi";

const SECTION_ORDER: SectionId[] = [
  "andamento",
  "distribuzione",
  "cashflow",
  "categories",
  "prossimi",
];
const REORDER_ROW_HEIGHT = 72;

type SectionAccordionProps = {
  title: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  locked?: boolean;
  lockedSubtitle?: string;
  onLockedPress?: () => void;
};

const SectionAccordion = ({
  title,
  icon = "chart-box-outline",
  open,
  onToggle,
  children,
  locked = false,
  lockedSubtitle,
  onLockedPress,
}: SectionAccordionProps): JSX.Element => {
  const { tokens } = useDashboardTheme();
  const handleToggle = () => {
    if (locked) {
      onLockedPress?.();
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };
  const isOpen = !locked && open;
  return (
    <View style={styles.section}>
      <GlassCardContainer style={locked ? styles.lockedCard : undefined}>
        <PressScale
          style={[styles.cardHeader, { borderColor: tokens.colors.glassBorder }]}
          onPress={handleToggle}
        >
          <View style={[styles.sectionIcon, { backgroundColor: `${tokens.colors.accent}18` }]}><MaterialCommunityIcons name={icon} size={19} color={tokens.colors.accent} /></View>
          <View style={styles.cardTitleBlock}>
            <Text style={[styles.accordionTitle, { color: tokens.colors.text }]}>{title}</Text>
            {locked && lockedSubtitle ? (
              <Text style={[styles.lockedSubtitle, { color: tokens.colors.muted }]}>{lockedSubtitle}</Text>
            ) : null}
          </View>
          {locked ? (
            <MaterialCommunityIcons name="lock-outline" size={20} color={tokens.colors.muted} />
          ) : (
            <MaterialCommunityIcons name={isOpen ? "chevron-up" : "chevron-down"} size={22} color={tokens.colors.muted} />
          )}
        </PressScale>
        {isOpen && <View style={styles.accordionContent}>{children}</View>}
      </GlassCardContainer>
    </View>
  );
};

export default function DashboardScreen(): JSX.Element {
  const navigation = useNavigation<Nav>();
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const dashboardScrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Partial<Record<SectionId, number>>>({});
  const [chartChooserVisible, setChartChooserVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportSnapshotDate, setReportSnapshotDate] = useState("");
  const [walletsCount, setWalletsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompted, setPrompted] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>(DEFAULT_SECTION_STATES);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(SECTION_ORDER);
  const [orderLoaded, setOrderLoaded] = useState(false);
  const [reorderVisible, setReorderVisible] = useState(false);
  const reorderScrollRef = useRef<ScrollView>(null);
  const reorderDropY = useRef(new Animated.Value(0)).current;
  const reorderDropOpacity = useRef(new Animated.Value(0)).current;
  const [showPrivacyCard, setShowPrivacyCard] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(true);
  const [kpiDeltaRange, setKpiDeltaRange] = useState<KpiDeltaRange>("28D");
  const [availableRanges, setAvailableRanges] = useState<KpiDeltaRange[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => todayIso().slice(0, 7));
  const [monthSelectorVisible, setMonthSelectorVisible] = useState(false);
  const [dashboardCounts, setDashboardCounts] = useState({
    snapshots: 0,
    incomeEntries: 0,
    expenseEntries: 0,
  });
  const [sectionAvailability, setSectionAvailability] = useState<Record<SectionId, boolean>>({
    andamento: true,
    distribuzione: true,
    cashflow: true,
    categories: true,
    prossimi: true,
  });
  const [orderedSections, setOrderedSections] = useState<SectionId[]>(SECTION_ORDER);
  const [lockedModal, setLockedModal] = useState<{
    visible: boolean;
    sectionId: SectionId | null;
    message: string;
  }>({ visible: false, sectionId: null, message: "" });
  const { t, i18n } = useTranslation();
  const { showInvestments, trackPension, scrollBounceEnabled, showGreeting } = useSettings();
  const currentMonthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = year && month ? new Date(year, month - 1, 1) : new Date();
    const formatted = date.toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
    return formatted.charAt(0).toLocaleUpperCase(i18n.language) + formatted.slice(1);
  }, [i18n.language, selectedMonth]);
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
      return { value, label: label.charAt(0).toLocaleUpperCase(i18n.language) + label.slice(1) };
    });
  }, [i18n.language]);
  const kpiRangeOptions = useMemo(() => {
    const labels: Record<KpiDeltaRange, string> = {
      "7D": t("dashboard.range.options.lastWeek"),
      "1M": t("dashboard.range.options.lastMonth"),
      "28D": t("dashboard.range.options.last28Days"),
      "3M": t("dashboard.range.options.last3Months"),
      "6M": t("dashboard.range.options.last6Months"),
      "12M": t("dashboard.range.options.last12Months"),
    };
    return availableRanges.map((value) => ({ value, label: labels[value] }));
  }, [availableRanges, t]);
  const dashboardGreeting = useMemo(() => {
    const key = new Date().getHours() < 18 ? "dashboard.greetingMorning" : "dashboard.greetingEvening";
    return profileName
      ? t(key, { name: profileName, defaultValue: `Buongiorno, ${profileName}` })
      : t("dashboard.greeting", { defaultValue: "Buongiorno" });
  }, [profileName, t]);

  const normalizeSectionOrder = useCallback((value?: unknown): SectionId[] => {
    const base = Array.isArray(value)
      ? (value.filter((id) => SECTION_ORDER.includes(id as SectionId)) as SectionId[])
      : [];
    const unique = base.filter((id, index) => base.indexOf(id) === index);
    SECTION_ORDER.forEach((id) => {
      if (!unique.includes(id)) unique.push(id);
    });
    return unique;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const allWallets = await listWallets(true);
      const wallets = allWallets.filter((wallet) => {
        if (!showInvestments && wallet.type === "INVEST") return false;
        if (!trackPension && wallet.investmentKind === "PENSION") return false;
        return true;
      });
      const visibleWalletIds = new Set(wallets.map((wallet) => wallet.id));
      setWalletsCount(wallets.length);

      const [snapshots, incomeEntries, expenseEntries, expenseCategories, pref, profile, privacyPref, setupPref] = await Promise.all([
        listSnapshots(),
        listIncomeEntries(),
        listExpenseEntries(),
        listExpenseCategories(),
        getPreference("chart_points"),
        getPreference("profile_name"),
        getPreference("privacy_tooltip_dismissed"),
        getPreference("dashboard.setup.dismissed"),
      ]);

      const snapshotLines: Record<number, SnapshotLineDetail[]> = {};
      await Promise.all(
        snapshots.map(async (snapshot) => {
          snapshotLines[snapshot.id] = (await listSnapshotLines(snapshot.id))
            .filter((line) => visibleWalletIds.has(line.wallet_id));
        })
      );

      const monthEnd = `${selectedMonth}-31`;
      const eligibleSnapshots = snapshots.filter((snapshot) => snapshot.date <= monthEnd);
      const selectedSnapshot = eligibleSnapshots[0] ?? null;
      const latestSnapshot = snapshots[0] ?? null;
      const latestLines: SnapshotLineDetail[] = selectedSnapshot ? snapshotLines[selectedSnapshot.id] ?? [] : [];
      setReportSnapshotDate(selectedSnapshot?.date ?? "");

      const chartPointsRaw = pref ? Number(pref.value) : 6;
      const chartPoints = Number.isFinite(chartPointsRaw) ? Math.min(12, Math.max(3, chartPointsRaw)) : 6;
      setDashboardCounts({
        snapshots: snapshots.length,
        incomeEntries: incomeEntries.length,
        expenseEntries: expenseEntries.length,
      });
      const data = buildDashboardData(
        {
          latestLines,
          snapshots: eligibleSnapshots,
          snapshotLines,
          incomeEntries,
          expenseEntries,
          expenseCategories,
          chartPoints,
          wallets,
          referenceMonth: selectedMonth,
        },
        showInvestments,
        kpiDeltaRange
      );
      setDashboard(data);
      const rangeCandidates: KpiDeltaRange[] = ["7D", "28D", "1M", "3M", "6M", "12M"];
      const rangesWithData = rangeCandidates.filter((range) => {
        const result = buildKpiDeltaForRange(range, eligibleSnapshots, data.portfolioSeries, snapshotLines);
        return result.status === "OK";
      });
      setAvailableRanges(rangesWithData);
      if (rangesWithData.length > 0 && !rangesWithData.includes(kpiDeltaRange)) {
        setKpiDeltaRange(rangesWithData[0]);
      }
      const hasRecurring =
        incomeEntries.some((entry) => entry.recurrence_frequency && entry.one_shot === 0) ||
        expenseEntries.some((entry) => entry.recurrence_frequency && entry.one_shot === 0);
      const hasCashflowData = data.cashflow.months.some((month) => month.income !== 0 || month.expense !== 0);
      setSectionAvailability({
        andamento: snapshots.length >= 2,
        distribuzione: data.distributions.length > 0,
        cashflow: hasRecurring || hasCashflowData,
        categories: data.categories.length > 0,
        prossimi: data.recurrences.length > 0,
      });

      const ask = await getPreference("ask_snapshot_on_start");
      setProfileName(profile?.value?.trim() ?? "");
      setShowPrivacyCard(privacyPref?.value !== "true");
      setSetupDismissed(setupPref?.value === "true");
      if (!prompted && ask?.value === "true") {
        const today = todayIso();
        if (!latestSnapshot || latestSnapshot.date !== today) {
          setPrompted(true);
          navigation.navigate("Snapshot", { openNew: true });
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il caricamento.");
      setDashboard(createMockDashboardData(showInvestments));
      setAvailableRanges([]);
    }
  }, [kpiDeltaRange, navigation, prompted, selectedMonth, showInvestments, trackPension]);

  useEffect(() => {
    let canceled = false;
    getPreference(SECTION_STATE_KEY).then((pref) => {
      if (canceled) return;
      if (pref?.value) {
        try {
          const parsed = JSON.parse(pref.value);
          if (parsed && typeof parsed === "object") {
            setSectionStates((prev) => ({
              ...prev,
              ...parsed,
            }));
          }
        } catch {
          // ignore invalid value
        }
      }
      setSectionsLoaded(true);
    });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    getPreference(SECTION_ORDER_KEY).then((pref) => {
      if (canceled) return;
      if (pref?.value) {
        try {
          const parsed = JSON.parse(pref.value);
          setSectionOrder(normalizeSectionOrder(parsed));
        } catch {
          // ignore invalid value
        }
      }
      setOrderLoaded(true);
    });
    return () => {
      canceled = true;
    };
  }, [normalizeSectionOrder]);

  useEffect(() => {
    if (!sectionsLoaded) return;
    setPreference(SECTION_STATE_KEY, JSON.stringify(sectionStates)).catch(() => {});
  }, [sectionStates, sectionsLoaded]);

  useEffect(() => {
    if (!orderLoaded) return;
    setPreference(SECTION_ORDER_KEY, JSON.stringify(sectionOrder)).catch(() => {});
  }, [orderLoaded, sectionOrder]);

  const handleToggleSection = useCallback((key: string) => {
    setSectionStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load])
  );

  useEffect(() => {
    const subscription = onDataReset(() => {
      void load();
    });
    return () => subscription.remove();
  }, [load]);

  useEffect(() => {
    const subscription = onDataChanged(() => {
      void load();
    });
    return () => subscription.remove();
  }, [load]);

  const dismissPrivacyCard = useCallback(() => {
    setShowPrivacyCard(false);
    setPreference("privacy_tooltip_dismissed", "true").catch(() => {});
  }, []);

  const handlePrivacyLearnMore = useCallback(() => {
    const url = "https://github.com/ozzirr/balance-app-v1";
    Linking.openURL(url).catch(() => {
      Alert.alert(t("dashboard.privacy.title"), t("dashboard.privacy.body"), [
        { text: t("common.close") },
      ]);
    });
  }, [t]);

  const emptyState = walletsCount === 0 && !loading;
  const isFirstRunDashboard =
    !loading &&
    dashboardCounts.snapshots === 0 &&
    dashboardCounts.incomeEntries === 0 &&
    dashboardCounts.expenseEntries === 0;
  useEffect(() => {
    if (loading || !dashboard) return;
    const baseOrder = normalizeSectionOrder(sectionOrder);
    const available = baseOrder.filter((key) => sectionAvailability[key]);
    const locked = baseOrder.filter((key) => !sectionAvailability[key]);
    setOrderedSections([...available, ...locked]);
  }, [dashboard, loading, normalizeSectionOrder, sectionAvailability, sectionOrder]);

  const openReorderSheet = useCallback(() => {
    setReorderVisible(true);
  }, []);

  const closeReorderSheet = useCallback(() => {
    reorderScrollRef.current?.setNativeProps({ scrollEnabled: true });
    setReorderVisible(false);
  }, []);

  const moveSection = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSectionOrder((prev) => {
        const next = normalizeSectionOrder(prev);
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= next.length) {
          return next;
        }
        const [item] = next.splice(fromIndex, 1);
        if (!item) return next;
        next.splice(toIndex, 0, item);
        return next;
      });
    },
    [normalizeSectionOrder]
  );

  const sectionLabels: Record<SectionId, string> = useMemo(
    () => ({
      andamento: t("dashboard.section.trend"),
      distribuzione: t("dashboard.section.distribution"),
      cashflow: t("dashboard.section.cashflow"),
      categories: t("dashboard.section.categories"),
      prossimi: t("dashboard.section.recurrences"),
    }),
    [t]
  );

  const canReorderSections = sectionOrder.length > 1;

  const ReorderableSectionRow = ({ sectionId, index }: { sectionId: SectionId; index: number }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const startIndexRef = useRef(index);
    const sectionList = normalizeSectionOrder(sectionOrder);
    const listLength = sectionList.length;
    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onStartShouldSetPanResponderCapture: () => true,
          onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
          onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 2,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            reorderScrollRef.current?.setNativeProps({ scrollEnabled: false });
            startIndexRef.current = index;
            reorderDropOpacity.setValue(0);
            translateY.setOffset(0);
            translateY.setValue(0);
          },
          onPanResponderMove: (_, gesture) => {
            const minY = -startIndexRef.current * REORDER_ROW_HEIGHT;
            const maxY = (listLength - startIndexRef.current - 1) * REORDER_ROW_HEIGHT;
            const clampedY = Math.max(minY, Math.min(maxY, gesture.dy));
            const nextIndex = Math.max(
              0,
              Math.min(listLength - 1, startIndexRef.current + Math.round(clampedY / REORDER_ROW_HEIGHT))
            );
            translateY.setValue(clampedY);
            const dropSlot = nextIndex > startIndexRef.current ? nextIndex + 1 : nextIndex;
            reorderDropY.setValue(dropSlot * REORDER_ROW_HEIGHT);
            reorderDropOpacity.setValue(nextIndex === startIndexRef.current ? 0 : 1);
          },
          onPanResponderRelease: (_, gesture) => {
            reorderScrollRef.current?.setNativeProps({ scrollEnabled: true });
            const nextIndex = Math.max(
              0,
              Math.min(listLength - 1, startIndexRef.current + Math.round(gesture.dy / REORDER_ROW_HEIGHT))
            );
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 24,
              bounciness: 4,
            }).start();
            reorderDropOpacity.setValue(0);
            moveSection(startIndexRef.current, nextIndex);
          },
          onPanResponderTerminate: () => {
            reorderScrollRef.current?.setNativeProps({ scrollEnabled: true });
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 24,
              bounciness: 4,
            }).start();
            reorderDropOpacity.setValue(0);
          },
        }),
      [index, listLength, moveSection, reorderDropOpacity, reorderDropY, sectionId, translateY]
    );

    return (
      <Animated.View
        style={[
          styles.reorderRow,
          {
            borderColor: tokens.colors.glassBorder,
            backgroundColor: tokens.colors.glassBg,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.reorderRowContent}>
          <Text style={[styles.reorderRowLabel, { color: tokens.colors.text }]} numberOfLines={1}>
            {sectionLabels[sectionId]}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.reorder.moveUp", { name: sectionLabels[sectionId], defaultValue: "Sposta {{name}} in alto" })} accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => moveSection(index, index - 1)} style={styles.reorderArrow}>
          <MaterialCommunityIcons name="chevron-up" size={24} color={index === 0 ? tokens.colors.muted : tokens.colors.accent} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.reorder.moveDown", { name: sectionLabels[sectionId], defaultValue: "Sposta {{name}} in basso" })} accessibilityState={{ disabled: index === listLength - 1 }} disabled={index === listLength - 1} onPress={() => moveSection(index, index + 1)} style={styles.reorderArrow}>
          <MaterialCommunityIcons name="chevron-down" size={24} color={index === listLength - 1 ? tokens.colors.muted : tokens.colors.accent} />
        </Pressable>
        <View
          {...panResponder.panHandlers}
          style={[
            styles.reorderAction,
            { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
          ]}
        >
          <MaterialCommunityIcons name="drag-vertical" size={22} color={tokens.colors.accent} />
        </View>
      </Animated.View>
    );
  };

  const handleLockedPress = useCallback((sectionId: SectionId, message: string) => {
    setLockedModal({ visible: true, sectionId, message });
  }, []);

  const closeLockedModal = useCallback(() => {
    setLockedModal((prev) => ({ ...prev, visible: false }));
  }, []);

  const lockedCta = useMemo(() => {
    if (!lockedModal.sectionId) {
      return {
        label: t("common.close", { defaultValue: "Chiudi" }),
        onPress: closeLockedModal,
      };
    }
    if (lockedModal.sectionId === "andamento" || lockedModal.sectionId === "distribuzione") {
      return {
        label: t("dashboard.locked.ctaSnapshot", { defaultValue: "Aggiungi snapshot" }),
        onPress: () => {
          closeLockedModal();
          navigation.navigate("Snapshot", { openNew: true });
        },
      };
    }
    if (lockedModal.sectionId === "categories") {
      return {
        label: t("dashboard.locked.ctaBalance", { defaultValue: "Vai a Cashflow" }),
        onPress: () => {
          closeLockedModal();
          navigation.navigate("Balance", { entryType: "expense" });
        },
      };
    }
    return {
      label: t("dashboard.locked.ctaBalance", { defaultValue: "Vai a Cashflow" }),
      onPress: () => {
        closeLockedModal();
        navigation.navigate("Balance");
      },
    };
  }, [closeLockedModal, lockedModal.sectionId, navigation, t]);

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

  const setupSteps = [
    { id: "wallet", title: t("dashboard.setup.wallet.title"), description: t("dashboard.setup.wallet.description"), done: walletsCount > 0, onPress: () => navigation.navigate("Wallet", { tutorialRequest: Date.now() }) },
    { id: "snapshot", title: t("dashboard.setup.snapshot.title"), description: t("dashboard.setup.snapshot.description"), done: dashboardCounts.snapshots > 0, onPress: () => walletsCount > 0 ? navigation.navigate("Snapshot", { tutorialRequest: Date.now() }) : navigation.navigate("Wallet", { tutorialRequest: Date.now() }) },
    { id: "cashflow", title: t("dashboard.setup.cashflow.title"), description: t("dashboard.setup.cashflow.description"), done: dashboardCounts.incomeEntries + dashboardCounts.expenseEntries > 0, onPress: () => walletsCount > 0 ? navigation.navigate("Balance", { entryType: "income", formMode: "create", entryId: undefined, navigationKey: Date.now(), tutorialRequest: Date.now() }) : navigation.navigate("Wallet", { tutorialRequest: Date.now() }) },
  ];
  const completedSetupSteps = setupSteps.filter((step) => step.done).length;
  const showSetup = !loading && !setupDismissed && completedSetupSteps < setupSteps.length;

  return (
    <View style={styles.screenRoot}>
      <AppBackground>
        <ScrollView
          ref={dashboardScrollRef}
          bounces={scrollBounceEnabled}
          alwaysBounceVertical={scrollBounceEnabled}
          overScrollMode={scrollBounceEnabled ? "always" : "never"}
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + 14,
              paddingBottom: 160 + insets.bottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loading && !dashboard && skeleton}

          {error && !loading ? (
            <PremiumCard>
              <Text style={[styles.errorTitle, { color: tokens.colors.text }]}>{t("dashboard.errorTitle")}</Text>
              <Text style={[styles.errorBody, { color: tokens.colors.muted }]}>{error}</Text>
            </PremiumCard>
          ) : null}

          {emptyState && !isFirstRunDashboard ? (
            <CoachTipCard
              lines={[t("dashboard.emptyBody")]}
              ctaLabel={t("dashboard.emptyCta", { defaultValue: "Configura Balance" })}
              onPress={() => navigation.navigate("Wallet", { startSetup: true })}
              ctaColor={tokens.colors.accent}
            />
          ) : null}

          {dashboard ? (
            <>
              <View style={styles.greetingBlock}>
                <View style={styles.dashboardHeader}>
                  <AppHeader
                    embedded
                    routeName="Dashboard"
                    onOpenDashboard={() => undefined}
                    onOpenNews={() => navigation.navigate("News")}
                    onOpenSettings={() => navigation.navigate("Impostazioni")}
                  />
                  {showGreeting ? (
                    <Text style={[styles.dashboardWelcome, { color: tokens.colors.muted }]}>{dashboardGreeting}</Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("dashboard.monthSelector.open", { defaultValue: "Cambia mese" })}
                    accessibilityState={{ expanded: monthSelectorVisible }}
                    onPress={() => setMonthSelectorVisible(true)}
                    style={({ pressed }) => [styles.monthRow, pressed ? styles.monthRowPressed : null]}
                  >
                    <Text style={[styles.dashboardMonth, { color: tokens.colors.text }]}>{currentMonthLabel}</Text>
                    <MaterialCommunityIcons name="chevron-down" size={24} color={tokens.colors.accent} />
                  </Pressable>
                </View>
                {showSetup ? <View style={[styles.setupCard, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg }]}>
                  <View style={styles.setupHeader}><View style={styles.setupHeaderText}><Text style={[styles.setupEyebrow, { color: tokens.colors.accent }]}>{t("dashboard.setup.eyebrow")}</Text><Text style={[styles.setupTitle, { color: tokens.colors.text }]}>{t("dashboard.setup.title")}</Text><Text style={[styles.setupSubtitle, { color: tokens.colors.muted }]}>{t("dashboard.setup.progress", { count: completedSetupSteps, total: setupSteps.length })}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.setup.dismiss")} onPress={() => { setSetupDismissed(true); void setPreference("dashboard.setup.dismissed", "true").catch(() => {}); }} hitSlop={10}><MaterialCommunityIcons name="close" size={22} color={tokens.colors.muted} /></Pressable></View>
                  <View style={[styles.setupTrack, { backgroundColor: tokens.colors.surface2 }]}><View style={{ width: `${(completedSetupSteps / setupSteps.length) * 100}%`, height: "100%", backgroundColor: tokens.colors.accent, borderRadius: 9 }} /></View>
                  {setupSteps.map((step, index) => <Pressable key={step.id} accessibilityRole="button" accessibilityLabel={`${step.title}, ${step.done ? t("dashboard.setup.done") : t("dashboard.setup.pending")}`} onPress={step.onPress} style={[styles.setupStep, { borderColor: tokens.colors.glassBorder }]}>
                    <View style={[styles.setupNumber, { backgroundColor: step.done ? `${tokens.colors.green}22` : `${tokens.colors.accent}20` }]}>{step.done ? <MaterialCommunityIcons name="check" size={20} color={tokens.colors.green} /> : <Text style={{ color: tokens.colors.accent, fontWeight: "800" }}>{index + 1}</Text>}</View>
                    <View style={styles.setupStepText}><Text style={[styles.setupStepTitle, { color: tokens.colors.text }]}>{step.title}</Text><Text style={[styles.setupStepDescription, { color: tokens.colors.muted }]}>{step.description}</Text></View><MaterialCommunityIcons name="chevron-right" size={21} color={tokens.colors.muted} />
                  </Pressable>)}
                </View> : null}
                {!isFirstRunDashboard ? (
                  <View style={styles.summaryBlock}>
                    <PortfolioSummaryCard
                      items={dashboard.kpis}
                      series={dashboard.portfolioSeries}
                      selectedRange={kpiDeltaRange}
                      rangeOptions={kpiRangeOptions}
                      onChangeRange={setKpiDeltaRange}
                    />
                    <PortfolioCompositionCard
                      items={dashboard.kpis.filter((item) => item.id !== "netWorth")}
                      onPress={() => {
                        setSectionStates((prev) => ({ ...prev, distribuzione: true }));
                        requestAnimationFrame(() => dashboardScrollRef.current?.scrollTo({ y: Math.max(0, (sectionPositions.current.distribuzione ?? 0) - insets.top - 12), animated: true }));
                      }}
                    />
                    {dashboard.cashflow.months.length > 0 ? <MonthlyPulse month={dashboard.cashflow.months[dashboard.cashflow.months.length - 1]} onOpenCashflow={(entryType) => navigation.navigate("Balance", { formMode: "create", entryId: undefined, ...(entryType ? { entryType, navigationKey: Date.now() } : {}) })} /> : null}
                    {(dashboard.categories.length > 0 || dashboard.recurrences.length > 0) ? (
                      <View style={[styles.insightsCard, { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder }]}>
                        <View style={styles.insightsHeader}><Text style={[styles.insightsTitle, { color: tokens.colors.text }]}>{t("dashboard.insights.title", { defaultValue: "In evidenza" })}</Text><MaterialCommunityIcons name="auto-fix" size={19} color={tokens.colors.accent} /></View>
                        {dashboard.categories[0] ? <Pressable accessibilityRole="button" style={styles.insightRow} onPress={() => navigation.navigate("Balance", { entryType: "expense", formMode: "create", entryId: undefined, tutorialRequest: undefined, navigationKey: Date.now(), categoryFilterRequest: { categoryId: dashboard.categories[0].categoryId, month: selectedMonth, key: Date.now() } })}>
                          <View style={[styles.insightIcon, { backgroundColor: `${dashboard.categories[0].color}25` }]}><MaterialCommunityIcons name="chart-pie" size={19} color={dashboard.categories[0].color} /></View>
                          <View style={styles.insightText}><Text style={[styles.insightLabel, { color: tokens.colors.muted }]}>{t("dashboard.insights.topCategory", { defaultValue: "Categoria principale del mese" })}</Text><Text numberOfLines={1} style={[styles.insightValue, { color: tokens.colors.text }]}>{dashboard.categories[0].label} · {formatPct(dashboard.categories[0].pct)}</Text></View>
                          <Text style={[styles.insightAmount, { color: tokens.colors.text }]}>{formatEUR(dashboard.categories[0].value)}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={tokens.colors.muted} />
                        </Pressable> : null}
                        {dashboard.recurrences[0] ? <Pressable accessibilityRole="button" style={[styles.insightRow, dashboard.categories.length ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.glassBorder, paddingTop: 12 } : null]} onPress={() => navigation.navigate("Balance", { entryType: dashboard.recurrences[0].type, formMode: "edit", entryId: dashboard.recurrences[0].entryId, navigationKey: Date.now() })}>
                          <View style={[styles.insightIcon, { backgroundColor: `${tokens.colors.accent}1C` }]}><MaterialCommunityIcons name="calendar-clock-outline" size={19} color={tokens.colors.accent} /></View>
                          <View style={styles.insightText}><Text style={[styles.insightLabel, { color: tokens.colors.muted }]}>{t("dashboard.insights.next", { defaultValue: "Prossimo movimento" })} · {formatShortDate(dashboard.recurrences[0].date)}</Text><Text numberOfLines={1} style={[styles.insightValue, { color: tokens.colors.text }]}>{dashboard.recurrences[0].description}</Text></View>
                          <Text style={[styles.insightAmount, { color: dashboard.recurrences[0].type === "income" ? tokens.colors.green : tokens.colors.expense }]}>{dashboard.recurrences[0].type === "income" ? "+" : "−"}{formatEUR(dashboard.recurrences[0].amount)}</Text><MaterialCommunityIcons name="chevron-right" size={20} color={tokens.colors.muted} />
                        </Pressable> : null}
                      </View>
                    ) : null}
                    {reportSnapshotDate ? (
                      <Pressable accessibilityRole="button" onPress={() => setReportVisible(true)} style={[styles.reportButton, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg }]}>
                        <View style={styles.reportIcon}><MaterialCommunityIcons name="creation" size={21} color="#C6A4FF" /></View>
                        <View style={{ flex: 1 }}><Text style={[styles.reportTitle, { color: tokens.colors.text }]}>{t("dashboard.report.action")}</Text><Text style={[styles.reportSubtitle, { color: tokens.colors.muted }]}>{t("dashboard.report.actionSubtitle")}</Text></View>
                        <MaterialCommunityIcons name="arrow-right" size={21} color={tokens.colors.accent} />
                      </Pressable>
                    ) : null}
                    <BalanceReport visible={reportVisible} onClose={() => setReportVisible(false)} data={dashboard} snapshotDate={reportSnapshotDate} />
                  </View>
                ) : null}
              </View>
              {showPrivacyCard && (
                <CoachTipCard
                leadingIcon={<MaterialCommunityIcons name="shield-lock-outline" size={20} color={tokens.colors.accent} />}
                title={t("dashboard.privacy.title")}
                lines={[t("dashboard.privacy.body")]}
                lineNumberOfLines={2}
                actions={
                  <View style={styles.privacyActions}>
                    <PressScale onPress={handlePrivacyLearnMore} style={styles.privacyLink}>
                      <Text style={[styles.privacyLinkText, { color: tokens.colors.accent }]}>
                        {t("dashboard.privacy.learnMore")}
                      </Text>
                    </PressScale>
                    <PressScale onPress={dismissPrivacyCard}>
                      <Text style={[styles.privacyDismiss, { color: tokens.colors.text }]}>
                        {t("dashboard.privacy.dismiss")}
                      </Text>
                    </PressScale>
                  </View>
                }
                />
              )}

              {!isFirstRunDashboard ? <View style={styles.analysisHeading}><View><Text style={[styles.analysisEyebrow, { color: tokens.colors.accent }]}>{t("dashboard.analysis.eyebrow", { defaultValue: "LA TUA PANORAMICA" })}</Text><Text style={[styles.analysisTitle, { color: tokens.colors.text }]}>{t("dashboard.analysis.title", { defaultValue: "Analisi e grafici" })}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.chartChooser.title")} onPress={() => setChartChooserVisible(true)} style={[styles.analysisButton, { backgroundColor: `${tokens.colors.accent}1C` }]}><MaterialCommunityIcons name="chart-box-outline" size={20} color={tokens.colors.accent} /></Pressable></View> : null}
              {!isFirstRunDashboard &&
                orderedSections.map((sectionId) => {
                const isAvailable = sectionAvailability[sectionId];
                if (sectionId === "andamento") {
                  return (
                  <View key={sectionId} onLayout={(event) => { sectionPositions.current[sectionId] = event.nativeEvent.layout.y; }}><SectionAccordion
                    title={t("dashboard.section.trend")}
                    icon="chart-line"
                    open={sectionStates.andamento}
                    onToggle={() => handleToggleSection("andamento")}
                    locked={!isAvailable}
                    onLockedPress={() =>
                      handleLockedPress(
                        "andamento",
                        t("dashboard.locked.trend", {
                          defaultValue:
                            "Aggiungi almeno 2 snapshot in date diverse per vedere l’andamento nel tempo.",
                        })
                      )
                    }
                  >
                    <PortfolioLineChartCard
                      data={dashboard.portfolioSeries}
                      walletSeries={dashboard.walletSeries}
                      hideHeader
                      noCard
                      modes={showInvestments
                        ? trackPension && dashboard.kpis.some((item) => item.id === "pension")
                          ? ["total", "liquidity", "investments", "pension"]
                          : undefined
                        : ["total"]}
                    />
                  </SectionAccordion></View>
                );
              }
              if (sectionId === "distribuzione") {
                return (
                  <View key={sectionId} onLayout={(event) => { sectionPositions.current[sectionId] = event.nativeEvent.layout.y; }}><SectionAccordion
                    title={t("dashboard.section.distribution")}
                    icon="chart-donut"
                    open={sectionStates.distribuzione}
                    onToggle={() => handleToggleSection("distribuzione")}
                    locked={!isAvailable}
                    onLockedPress={() =>
                      handleLockedPress(
                        "distribuzione",
                        t("dashboard.locked.distribution", {
                          defaultValue:
                            "Aggiungi il tuo primo snapshot per vedere la distribuzione del patrimonio.",
                        })
                      )
                    }
                  >
                    <DonutDistributionCard items={dashboard.distributions} hideHeader noCard />
                  </SectionAccordion></View>
                );
              }
              if (sectionId === "cashflow") {
                return (
                  <View key={sectionId} onLayout={(event) => { sectionPositions.current[sectionId] = event.nativeEvent.layout.y; }}><SectionAccordion
                    title={t("dashboard.section.cashflow")}
                    icon="chart-bar"
                    open={sectionStates.cashflow}
                    onToggle={() => handleToggleSection("cashflow")}
                    locked={!isAvailable}
                    onLockedPress={() =>
                      handleLockedPress(
                        "cashflow",
                        t("dashboard.locked.cashflow", {
                          defaultValue:
                            "Inserisci entrate e/o uscite ricorrenti per attivare il Cash Flow.",
                        })
                      )
                    }
                  >
                    <CashflowOverviewCard cashflow={dashboard.cashflow} hideHeader noCard />
                  </SectionAccordion></View>
                );
              }
              if (sectionId === "categories") {
                return (
                  <View key={sectionId} onLayout={(event) => { sectionPositions.current[sectionId] = event.nativeEvent.layout.y; }}><SectionAccordion
                    title={t("dashboard.section.categories")}
                    icon="shape-outline"
                    open={sectionStates.categories}
                    onToggle={() => handleToggleSection("categories")}
                    locked={!isAvailable}
                    onLockedPress={() =>
                      handleLockedPress(
                        "categories",
                        t("dashboard.locked.categories", {
                          defaultValue:
                            "Aggiungi almeno una spesa per vedere il grafico per categoria.",
                        })
                      )
                    }
                  >
                    <CategoriesBreakdownCard items={dashboard.categories} hideHeader noCard />
                  </SectionAccordion></View>
                );
              }
              return (
                <SectionAccordion
                  key={sectionId}
                  title={t("dashboard.section.recurrences")}
                  icon="calendar-clock-outline"
                  open={sectionStates.prossimi}
                  onToggle={() => handleToggleSection("prossimi")}
                  locked={!isAvailable}
                  onLockedPress={() =>
                    handleLockedPress(
                      "prossimi",
                      t("dashboard.locked.recurrences", {
                        defaultValue:
                          "Aggiungi entrate o uscite ricorrenti per vedere i prossimi movimenti.",
                      })
                    )
                  }
                >
                  <RecurrencesTableCard
                    rows={dashboard.recurrences}
                    hideHeader
                    noCard
                    onPressRow={(row) =>
                      navigation.navigate("Balance", {
                        entryType: row.type,
                        formMode: "edit",
                        entryId: row.entryId,
                      })
                    }
                  />
                </SectionAccordion>
              );
              })}
              {!isFirstRunDashboard && canReorderSections && (
                <View style={styles.orderToggleRow}>
                  <PressScale onPress={openReorderSheet} style={styles.orderToggleLink}>
                    <Text style={[styles.orderToggleText, { color: tokens.colors.accent }]}>
                      {t("dashboard.reorder.edit", { defaultValue: "Modifica ordine" })}
                    </Text>
                  </PressScale>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
        <BottomSheet
          visible={monthSelectorVisible}
          title={t("dashboard.monthSelector.title", { defaultValue: "Scegli il mese" })}
          subtitle={t("dashboard.monthSelector.subtitle", { defaultValue: "Aggiorna patrimonio, cashflow e insight della dashboard." })}
          onClose={() => setMonthSelectorVisible(false)}
        >
          {monthOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === selectedMonth }}
              onPress={() => {
                setMonthSelectorVisible(false);
                setSelectedMonth(option.value);
              }}
              style={styles.monthOption}
            >
              <Text style={[styles.monthOptionText, { color: tokens.colors.text }]}>{option.label}</Text>
              {option.value === selectedMonth ? <MaterialCommunityIcons name="check" size={21} color={tokens.colors.accent} /> : null}
            </Pressable>
          ))}
        </BottomSheet>
        <BottomSheet
          visible={reorderVisible && canReorderSections}
          title={t("dashboard.reorder.title", { defaultValue: "Modifica ordine" })}
          subtitle={t("dashboard.reorder.hintControls", { defaultValue: "Trascina la maniglia oppure usa le frecce per cambiare ordine." })}
          onClose={closeReorderSheet}
          actionLabel={t("dashboard.reorder.done", { defaultValue: "Fatto" })}
          onAction={closeReorderSheet}
          scrollable={false}
        >
          <ScrollView
            ref={reorderScrollRef}
            style={styles.reorderScroll}
            contentContainerStyle={styles.reorderList}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.reorderDropIndicator,
                {
                  backgroundColor: tokens.colors.accent,
                  opacity: reorderDropOpacity,
                  transform: [{ translateY: reorderDropY }],
                },
              ]}
            />
            {normalizeSectionOrder(sectionOrder).map((sectionId, index) => (
              <ReorderableSectionRow key={sectionId} sectionId={sectionId} index={index} />
            ))}
          </ScrollView>
        </BottomSheet>
        <LimitReachedModal
          visible={lockedModal.visible}
          onClose={closeLockedModal}
          onUpgrade={lockedCta.onPress}
          title={t("dashboard.locked.title", { defaultValue: "Mancano alcuni dati" })}
          subtitle={lockedModal.message}
          ctaLabel={lockedCta.label}
          secondaryLabel={t("common.close", { defaultValue: "Chiudi" })}
          benefits={[]}
          iconName="lock-outline"
        />
        <BottomSheet visible={chartChooserVisible} title={t("dashboard.chartChooser.title")} subtitle={t("dashboard.chartChooser.subtitle")} onClose={() => setChartChooserVisible(false)}>
          {(["andamento", "distribuzione", "cashflow", "categories"] as SectionId[]).filter((id) => sectionAvailability[id]).map((id) => (
            <Pressable key={id} accessibilityRole="button" style={[styles.chartChoice, { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder }]} onPress={() => {
              setChartChooserVisible(false);
              setSectionStates((prev) => ({ ...prev, [id]: true }));
              requestAnimationFrame(() => dashboardScrollRef.current?.scrollTo({ y: Math.max(0, (sectionPositions.current[id] ?? 0) - insets.top - 12), animated: true }));
            }}>
              <MaterialCommunityIcons name={id === "andamento" ? "chart-line" : id === "distribuzione" ? "chart-donut" : id === "cashflow" ? "chart-bar" : "chart-pie"} size={22} color={tokens.colors.accent} />
              <Text style={[styles.chartChoiceLabel, { color: tokens.colors.text }]}>{sectionLabels[id]}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={tokens.colors.muted} />
            </Pressable>
          ))}
          {!(["andamento", "distribuzione", "cashflow", "categories"] as SectionId[]).some((id) => sectionAvailability[id]) ? <Text style={{ color: tokens.colors.muted }}>{t("dashboard.chartChooser.empty")}</Text> : null}
        </BottomSheet>
      </AppBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  setupCard: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 12 },
  setupHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  setupHeaderText: { flex: 1, gap: 4 },
  setupEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  setupTitle: { fontSize: 21, fontWeight: "800" },
  setupSubtitle: { fontSize: 12 },
  setupTrack: { height: 5, borderRadius: 9, overflow: "hidden", marginBottom: 3 },
  setupStep: { flexDirection: "row", alignItems: "center", gap: 11, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  setupNumber: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  setupStepText: { flex: 1, minWidth: 0, gap: 3 },
  setupStepTitle: { fontSize: 14, fontWeight: "700" },
  setupStepDescription: { fontSize: 12, lineHeight: 16 },
  container: {
    paddingHorizontal: 16,
    gap: 10,
  },
  screenRoot: {
    flex: 1,
  },
  section: {
    gap: 10,
    marginTop: 3,
  },
  greetingBlock: {
    gap: 10,
  },
  dashboardHeader: { gap: 12, paddingHorizontal: 2, paddingBottom: 6 },
  dashboardWelcome: { fontSize: 16, fontWeight: "500", marginTop: 4 },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  monthRowPressed: { opacity: 0.65 },
  dashboardMonth: { fontSize: 25, fontWeight: "800", letterSpacing: -0.5, textTransform: "capitalize" },
  monthOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  monthOptionText: { fontSize: 15, fontWeight: "600" },
  summaryBlock: {
    gap: 12,
  },
  analysisHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, paddingHorizontal: 2 },
  analysisEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  analysisTitle: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4, marginTop: 3 },
  analysisButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 10 },
  insightsCard: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 12 },
  insightsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  insightsTitle: { fontSize: 16, fontWeight: "800" },
  insightRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  insightIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  insightText: { flex: 1, minWidth: 0, gap: 3 },
  insightLabel: { fontSize: 11 },
  insightValue: { fontSize: 14, fontWeight: "700" },
  insightAmount: { fontSize: 13, fontWeight: "700" },
  reportButton: { borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  reportIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#392953" },
  reportTitle: { fontSize: 14, fontWeight: "700" },
  reportSubtitle: { fontSize: 12, marginTop: 2 },
  chartChoice: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  chartChoiceLabel: { flex: 1, fontSize: 15, fontWeight: "700" },
  onboardingActions: {
    flexDirection: "column",
    gap: 8,
    alignItems: "stretch",
    width: "100%",
  },
  privacyActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  privacyLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  privacyLinkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  privacyDismiss: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderToggleRow: {
    alignItems: "flex-end",
    paddingTop: 4,
    paddingRight: 6,
  },
  orderToggleLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  orderToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  lockedSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  accordionIcon: {
    fontSize: 24,
  },
  cardWrapper: {
    padding: 0,
  },
  accordionContent: {
    marginTop: 8,
    gap: 12,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  greetingText: {
    fontSize: 27,
    fontWeight: "700",
    letterSpacing: -0.4,
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 180,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  reorderScroll: {
    flex: 1,
  },
  reorderList: {
    paddingVertical: 4,
    gap: 10,
    position: "relative",
  },
  reorderDropIndicator: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 0,
    height: 4,
    borderRadius: 999,
    zIndex: 10,
  },
  reorderRow: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    minHeight: 56,
  },
  reorderRowActive: {
    opacity: 0.92,
    zIndex: 5,
  },
  reorderRowContent: {
    flex: 1,
    flexDirection: "column",
  },
  reorderRowLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  reorderAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderArrow: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  errorBody: {
    marginTop: 6,
  },
  lockedCard: {
    opacity: 0.7,
  },
});
