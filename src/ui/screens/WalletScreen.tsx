import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Snackbar, Text, TextInput } from "react-native-paper";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createWallet, deleteWallet, listWallets, updateWallet, updateWalletSortOrders, DEFAULT_WALLET_COLOR } from "@/repositories/walletsRepo";
import type { AssetAvailability, Wallet, Currency, WalletType } from "@/repositories/types";
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/settings/useSettings";
import LimitReachedModal from "@/ui/components/LimitReachedModal";
import ConfirmDialog from "@/ui/components/ConfirmDialog";
import ProWelcomeModal from "@/ui/components/ProWelcomeModal";
import AppBackground from "@/ui/components/AppBackground";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { emitDataChanged, onDataChanged, onDataReset } from "@/app/dataEvents";
import {
  GlassCardContainer,
  PrimaryPillButton,
  PillChip,
  SmallOutlinePillButton,
  SegmentedControlPill,
} from "@/ui/components/EntriesUI";
import { createStandardTextInputProps } from "@/ui/components/standardInputProps";
import { orderWalletsForUI } from "@/domain/walletOrdering";
import { useBalancePro } from "@/features/pro/BalanceProProvider";
import type { BalanceProPlanId } from "@/config/entitlements";
import { openPrivacyPolicyLink, openTermsOfUseLink } from "@/config/storeLinks";
import TutorialSpotlight from "@/ui/components/TutorialSpotlight";
import BottomSheet from "@/ui/components/BottomSheet";
import { inferAssetAvailability } from "@/domain/assetAvailability";
import { isIsoDate } from "@/utils/dates";
import DateTimePicker from "@react-native-community/datetimepicker";

type BalanceProPaywallSource = "wallet-limit" | "settings-upsell";
type WalletTab = "LIQUIDITY" | "INVEST" | "PENSION";

type WalletRouteParams = {
  tutorialRequest?: number;
  walletId?: number;
  startSetup?: boolean;
  paywallSource?: BalanceProPaywallSource;
};

const presetColors = [
  "#9B7BFF",
  "#5C9DFF",
  "#F6C177",
  "#66D19E",
  "#C084FC",
  "#FF8FAB",
  "#6EE7B7",
  "#94A3B8",
  "#F97316",
  "#22D3EE",
];
const REORDER_ROW_HEIGHT = 72;

type WalletDraft = {
  name: string;
  tag: string;
  currency: Currency;
  color: string;
  availability: AssetAvailability;
  availabilityDate: string;
  restrictionNote: string;
};

function AvailabilityEditor({
  value,
  availabilityDate,
  restrictionNote,
  onChange,
}: {
  value: AssetAvailability;
  availabilityDate: string;
  restrictionNote: string;
  onChange: (updates: Partial<Pick<WalletDraft, "availability" | "availabilityDate" | "restrictionNote">>) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const { tokens, isDark } = useDashboardTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const options: AssetAvailability[] = ["liquid", "restricted"];
  const inputProps = createStandardTextInputProps(tokens);
  const pickerDate = availabilityDate && isIsoDate(availabilityDate)
    ? new Date(`${availabilityDate}T12:00:00`)
    : new Date();
  const displayDate = availabilityDate && isIsoDate(availabilityDate)
    ? pickerDate.toLocaleDateString(i18n.language)
    : "";

  useEffect(() => {
    if (value !== "restricted") {
      setShowDatePicker(false);
    }
  }, [value]);

  const toIsoDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return (
    <View style={styles.availabilitySection}>
      <Text style={[styles.availabilityTitle, { color: tokens.colors.text }]}>{t("wallets.availability.title")}</Text>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange({ availability: option })}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === option }}
          style={[
            styles.availabilityOption,
            {
              borderColor: value === option ? tokens.colors.accent : tokens.colors.glassBorder,
              backgroundColor: value === option ? `${tokens.colors.accent}22` : tokens.colors.glassBg,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={value === option ? "radiobox-marked" : "radiobox-blank"}
            size={20}
            color={value === option ? tokens.colors.accent : tokens.colors.muted}
          />
          <View style={styles.availabilityCopy}>
            <Text style={[styles.availabilityLabel, { color: tokens.colors.text }]}>{t(`wallets.availability.${option}.label`)}</Text>
            <Text style={[styles.availabilityDescription, { color: tokens.colors.muted }]}>{t(`wallets.availability.${option}.description`)}</Text>
          </View>
        </Pressable>
      ))}
      {value === "restricted" ? (
        <View style={styles.restrictionFields}>
          <TextInput
            label={t("wallets.availability.date")}
            placeholder={t("wallets.availability.datePlaceholder")}
            value={displayDate}
            editable={false}
            {...inputProps}
            right={<TextInput.Icon icon="calendar" />}
            onPressIn={() => setShowDatePicker((visible) => !visible)}
          />
          {showDatePicker ? (
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              textColor={tokens.colors.text}
              themeVariant={isDark ? "dark" : "light"}
              onChange={(_, selectedDate) => {
                if (selectedDate) {
                  onChange({ availabilityDate: toIsoDate(selectedDate) });
                }
                if (Platform.OS !== "ios") {
                  setShowDatePicker(false);
                }
              }}
            />
          ) : null}
          {availabilityDate ? (
            <SmallOutlinePillButton
              label={t("wallets.availability.clearDate")}
              onPress={() => {
                setShowDatePicker(false);
                onChange({ availabilityDate: "" });
              }}
              color={tokens.colors.muted}
              fullWidth
            />
          ) : null}
          <TextInput
            label={t("wallets.availability.note")}
            value={restrictionNote}
            multiline
            {...inputProps}
            onChangeText={(text) => onChange({ restrictionNote: text })}
          />
        </View>
      ) : null}
    </View>
  );
}

function nextPresetColor(current: string): string {
  const index = presetColors.indexOf(current);
  if (index === -1) return presetColors[0];
  return presetColors[(index + 1) % presetColors.length];
}

function isSeededDefaultWallet(wallet: Wallet): boolean {
  if (wallet.currency !== "EUR" || wallet.active !== 1) {
    return false;
  }

  if (wallet.type === "LIQUIDITY") {
    return wallet.name === "Liquidità" && wallet.tag === "Liquidità";
  }

  if (wallet.type === "INVEST") {
    return wallet.name === "Investimenti" && (!wallet.tag || wallet.tag === "Investimenti");
  }

  return false;
}

function normalizeInvestmentTag(wallet: Wallet, tag: string | null | undefined): string {
  const normalized = tag?.trim() ?? "";
  if (wallet.type === "INVEST" && isSeededDefaultWallet(wallet) && normalized === "Investimenti") {
    return "";
  }
  return normalized;
}

type AccordionItemProps = {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconOverride?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconBackgroundOverride?: string;
  iconColorOverride?: string;
  onIconPress?: () => void;
  expanded: boolean;
  onToggle: () => void;
  color?: string;
  rightAccessory?: React.ReactNode;
  children: React.ReactNode;
};

const AccordionItem = ({
  title,
  subtitle,
  icon,
  iconOverride,
  iconBackgroundOverride,
  iconColorOverride,
  onIconPress,
  expanded,
  onToggle,
  color,
  rightAccessory,
  children,
}: AccordionItemProps) => {
  const { tokens, isDark } = useDashboardTheme();
  const iconName = iconOverride ?? icon;
  const iconBg = iconBackgroundOverride ?? color ?? tokens.colors.glassBg;
  const iconFg = iconColorOverride ?? (isDark ? tokens.colors.bg : "#FFFFFF");
  return (
    <GlassCardContainer contentStyle={{ gap: 12, padding: 12 }}>
      <PressScale onPress={onToggle} style={[styles.walletRow, { paddingVertical: 6 }]}>
        <View style={styles.walletRowContent}>
          <Pressable
            onPress={onIconPress}
            hitSlop={6}
            disabled={!onIconPress}
            style={[
              styles.walletIconBadge,
              {
                borderColor: tokens.colors.glassBorder,
                backgroundColor: iconBg,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={iconName}
              size={18}
              color={iconFg}
            />
          </Pressable>
          <View style={styles.walletText}>
            <Text style={[styles.walletTitle, { color: tokens.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.walletSubtitle, { color: tokens.colors.muted }]} numberOfLines={1} ellipsizeMode="tail">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.walletRowActions}>
          {rightAccessory}
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color={tokens.colors.muted}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </View>
      </PressScale>
      {expanded ? (
        <View
          style={[
            styles.accordionBody,
            { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder },
          ]}
        >
          {children}
        </View>
      ) : null}
    </GlassCardContainer>
  );
};

export default function WalletScreen(): React.ReactElement {
  const { tokens, isDark } = useDashboardTheme();
  const deleteIconColor = isDark ? tokens.colors.bg : tokens.colors.surface;
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const routeParams = route.params as WalletRouteParams | undefined;
  const targetWalletId = routeParams?.walletId;
  const startSetup = routeParams?.startSetup;
  const requestedPaywallSource = routeParams?.paywallSource;
  const insets = useSafeAreaInsets();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoaded, setWalletsLoaded] = useState(false);
  const { t } = useTranslation();
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderLists, setReorderLists] = useState<Record<WalletTab, Wallet[]>>({
    LIQUIDITY: [],
    INVEST: [],
    PENSION: [],
  });
  const reorderDropY = useRef(new Animated.Value(0)).current;
  const reorderDropOpacity = useRef(new Animated.Value(0)).current;
  const { showInvestments, showInvestmentAvailability, trackPension, scrollBounceEnabled } = useSettings();
  const [walletEdits, setWalletEdits] = useState<Record<number, WalletDraft>>({});
  const walletEditsRef = useRef<Record<number, WalletDraft>>({});
  const walletSaveQueues = useRef<Record<number, Promise<void>>>({});
  const pendingWalletSaves = useRef<Record<number, number>>({});
  const [availabilityFilter, setAvailabilityFilter] = useState<AssetAvailability | "all">("all");
  const [tab, setTab] = useState<WalletTab>("LIQUIDITY");
  const [newWalletDraft, setNewWalletDraft] = useState<WalletDraft>({
    name: "",
    tag: "",
    currency: "EUR",
    color: DEFAULT_WALLET_COLOR,
    availability: "liquid",
    availabilityDate: "",
    restrictionNote: "",
  });
  const [showAddWallet, setShowAddWallet] = useState<Record<WalletTab, boolean>>({
    LIQUIDITY: false,
    INVEST: false,
    PENSION: false,
  });
  const [expandedWalletId, setExpandedWalletId] = useState<number | null>(null);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [confirmWalletId, setConfirmWalletId] = useState<number | null>(null);
  const [confirmWalletLoading, setConfirmWalletLoading] = useState(false);
  const [confirmWalletError, setConfirmWalletError] = useState<string | null>(null);
  const addWalletPulse = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const walletTutorialTarget = useRef<View>(null);
  const [pendingWalletType, setPendingWalletType] = useState<WalletTab | null>(null);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [proWelcomeVisible, setProWelcomeVisible] = useState(false);
  const [isDismissingProWelcome, setIsDismissingProWelcome] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<BalanceProPlanId>("yearly");
  const [paywallSource, setPaywallSource] = useState<BalanceProPaywallSource>("wallet-limit");
  const {
    isPro,
    activePlan,
    isReady: isProReady,
    isStoreAvailable,
    isStoreLoading,
    storeErrorCode,
    storeErrorMessage,
    isPurchasePending,
    isRestorePending,
    availablePlans,
    canCreateWallet,
    prepareStore,
    purchase,
    restore,
    markProWelcomeSeen,
  } = useBalancePro();
  useEffect(() => {
    if (!showInvestments) {
      setTab("LIQUIDITY");
      setShowAddWallet((prev) => ({ ...prev, INVEST: false, PENSION: false }));
    }
  }, [showInvestments]);

  useEffect(() => {
    if (!trackPension && tab === "PENSION") {
      setTab(showInvestments ? "INVEST" : "LIQUIDITY");
      setShowAddWallet((prev) => ({ ...prev, PENSION: false }));
    }
  }, [showInvestments, tab, trackPension]);

  useEffect(() => {
    if (!showInvestmentAvailability) {
      setAvailabilityFilter("all");
    }
  }, [showInvestmentAvailability]);

  useEffect(() => {
    if (!targetWalletId) return;
    const target = wallets.find((wallet) => wallet.id === targetWalletId);
    if (!target) return;
    setTab(target.investmentKind === "PENSION" && trackPension ? "PENSION" : target.type);
    setExpandedWalletId(target.id);
    navigation.setParams({ walletId: undefined });
  }, [navigation, targetWalletId, trackPension, wallets]);

  useEffect(() => {
    if (!startSetup) return;
    if (wallets.length > 0) return;
    if (showAddWallet.LIQUIDITY) return;
    setTab("LIQUIDITY");
    setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: true }));
    navigation.setParams({ startSetup: undefined });
  }, [navigation, startSetup, wallets.length, showAddWallet.LIQUIDITY]);

  useEffect(() => {
    if (!requestedPaywallSource) {
      return;
    }

    setPaywallSource(requestedPaywallSource);
    setLimitModalVisible(true);
    navigation.setParams({ paywallSource: undefined });
  }, [navigation, requestedPaywallSource]);

  const load = useCallback(async () => {
    const walletList = await listWallets();
    setWallets(walletList);
    setWalletsLoaded(true);
    const edits: Record<number, WalletDraft> = {};
    walletList.forEach((wallet) => {
      edits[wallet.id] = {
        name: wallet.name,
        tag: normalizeInvestmentTag(wallet, wallet.tag),
        currency: wallet.currency,
        color: wallet.color ?? DEFAULT_WALLET_COLOR,
        availability: wallet.availability,
        availabilityDate: wallet.availabilityDate ?? "",
        restrictionNote: wallet.restrictionNote ?? "",
      };
    });
    for (const id of Object.keys(pendingWalletSaves.current)) {
      const walletId = Number(id);
      if (pendingWalletSaves.current[walletId] && walletEditsRef.current[walletId]) {
        edits[walletId] = walletEditsRef.current[walletId];
      }
    }
    walletEditsRef.current = edits;
    setWalletEdits(edits);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshAll = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    const subscription = onDataReset(() => {
      void refreshAll();
    });
    return () => subscription.remove();
  }, [refreshAll]);

  useEffect(() => {
    const subscription = onDataChanged(() => {
      void refreshAll();
    });
    return () => subscription.remove();
  }, [refreshAll]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
      return undefined;
    }, [refreshAll])
  );

  const persistWalletEdit = useCallback(
    async (walletId: number, updates: Partial<WalletDraft>) => {
      const wallet = wallets.find((w) => w.id === walletId);
      if (!wallet) return;
      const current = walletEditsRef.current[walletId] ?? {
        name: wallet.name,
        tag: normalizeInvestmentTag(wallet, wallet.tag),
        currency: wallet.currency,
        color: wallet.color ?? DEFAULT_WALLET_COLOR,
        availability: wallet.availability,
        availabilityDate: wallet.availabilityDate ?? "",
        restrictionNote: wallet.restrictionNote ?? "",
      };
      const merged = { ...current, ...updates };
      walletEditsRef.current = { ...walletEditsRef.current, [walletId]: merged };
      setWalletEdits((prev) => ({ ...prev, [walletId]: merged }));
      const trimmedName = merged.name.trim();
      if (!trimmedName) return;
      if (merged.availability === "restricted" && merged.availabilityDate && !isIsoDate(merged.availabilityDate)) return;
      const trimmedTag = merged.tag?.trim() || null;
      const color = merged.color ?? DEFAULT_WALLET_COLOR;
      setWallets((prev) =>
        prev.map((item) =>
          item.id === walletId
            ? {
                ...item,
                name: trimmedName,
                tag: trimmedTag,
                currency: merged.currency,
                color,
                availability: merged.availability,
                availabilityDate: merged.availability === "restricted" ? merged.availabilityDate || null : null,
                restrictionNote: merged.availability === "restricted" ? merged.restrictionNote || null : null,
              }
            : item
        )
      );
      pendingWalletSaves.current[walletId] = (pendingWalletSaves.current[walletId] ?? 0) + 1;
      const previousSave = walletSaveQueues.current[walletId] ?? Promise.resolve();
      const save = previousSave.catch(() => undefined).then(async () => {
        await updateWallet(
          walletId, trimmedName, wallet.type, merged.currency, trimmedTag, wallet.active, color,
          merged.availability,
          merged.availability === "restricted" ? merged.availabilityDate || null : null,
          merged.availability === "restricted" ? merged.restrictionNote.trim() || null : null,
          wallet.investmentKind
        );
      });
      walletSaveQueues.current[walletId] = save;
      try {
        await save;
      } catch (error) {
        console.warn("Failed to auto-save wallet", error);
      } finally {
        pendingWalletSaves.current[walletId] -= 1;
      }
    },
    [wallets]
  );

  const openConfirmDeleteWallet = useCallback((walletId: number) => {
    setConfirmWalletId(walletId);
    setConfirmWalletError(null);
  }, []);

  const closeConfirmDeleteWallet = useCallback(() => {
    if (confirmWalletLoading) return;
    setConfirmWalletId(null);
    setConfirmWalletError(null);
  }, [confirmWalletLoading]);

  const handleConfirmDeleteWallet = useCallback(async () => {
    if (!confirmWalletId) return;
    setConfirmWalletLoading(true);
    setConfirmWalletError(null);
    try {
      await deleteWallet(confirmWalletId);
      await load();
      emitDataChanged();
      setExpandedWalletId(null);
      setConfirmWalletId(null);
    } catch (error) {
      console.warn("Failed to delete wallet", error);
      setConfirmWalletError(
        t("wallets.actions.deleteError", { defaultValue: "Errore durante l'eliminazione. Riprova." })
      );
    } finally {
      setConfirmWalletLoading(false);
    }
  }, [confirmWalletId, load, t]);

  const orderedWallets = useMemo(() => orderWalletsForUI(wallets), [wallets]);
  const liquidityWallets = useMemo(
    () => orderedWallets.filter((wallet) => wallet.type === "LIQUIDITY"),
    [orderedWallets]
  );
  const allInvestmentWallets = useMemo(
    () => orderedWallets.filter((wallet) => wallet.type === "INVEST" && wallet.investmentKind !== "PENSION"),
    [orderedWallets]
  );
  const showAvailabilityFilters = showInvestmentAvailability && allInvestmentWallets.length > 5;
  const investmentWallets = useMemo(
    () => allInvestmentWallets.filter((wallet) => (
      !showAvailabilityFilters || availabilityFilter === "all" || wallet.availability === availabilityFilter
    )),
    [allInvestmentWallets, availabilityFilter, showAvailabilityFilters]
  );
  const pensionWallets = useMemo(
    () => orderedWallets.filter((wallet) => wallet.type === "INVEST" && wallet.investmentKind === "PENSION"),
    [orderedWallets]
  );
  const noWallets = wallets.length === 0;
  const shouldPulseAdd = noWallets && !showAddWallet.LIQUIDITY && tab === "LIQUIDITY";
  const getWalletDisplayColor = (wallet: Wallet) => walletEdits[wallet.id]?.color ?? wallet.color ?? DEFAULT_WALLET_COLOR;
  const activeWallets = tab === "LIQUIDITY"
    ? liquidityWallets
    : tab === "PENSION" ? pensionWallets : investmentWallets;
  const guideWallet = activeWallets.length === 1 && isSeededDefaultWallet(activeWallets[0]) ? activeWallets[0] : null;
  const shouldShowWalletGuide = Boolean(guideWallet);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (shouldPulseAdd) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(addWalletPulse, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(addWalletPulse, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      addWalletPulse.stopAnimation();
      addWalletPulse.setValue(1);
    }
    return () => {
      animation?.stop();
    };
  }, [addWalletPulse, shouldPulseAdd]);

  const walletCount = wallets.length;
  const canCreateAnotherWallet = canCreateWallet(walletCount);
  const canReorder = (tab !== "INVEST" || !showAvailabilityFilters || availabilityFilter === "all") && activeWallets.length > 1;

  useEffect(() => {
    if (!showAvailabilityFilters && availabilityFilter !== "all") {
      setAvailabilityFilter("all");
    }
  }, [availabilityFilter, showAvailabilityFilters]);

  useEffect(() => {
    if (activePlan) {
      setSelectedPlanId(activePlan);
    }
  }, [activePlan]);

  useEffect(() => {
    const firstAvailablePlan = availablePlans.find((plan) => plan.product)?.planId;
    if (!firstAvailablePlan) {
      return;
    }

    const selectedPlan = availablePlans.find((plan) => plan.planId === selectedPlanId);
    if (selectedPlan?.product) {
      return;
    }

    setSelectedPlanId(firstAvailablePlan);
  }, [availablePlans, selectedPlanId]);

  useEffect(() => {
    if (!isPro || !pendingWalletType) {
      return;
    }

    setLimitModalVisible(false);
    setShowAddWallet((prev) => ({ ...prev, [pendingWalletType]: true }));
    setPendingWalletType(null);
  }, [isPro, pendingWalletType]);

  useEffect(() => {
    if (!limitModalVisible) {
      return;
    }

    void prepareStore();
  }, [limitModalVisible, prepareStore]);

  useEffect(() => {
    if (!canReorder && reorderMode) {
      setReorderMode(false);
    }
  }, [canReorder, reorderMode]);

  useEffect(() => {
    if (!reorderMode) return;
    setReorderLists({
      LIQUIDITY: [...liquidityWallets],
      INVEST: [...investmentWallets],
      PENSION: [...pensionWallets],
    });
  }, [reorderMode, liquidityWallets, investmentWallets, pensionWallets]);

  const persistWalletOrder = useCallback(
    async (group: WalletTab, data: Wallet[]) => {
      setReorderLists((prev) => ({ ...prev, [group]: data }));
      const updates = data.map((wallet, index) => ({
        id: wallet.id,
        sortOrder: index,
      }));
      setWallets((prev) =>
        prev.map((wallet) => {
          const update = updates.find((item) => item.id === wallet.id);
          return update ? { ...wallet, sortOrder: update.sortOrder } : wallet;
        })
      );
      try {
        await updateWalletSortOrders(updates);
        await load();
      } catch (error) {
        console.warn("Failed to update wallet order", error);
      }
    },
    [load]
  );

  const moveWalletInReorderList = useCallback(
    async (group: WalletTab, fromIndex: number, toIndex: number) => {
      const list = reorderLists[group];
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= list.length) return;
      const next = [...list];
      const [item] = next.splice(fromIndex, 1);
      if (!item) return;
      next.splice(toIndex, 0, item);
      await persistWalletOrder(group, next);
    },
    [persistWalletOrder, reorderLists]
  );

  const ReorderableRow = ({ wallet, group, index }: { wallet: Wallet; group: WalletTab; index: number }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const startIndexRef = useRef(index);
    const listLength = reorderLists[group].length;
    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onStartShouldSetPanResponderCapture: () => true,
          onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
          onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 2,
          onPanResponderGrant: () => {
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
            const minIndex = 0;
            const maxIndex = listLength - 1;
            const nextIndex = Math.max(
              minIndex,
              Math.min(maxIndex, startIndexRef.current + Math.round(gesture.dy / REORDER_ROW_HEIGHT))
            );
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 24,
              bounciness: 4,
            }).start();
            reorderDropOpacity.setValue(0);
            void moveWalletInReorderList(group, startIndexRef.current, nextIndex);
          },
          onPanResponderTerminate: () => {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              speed: 24,
              bounciness: 4,
            }).start();
            reorderDropOpacity.setValue(0);
          },
        }),
      [group, index, listLength, moveWalletInReorderList, reorderDropOpacity, reorderDropY, translateY, wallet.id]
    );

    return (
      <Animated.View
        {...panResponder.panHandlers}
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
          <View style={styles.reorderRowLabelRow}>
            <View
              style={[
                styles.walletColorDot,
                { backgroundColor: wallet.color ?? DEFAULT_WALLET_COLOR },
              ]}
            />
            <Text style={[styles.reorderRowLabel, { color: tokens.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {wallet.name}
            </Text>
          </View>
          <Text style={[styles.reorderRowMeta, { color: tokens.colors.muted }]}>{wallet.currency}</Text>
        </View>
        <View
          style={[
            styles.reorderAction,
            { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
          ]}
        >
          <MaterialCommunityIcons name="drag-horizontal-variant" size={22} color={tokens.colors.accent} />
        </View>
      </Animated.View>
    );
  };

  const addWallet = async (walletTab: WalletTab) => {
    if (!newWalletDraft.name.trim()) return;
    const type: WalletType = walletTab === "LIQUIDITY" ? "LIQUIDITY" : "INVEST";
    const availability = walletTab === "PENSION"
      ? "restricted"
      : type === "LIQUIDITY" || !showInvestmentAvailability
      ? type === "LIQUIDITY" ? "immediate" : "liquid"
      : newWalletDraft.availability;
    if (availability === "restricted" && newWalletDraft.availabilityDate && !isIsoDate(newWalletDraft.availabilityDate)) return;
    if (!canCreateAnotherWallet) {
      setPaywallSource("wallet-limit");
      setPendingWalletType(walletTab);
      setLimitModalVisible(true);
      return;
    }
    const wasEmpty = wallets.length === 0;
    await createWallet(
      newWalletDraft.name.trim(),
      type,
      newWalletDraft.currency,
      type === "INVEST" ? newWalletDraft.tag.trim() || null : null,
      1,
      newWalletDraft.color,
      availability,
      availability === "restricted" ? newWalletDraft.availabilityDate || null : null,
      availability === "restricted" ? newWalletDraft.restrictionNote.trim() || null : null,
      walletTab === "PENSION" ? "PENSION" : "STANDARD"
    );
    setNewWalletDraft({ name: "", tag: "", currency: "EUR", color: DEFAULT_WALLET_COLOR, availability: "liquid", availabilityDate: "", restrictionNote: "" });
    setShowAddWallet((prev) => ({ ...prev, [walletTab]: false }));
    await load();
    emitDataChanged();
    if (startSetup && wasEmpty && type === "LIQUIDITY") {
      navigation.navigate("Snapshot");
      navigation.setParams({ startSetup: undefined });
    }
  };

  const handleRequestAddWallet = (walletTab: WalletTab) => {
    if (!canCreateAnotherWallet) {
      setPaywallSource("wallet-limit");
      setPendingWalletType(walletTab);
      setLimitModalVisible(true);
      return;
    }

    const type: WalletType = walletTab === "LIQUIDITY" ? "LIQUIDITY" : "INVEST";
    setNewWalletDraft((prev) => ({
      ...prev,
      availability: walletTab === "PENSION" ? "restricted" : inferAssetAvailability(type, prev.name, prev.tag),
    }));
    setShowAddWallet((prev) => ({ ...prev, [walletTab]: true }));
  };

  const selectedPlan = availablePlans.find((plan) => plan.planId === selectedPlanId) ?? null;
  const canPurchaseSelectedPlan = Boolean(isStoreAvailable && selectedPlan?.product);

  const handlePurchasePro = useCallback(async () => {
    if (!canPurchaseSelectedPlan || isStoreLoading || !isProReady) {
      setPurchaseNotice(
        t("wallets.actions.limitStatusPriceUnavailable", {
          defaultValue: "I prezzi di Balance Pro non sono disponibili in questo momento. Riprova tra poco.",
        })
      );
      return;
    }

    const result = await purchase(selectedPlanId);
    switch (result.status) {
      case "success":
        setLimitModalVisible(false);
        setPaywallSource("wallet-limit");
        if (result.showWelcome) {
          setPurchaseNotice(null);
          setProWelcomeVisible(true);
          return;
        }
        setPurchaseNotice(t("wallets.actions.purchaseSuccess", { defaultValue: "Balance Pro attivato." }));
        return;
      case "cancelled":
        setPurchaseNotice(t("wallets.actions.purchaseCancelled", { defaultValue: "Acquisto annullato." }));
        return;
      case "pending":
        setPurchaseNotice(
          t("wallets.actions.purchasePending", {
            defaultValue: "L'abbonamento è in attesa di conferma. Ti avviseremo appena Balance Pro sarà disponibile.",
          })
        );
        return;
      case "product-unavailable":
        setPurchaseNotice(
          t("wallets.actions.productUnavailable", {
            defaultValue: "Questo piano non è disponibile al momento. Riprova tra poco.",
          })
        );
        return;
      case "store-unavailable":
        setPurchaseNotice(t("wallets.actions.storeUnavailable", { defaultValue: "Store non disponibile. Riprova più tardi." }));
        return;
      default:
        setPurchaseNotice(
          t("wallets.actions.purchaseError", {
            defaultValue: "Impossibile completare l'acquisto ora. Riprova tra poco.",
          })
        );
        return;
    }
  }, [canPurchaseSelectedPlan, isProReady, isStoreLoading, purchase, selectedPlanId, t]);

  const handleDismissProWelcome = useCallback(() => {
    if (isDismissingProWelcome) {
      return;
    }

    setIsDismissingProWelcome(true);
    void markProWelcomeSeen()
      .catch((error) => {
        console.warn("Failed to persist Balance Pro welcome state", error);
      })
      .finally(() => {
        setIsDismissingProWelcome(false);
        setProWelcomeVisible(false);
      });
  }, [isDismissingProWelcome, markProWelcomeSeen]);

  const handleRestorePurchases = useCallback(async () => {
    const result = await restore();
    switch (result.status) {
      case "restored":
        setPurchaseNotice(t("wallets.actions.restoreSuccess", { defaultValue: "Abbonamento ripristinato." }));
        setLimitModalVisible(false);
        setPaywallSource("wallet-limit");
        return;
      case "nothing-to-restore":
        setPurchaseNotice(t("wallets.actions.restoreEmpty", { defaultValue: "Nessun acquisto da ripristinare." }));
        return;
      case "store-unavailable":
        setPurchaseNotice(t("wallets.actions.storeUnavailable", { defaultValue: "Store non disponibile. Riprova più tardi." }));
        return;
      default:
        setPurchaseNotice(
          t("wallets.actions.restoreError", {
            defaultValue: "Impossibile ripristinare gli acquisti ora. Riprova più tardi.",
          })
        );
        return;
    }
  }, [restore, t]);

  const handleRetryStore = useCallback(() => {
    void prepareStore();
  }, [prepareStore]);

  const handleOpenExternalStoreLink = useCallback(
    async (openLink: () => Promise<void>) => {
      try {
        await openLink();
      } catch (error) {
        console.warn("Failed to open Balance Pro legal link", error);
        setPurchaseNotice(
          t("wallets.actions.storeError", {
            defaultValue: "Impossibile aprire il link.",
          })
        );
      }
    },
    [t]
  );

  const handleOpenPrivacyPolicy = useCallback(() => {
    void handleOpenExternalStoreLink(openPrivacyPolicyLink);
  }, [handleOpenExternalStoreLink]);

  const handleOpenTermsOfUse = useCallback(() => {
    void handleOpenExternalStoreLink(openTermsOfUseLink);
  }, [handleOpenExternalStoreLink]);

  const inputProps = createStandardTextInputProps(tokens);
  const balanceProBenefits = useMemo(
    () => [
      t("wallets.actions.limitBenefitUnlimited"),
      t("wallets.actions.limitBenefitInsights"),
      t("wallets.actions.limitBenefitControl"),
    ],
    [t]
  );
  const paywallLegalLinks = useMemo(
    () => [
      {
        key: "privacy",
        label: t("wallets.actions.privacyPolicy", { defaultValue: "Privacy Policy" }),
        onPress: handleOpenPrivacyPolicy,
      },
      {
        key: "terms",
        label: t("wallets.actions.termsOfUse", { defaultValue: "Terms of Use" }),
        onPress: handleOpenTermsOfUse,
      },
    ],
    [handleOpenPrivacyPolicy, handleOpenTermsOfUse, t]
  );
  const paywallTitle =
    paywallSource === "settings-upsell"
      ? t("wallets.actions.paywallHeadlineSettings", {
          defaultValue: "Passa a Balance Pro",
        })
      : t("wallets.actions.paywallHeadline", {
          defaultValue: "Limite wallet raggiunto",
        });
  const paywallSubtitle =
    paywallSource === "settings-upsell"
      ? t("wallets.actions.paywallSubtitleSettings", {
          defaultValue: "Wallet illimitati, insight avanzati e controllo completo delle tue finanze.",
        })
      : undefined;
  const paywallDismissLabel =
    paywallSource === "settings-upsell"
      ? t("common.close", { defaultValue: "Chiudi" })
      : t("wallets.actions.limitMaybeLater");
  const shouldShowRetryStore = Boolean((storeErrorCode || storeErrorMessage || !isStoreAvailable) && isProReady && !isStoreLoading);
  const paywallStatusMessage = !isProReady
    ? t("wallets.actions.limitStatusSyncing", {
        defaultValue: "Sto verificando il tuo stato Balance Pro...",
      })
    : isStoreLoading
    ? t("wallets.actions.limitStatusSyncing", {
        defaultValue: "Sto verificando il tuo stato Balance Pro...",
      })
    : storeErrorCode === "empty-products" || !canPurchaseSelectedPlan
    ? t("wallets.actions.limitStatusPriceUnavailable", {
        defaultValue: "I prezzi di Balance Pro non sono disponibili in questo momento. Riprova tra poco o ripristina gli acquisti.",
      })
    : storeErrorMessage
    ? t("wallets.actions.storeUnavailable", { defaultValue: "Store non disponibile. Riprova più tardi." })
    : undefined;
  const closePaywall = useCallback(() => {
    setLimitModalVisible(false);
    setPendingWalletType(null);
    setPaywallSource("wallet-limit");
  }, []);
  const closeReorderModal = useCallback(() => setReorderMode(false), []);
  const orderToggle = canReorder ? (
    <View style={styles.orderToggleRow}>
      <PressScale onPress={() => setReorderMode((prev) => !prev)} style={styles.orderToggleLink}>
        <Text style={[styles.orderToggleText, { color: tokens.colors.accent }]}>
          {t("wallets.list.editOrder")}
        </Text>
      </PressScale>
    </View>
  ) : null;
  return (
    <View style={styles.screenRoot}>
      <AppBackground>
        <ScrollView
          ref={scrollRef}
          bounces={scrollBounceEnabled}
          alwaysBounceVertical={scrollBounceEnabled}
          overScrollMode={scrollBounceEnabled ? "always" : "never"}
          contentContainerStyle={[
            styles.container,
            { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: 12 },
          ]}
        >
        <GlassCardContainer>
          <View style={styles.sectionContent}>
            {showInvestments && (
              <SegmentedControlPill
                value={tab}
                onChange={(value) => setTab(value as WalletTab)}
                options={[
                  { value: "LIQUIDITY", label: t("wallets.list.tabLiquidity"), tint: `${tokens.colors.income}33` },
                  { value: "INVEST", label: t("wallets.list.tabInvest"), tint: `${tokens.colors.accent}33` },
                  ...(trackPension ? [{ value: "PENSION", label: t("wallets.list.tabPension"), tint: `${tokens.colors.yellow}33` }] : []),
                ]}
              />
            )}
            {tab === "INVEST" && showAvailabilityFilters ? <View style={styles.filterRow}>
              {(["all", "liquid", "restricted"] as const).map((filter) => (
                <PillChip
                  key={filter}
                  label={t(`wallets.availability.filter.${filter}`)}
                  selected={availabilityFilter === filter}
                  onPress={() => setAvailabilityFilter(filter)}
                />
              ))}
            </View> : null}

            {tab === "LIQUIDITY" && (
              <>
                {liquidityWallets.map((wallet) => {
                  const subtitle = `${walletEdits[wallet.id]?.currency ?? wallet.currency}${wallet.tag ? ` · ${wallet.tag}` : ""}`;
                  const editColor = walletEdits[wallet.id]?.color ?? wallet.color ?? DEFAULT_WALLET_COLOR;
                  return (
                    <AccordionItem
                      key={wallet.id}
                      title={walletEdits[wallet.id]?.name ?? wallet.name}
                      subtitle={subtitle}
                      icon="wallet"
                      expanded={expandedWalletId === wallet.id}
                      onToggle={() => setExpandedWalletId((prev) => (prev === wallet.id ? null : wallet.id))}
                      color={getWalletDisplayColor(wallet)}
                      iconOverride={expandedWalletId === wallet.id ? "trash-can-outline" : undefined}
                      iconBackgroundOverride={expandedWalletId === wallet.id ? tokens.colors.red : undefined}
                      iconColorOverride={expandedWalletId === wallet.id ? deleteIconColor : undefined}
                      onIconPress={
                        expandedWalletId === wallet.id
                          ? () => {
                              openConfirmDeleteWallet(wallet.id);
                            }
                          : undefined
                      }
                    >
                      <View style={[styles.sectionContent, styles.accordionInner]}>
                        <View style={styles.colorLine}>
                        <TextInput
                          label={t("wallets.form.name")}
                          value={walletEdits[wallet.id]?.name ?? wallet.name}
                          {...inputProps}
                          style={[
                            styles.walletNameInput,
                            { backgroundColor: tokens.colors.glassBg },
                          ]}
                          onChangeText={(value) => {
                            void persistWalletEdit(wallet.id, { name: value });
                          }}
                        />
                          <PressScale
                            onPress={() =>
                              void persistWalletEdit(wallet.id, {
                                color: nextPresetColor(editColor),
                              })
                            }
                            style={[
                              styles.colorSwatch,
                              {
                                backgroundColor: editColor,
                                borderColor: tokens.colors.glassBorder,
                              },
                            ]}
                          >
                            <View />
                          </PressScale>
                        </View>
                        <SegmentedControlPill
                          value={walletEdits[wallet.id]?.currency ?? wallet.currency}
                          onChange={(value) =>
                            void persistWalletEdit(wallet.id, { currency: value as Currency })
                          }
                          options={[
                            { value: "EUR", label: "EUR" },
                            { value: "USD", label: "USD" },
                            { value: "GBP", label: "GBP" },
                          ]}
                        />
                      </View>
                    </AccordionItem>
                  );
                })}
                <BottomSheet
                  visible={showAddWallet.LIQUIDITY}
                  title={t("wallets.list.newLiquidityTitle")}
                  subtitle={t("wallets.sheet.liquiditySubtitle", {
                    defaultValue: "Nome, valuta e colore del wallet.",
                  })}
                  onClose={() => setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: false }))}
                >
                    <View style={styles.sectionContent}>
                      <View style={[styles.colorLine]}>
                        <TextInput
                          label={t("wallets.form.name")}
                          value={newWalletDraft.name}
                          {...inputProps}
                          style={[
                            styles.walletNameInput,
                            { backgroundColor: tokens.colors.glassBg },
                          ]}
                          onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
                        />
                        <PressScale
                          onPress={() =>
                            setNewWalletDraft((prev) => ({ ...prev, color: nextPresetColor(prev.color) }))
                          }
                          style={[
                            styles.colorSwatch,
                            {
                              backgroundColor: newWalletDraft.color,
                              borderColor: tokens.colors.glassBorder,
                            },
                          ]}
                        >
                          <View />
                        </PressScale>
                      </View>
                      <SegmentedControlPill
                        value={newWalletDraft.currency}
                        onChange={(value) => setNewWalletDraft((prev) => ({ ...prev, currency: value as Currency }))}
                        options={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                      />
                    </View>
                    <View style={styles.addWalletAction}>
                      <PrimaryPillButton
                        label={newWalletDraft.name.trim() ? t("common.add") : t("common.cancel")}
                        onPress={() => {
                          if (newWalletDraft.name.trim()) {
                            void addWallet("LIQUIDITY");
                            return;
                          }
                          setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: false }));
                        }}
                        color={tokens.colors.accent}
                      />
                    </View>
                </BottomSheet>
              </>
            )}

            {showInvestments && (tab === "INVEST" || tab === "PENSION") && (
              <>
                {(tab === "PENSION" ? pensionWallets : investmentWallets).map((wallet) => {
                  const investmentTag = normalizeInvestmentTag(wallet, walletEdits[wallet.id]?.tag ?? wallet.tag);
                  const subtitle = `${walletEdits[wallet.id]?.currency ?? wallet.currency}${
                    investmentTag ? ` · ${investmentTag}` : ""
                  }`;
                  const editColor = walletEdits[wallet.id]?.color ?? wallet.color ?? DEFAULT_WALLET_COLOR;
                  return (
                    <AccordionItem
                      key={wallet.id}
                      title={walletEdits[wallet.id]?.name ?? wallet.name}
                      subtitle={subtitle}
                      icon="wallet"
                      expanded={expandedWalletId === wallet.id}
                      onToggle={() => setExpandedWalletId((prev) => (prev === wallet.id ? null : wallet.id))}
                      color={getWalletDisplayColor(wallet)}
                      iconOverride={expandedWalletId === wallet.id ? "trash-can-outline" : undefined}
                      iconBackgroundOverride={expandedWalletId === wallet.id ? tokens.colors.red : undefined}
                      iconColorOverride={expandedWalletId === wallet.id ? deleteIconColor : undefined}
                      onIconPress={
                        expandedWalletId === wallet.id
                          ? () => {
                              openConfirmDeleteWallet(wallet.id);
                            }
                          : undefined
                      }
                    >
                      <View style={[styles.sectionContent, styles.accordionInner]}>
                      <View style={styles.colorLine}>
                        <TextInput
                          label={tab === "PENSION" ? t("wallets.form.pensionProviderLabel") : t("wallets.form.brokerLabel")}
                          value={walletEdits[wallet.id]?.name ?? wallet.name}
                          {...inputProps}
                          style={[
                            styles.walletNameInput,
                            { backgroundColor: tokens.colors.glassBg },
                          ]}
                          onChangeText={(value) => {
                            void persistWalletEdit(wallet.id, { name: value });
                          }}
                        />
                        <PressScale
                          onPress={() =>
                            void persistWalletEdit(wallet.id, {
                              color: nextPresetColor(editColor),
                            })
                          }
                          style={[
                            styles.colorSwatch,
                            {
                              backgroundColor: editColor,
                              borderColor: tokens.colors.glassBorder,
                            },
                          ]}
                        >
                          <View />
                        </PressScale>
                      </View>
                      <TextInput
                        label={tab === "PENSION" ? t("wallets.form.pensionTypeLabel") : t("wallets.form.investmentTypeLabel")}
                        value={investmentTag}
                        {...inputProps}
                        onChangeText={(value) =>
                          void persistWalletEdit(wallet.id, { tag: value })
                        }
                      />
                      <SegmentedControlPill
                        value={walletEdits[wallet.id]?.currency ?? wallet.currency}
                        onChange={(value) =>
                          void persistWalletEdit(wallet.id, { currency: value as Currency })
                        }
                        options={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                      />
                      {tab === "INVEST" && showInvestmentAvailability ? <AvailabilityEditor
                        value={walletEdits[wallet.id]?.availability ?? wallet.availability}
                        availabilityDate={walletEdits[wallet.id]?.availabilityDate ?? wallet.availabilityDate ?? ""}
                        restrictionNote={walletEdits[wallet.id]?.restrictionNote ?? wallet.restrictionNote ?? ""}
                        onChange={(updates) => void persistWalletEdit(wallet.id, updates)}
                      /> : null}
                      </View>
                    </AccordionItem>
                  );
                })}
                <BottomSheet
                  visible={showAddWallet[tab]}
                  title={tab === "PENSION" ? t("wallets.list.newPensionTitle") : t("wallets.list.newInvestTitle")}
                  subtitle={tab === "PENSION"
                    ? t("wallets.sheet.pensionSubtitle")
                    : t("wallets.sheet.investSubtitle", { defaultValue: "Broker, tipologia, valuta e colore." })}
                  onClose={() => setShowAddWallet((prev) => ({ ...prev, [tab]: false }))}
                >
                    <View style={styles.sectionContent}>
                      <View style={[styles.colorLine]}>
                        <TextInput
                          label={tab === "PENSION" ? t("wallets.form.pensionProviderLabel") : t("wallets.form.brokerLabel")}
                          value={newWalletDraft.name}
                          {...inputProps}
                          style={[
                            styles.walletNameInput,
                            { backgroundColor: tokens.colors.glassBg },
                          ]}
                          onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
                        />
                        <PressScale
                          onPress={() =>
                            setNewWalletDraft((prev) => ({ ...prev, color: nextPresetColor(prev.color) }))
                          }
                          style={[
                            styles.colorSwatch,
                            {
                              backgroundColor: newWalletDraft.color,
                              borderColor: tokens.colors.glassBorder,
                            },
                          ]}
                        >
                          <View />
                        </PressScale>
                      </View>
                      <TextInput
                        label={tab === "PENSION" ? t("wallets.form.pensionTypeLabel") : t("wallets.form.investmentTypeLabel")}
                        value={newWalletDraft.tag}
                        {...inputProps}
                        onChangeText={(value) => setNewWalletDraft((prev) => ({
                          ...prev,
                          tag: value,
                          availability: tab === "PENSION" ? "restricted" : prev.availability === "liquid"
                            ? inferAssetAvailability("INVEST", prev.name, value)
                            : prev.availability,
                        }))}
                      />
                      <SegmentedControlPill
                        value={newWalletDraft.currency}
                        onChange={(value) => setNewWalletDraft((prev) => ({ ...prev, currency: value as Currency }))}
                        options={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                      />
                      {tab === "INVEST" && showInvestmentAvailability ? <AvailabilityEditor
                        value={newWalletDraft.availability}
                        availabilityDate={newWalletDraft.availabilityDate}
                        restrictionNote={newWalletDraft.restrictionNote}
                        onChange={(updates) => setNewWalletDraft((prev) => ({ ...prev, ...updates }))}
                      /> : null}
                    </View>
                    <View style={styles.addWalletAction}>
                      <PrimaryPillButton
                        label={newWalletDraft.name.trim() ? t("common.add") : t("common.cancel")}
                        onPress={() => {
                          if (newWalletDraft.name.trim()) {
                            void addWallet(tab);
                            return;
                          }
                          setShowAddWallet((prev) => ({ ...prev, [tab]: false }));
                        }}
                        color={tokens.colors.accent}
                      />
                    </View>
                </BottomSheet>
              </>
            )}
            {!showAddWallet[tab] ? (
              <Animated.View ref={walletTutorialTarget} collapsable={false} style={shouldPulseAdd ? { transform: [{ scale: addWalletPulse }] } : undefined}>
                <PrimaryPillButton
                  label={t("wallets.list.addWallet")}
                  onPress={() => handleRequestAddWallet(tab)}
                  color={tokens.colors.accent}
                />
              </Animated.View>
            ) : null}
          </View>
        </GlassCardContainer>
        {orderToggle}

        <ConfirmDialog
          visible={confirmWalletId !== null}
          title={t("wallets.delete.title", { defaultValue: "Eliminare wallet?" })}
          message={t("wallets.delete.body", {
            defaultValue:
              "Se elimini questo wallet, verranno eliminati anche tutti gli snapshot associati nel tempo. Questa azione non può essere annullata.",
          })}
          confirmLabel={t("wallets.delete.confirm", { defaultValue: "Elimina wallet" })}
          cancelLabel={t("common.cancel", { defaultValue: "Annulla" })}
          onConfirm={handleConfirmDeleteWallet}
          onCancel={closeConfirmDeleteWallet}
          loading={confirmWalletLoading}
          error={confirmWalletError}
          confirmColor={tokens.colors.expense}
        />

        <LimitReachedModal
          visible={limitModalVisible}
          onClose={closePaywall}
          onUpgrade={handlePurchasePro}
          plans={availablePlans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
          title={paywallTitle}
          subtitle={paywallSubtitle}
          primaryDisabled={!canPurchaseSelectedPlan || !isProReady || isStoreLoading}
          onSecondaryAction={handleRestorePurchases}
          secondaryActionLabel={t("wallets.actions.restorePurchases")}
          onTertiaryAction={shouldShowRetryStore ? handleRetryStore : undefined}
          tertiaryActionLabel={shouldShowRetryStore ? t("wallets.actions.retryStoreLoad", { defaultValue: "Riprova" }) : undefined}
          secondaryLabel={paywallDismissLabel}
          benefits={balanceProBenefits}
          primaryLoading={isPurchasePending}
          secondaryActionLoading={isRestorePending}
          tertiaryActionLoading={isStoreLoading}
          statusMessage={paywallStatusMessage}
          legalLinks={paywallLegalLinks}
          isStoreLoading={!isProReady || isStoreLoading}
        />

        <ProWelcomeModal
          visible={proWelcomeVisible}
          onContinue={handleDismissProWelcome}
          loading={isDismissingProWelcome}
        />

        <Snackbar visible={purchaseNotice !== null} onDismiss={() => setPurchaseNotice(null)} duration={4000}>
          {purchaseNotice}
        </Snackbar>
        </ScrollView>
        <TutorialSpotlight id="wallets" requestToken={routeParams?.tutorialRequest} eligible={walletsLoaded && (wallets.length === 0 || (shouldShowWalletGuide && !wallets.some((wallet) => !isSeededDefaultWallet(wallet))))} canShow={walletsLoaded && !showAddWallet[tab]} target={walletTutorialTarget} title={t("tutorial.wallet.title")} description={t("tutorial.wallet.body")} targetLabel={t("wallets.list.addWallet")} onTargetPress={() => handleRequestAddWallet(tab)} />
      <BottomSheet
        visible={reorderMode && canReorder}
        title={t("wallets.list.reorderTitle")}
        subtitle={t("wallets.list.reorderHint")}
        onClose={closeReorderModal}
        actionLabel={t("wallets.list.doneOrder")}
        onAction={closeReorderModal}
        scrollable={false}
      >
        <ScrollView
          style={styles.reorderScroll}
          contentContainerStyle={styles.reorderGroups}
          showsVerticalScrollIndicator={false}
          bounces={scrollBounceEnabled}
          alwaysBounceVertical={scrollBounceEnabled}
          overScrollMode={scrollBounceEnabled ? "always" : "never"}
        >
          <View style={styles.reorderList}>
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
            {reorderLists[tab].map((wallet, index) => (
              <ReorderableRow key={wallet.id} wallet={wallet} group={tab} index={index} />
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </AppBackground>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionContent: {
    gap: 12,
  },
  addWalletAction: {
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    flexWrap: "wrap",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  walletNameInput: {
    flex: 1,
    minWidth: 0,
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  walletRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  walletIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  walletText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  walletTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  walletSubtitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  accordionBody: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  accordionInner: {
    gap: 12,
  },
  orderToggleRow: {
    alignItems: "flex-end",
    paddingTop: 4,
    paddingRight: 6,
  },
  guideActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  orderToggleLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  orderToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  reorderScroll: {
    flex: 1,
  },
  reorderGroups: {
    gap: 12,
  },
  reorderGroupTitle: {
    fontSize: 13,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
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
  walletColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reorderRowLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reorderRowLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  reorderRowMeta: {
    fontSize: 12,
  },
  reorderAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  screenRoot: {
    flex: 1,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  availabilitySection: {
    gap: 8,
    marginTop: 4,
  },
  availabilityTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  availabilityOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 13,
    padding: 11,
  },
  availabilityCopy: {
    flex: 1,
    gap: 2,
  },
  availabilityLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  availabilityDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  restrictionFields: {
    gap: 10,
    marginTop: 4,
  },
});
