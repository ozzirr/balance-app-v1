import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Platform, ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Snackbar, Text, TextInput } from "react-native-paper";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { createWallet, deleteWallet, listWallets, updateWallet, updateWalletSortOrders, DEFAULT_WALLET_COLOR } from "@/repositories/walletsRepo";
import type { Wallet, Currency, WalletType } from "@/repositories/types";
import { DarkTheme, useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/settings/useSettings";
import LimitReachedModal from "@/ui/components/LimitReachedModal";
import ConfirmDialog from "@/ui/components/ConfirmDialog";
import ProWelcomeModal from "@/ui/components/ProWelcomeModal";
import AppBackground from "@/ui/components/AppBackground";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GlassBlur from "@/ui/components/GlassBlur";
import { emitDataChanged, onDataChanged, onDataReset } from "@/app/dataEvents";
import {
  GlassCardContainer,
  PrimaryPillButton,
  PillChip,
  SmallOutlinePillButton,
  SegmentedControlPill,
} from "@/ui/components/EntriesUI";
import { createStandardTextInputProps } from "@/ui/components/standardInputProps";
import { orderWalletsForUI, type WalletGroupOrder } from "@/domain/walletOrdering";
import { useBalancePro } from "@/features/pro/BalanceProProvider";
import type { BalanceProPlanId } from "@/config/entitlements";
import { openPrivacyPolicyLink, openTermsOfUseLink } from "@/config/storeLinks";

type WalletRouteParams = {
  walletId?: number;
  startSetup?: boolean;
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

function nextPresetColor(current: string): string {
  const index = presetColors.indexOf(current);
  if (index === -1) return presetColors[0];
  return presetColors[(index + 1) % presetColors.length];
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
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const { t } = useTranslation();
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderLists, setReorderLists] = useState<WalletGroupOrder>({
    LIQUIDITY: [],
    INVEST: [],
  });
  const [reorderVisible, setReorderVisible] = useState(false);
  const reorderAnim = useRef(new Animated.Value(0)).current;
  const { showInvestments, scrollBounceEnabled } = useSettings();
  const [walletEdits, setWalletEdits] = useState<
    Record<number, { name: string; tag: string; currency: Currency; color: string }>
  >({});
  const [tab, setTab] = useState<"LIQUIDITY" | "INVEST">("LIQUIDITY");
  const [newWalletDraft, setNewWalletDraft] = useState<{
    name: string;
    tag: string;
    currency: Currency;
    color: string;
  }>({
    name: "",
    tag: "",
    currency: "EUR",
    color: DEFAULT_WALLET_COLOR,
  });
  const [showAddWallet, setShowAddWallet] = useState<{ LIQUIDITY: boolean; INVEST: boolean }>({
    LIQUIDITY: false,
    INVEST: false,
  });
  const [expandedWalletId, setExpandedWalletId] = useState<number | null>(null);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [confirmWalletId, setConfirmWalletId] = useState<number | null>(null);
  const [confirmWalletLoading, setConfirmWalletLoading] = useState(false);
  const [confirmWalletError, setConfirmWalletError] = useState<string | null>(null);
  const addWalletPulse = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const [pendingWalletType, setPendingWalletType] = useState<"LIQUIDITY" | "INVEST" | null>(null);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [proWelcomeVisible, setProWelcomeVisible] = useState(false);
  const [isDismissingProWelcome, setIsDismissingProWelcome] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<BalanceProPlanId>("yearly");
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
      setShowAddWallet((prev) => ({ ...prev, INVEST: false }));
    }
  }, [showInvestments]);

  useEffect(() => {
    if (!targetWalletId) return;
    const target = wallets.find((wallet) => wallet.id === targetWalletId);
    if (!target) return;
    setTab(target.type);
    setExpandedWalletId(target.id);
    navigation.setParams({ walletId: undefined });
  }, [navigation, targetWalletId, wallets]);

  useEffect(() => {
    if (!startSetup) return;
    if (wallets.length > 0) return;
    if (showAddWallet.LIQUIDITY) return;
    setTab("LIQUIDITY");
    setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: true }));
    navigation.setParams({ startSetup: undefined });
  }, [navigation, startSetup, wallets.length, showAddWallet.LIQUIDITY]);

  const load = useCallback(async () => {
    const walletList = await listWallets();
    setWallets(walletList);
    const edits: Record<number, { name: string; tag: string; currency: Currency; color: string }> = {};
    walletList.forEach((wallet) => {
      edits[wallet.id] = {
        name: wallet.name,
        tag: wallet.tag ?? "",
        currency: wallet.currency,
        color: wallet.color ?? DEFAULT_WALLET_COLOR,
      };
    });
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
    async (walletId: number, updates: Partial<{ name: string; tag: string; currency: Currency; color: string }>) => {
      const wallet = wallets.find((w) => w.id === walletId);
      if (!wallet) return;
      const current = walletEdits[walletId] ?? {
        name: wallet.name,
        tag: wallet.tag ?? "",
        currency: wallet.currency,
        color: wallet.color ?? DEFAULT_WALLET_COLOR,
      };
      const merged = { ...current, ...updates };
      setWalletEdits((prev) => ({ ...prev, [walletId]: merged }));
      const trimmedName = merged.name.trim();
      if (!trimmedName) return;
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
              }
            : item
        )
      );
      try {
        await updateWallet(walletId, trimmedName, wallet.type, merged.currency, trimmedTag, wallet.active, color);
      } catch (error) {
        console.warn("Failed to auto-save wallet", error);
      }
    },
    [walletEdits, wallets]
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
  const investmentWallets = useMemo(
    () => orderedWallets.filter((wallet) => wallet.type === "INVEST"),
    [orderedWallets]
  );
  const noWallets = wallets.length === 0;
  const shouldPulseAdd = noWallets && !showAddWallet.LIQUIDITY && tab === "LIQUIDITY";
  const getWalletDisplayColor = (wallet: Wallet) => walletEdits[wallet.id]?.color ?? wallet.color ?? DEFAULT_WALLET_COLOR;

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
  const canReorder = (tab === "LIQUIDITY" ? liquidityWallets.length : investmentWallets.length) > 1;

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
    });
  }, [reorderMode, liquidityWallets, investmentWallets]);

  const handleReorderEnd = useCallback(
    async (type: "LIQUIDITY" | "INVEST", data: Wallet[]) => {
      setReorderLists((prev) => ({ ...prev, [type]: data }));
      const updates = data.map((wallet, index) => ({
        id: wallet.id,
        sortOrder: index,
      }));
      try {
        await updateWalletSortOrders(updates);
        await load();
      } catch (error) {
        console.warn("Failed to update wallet order", error);
      }
    },
    [load]
  );

  const bringToTop = useCallback(
    async (type: WalletType, walletId: number) => {
      const list = reorderLists[type];
      const index = list.findIndex((wallet) => wallet.id === walletId);
      if (index <= 0) return;
      const item = list[index];
      const newList = [item, ...list.slice(0, index), ...list.slice(index + 1)];
      const orderUpdates = newList.map((wallet, idx) => ({ id: wallet.id, sortOrder: idx }));
      setWallets((prev) =>
        prev.map((wallet) => {
          const update = orderUpdates.find((update) => update.id === wallet.id);
          return update ? { ...wallet, sortOrder: update.sortOrder } : wallet;
        })
      );
      setReorderLists((prev) => ({ ...prev, [type]: newList }));
      await handleReorderEnd(type, newList);
    },
    [handleReorderEnd, reorderLists]
  );

  const ReorderableRow = ({ wallet, type, atTop }: { wallet: Wallet; type: WalletType; atTop: boolean }) => (
    <View
      style={[
        styles.reorderRow,
        {
          borderColor: tokens.colors.glassBorder,
          backgroundColor: tokens.colors.glassBg,
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
      <Pressable
        onPress={() => {
          if (!atTop) {
            void bringToTop(type, wallet.id);
          }
        }}
        disabled={atTop}
        style={({ pressed }) => [
          styles.reorderAction,
          { opacity: atTop ? 0.4 : pressed ? 0.7 : 1 },
        ]}
      >
        <MaterialCommunityIcons name="arrow-up" size={18} color={tokens.colors.accent} />
      </Pressable>
    </View>
  );

  const addWallet = async (type: "LIQUIDITY" | "INVEST") => {
    if (!newWalletDraft.name.trim()) return;
    if (!canCreateAnotherWallet) {
      setPendingWalletType(type);
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
      newWalletDraft.color
    );
    setNewWalletDraft({ name: "", tag: "", currency: "EUR", color: DEFAULT_WALLET_COLOR });
    setShowAddWallet((prev) => ({ ...prev, [type]: false }));
    await load();
    emitDataChanged();
    if (startSetup && wasEmpty && type === "LIQUIDITY") {
      navigation.navigate("Snapshot");
      navigation.setParams({ startSetup: undefined });
    }
  };

  const handleRequestAddWallet = (type: "LIQUIDITY" | "INVEST") => {
    if (!canCreateAnotherWallet) {
      setPendingWalletType(type);
      setLimitModalVisible(true);
      return;
    }

    setShowAddWallet((prev) => ({ ...prev, [type]: true }));
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
  const closeReorderModal = useCallback(() => setReorderMode(false), []);
  const reorderSheetBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
      ? "rgba(15, 18, 30, 0.78)"
      : "rgba(169, 124, 255, 0.5)";
  const reorderSheetBorder =
    Platform.OS === "android" ? tokens.colors.border : isDark ? DarkTheme.colors.border : "rgba(169, 124, 255, 0.5)";
  const reorderBlurIntensity = 35;
  const reorderOverlayTint = isDark ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.8)";
  const openReorderSheet = useCallback(() => {
    setReorderVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(reorderAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [reorderAnim]);
  const closeReorderSheet = useCallback(() => {
    Animated.timing(reorderAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setReorderVisible(false);
      }
    });
  }, [reorderAnim]);
  useEffect(() => {
    if (reorderMode && canReorder) {
      openReorderSheet();
      return;
    }
    if (!reorderMode && reorderVisible) {
      closeReorderSheet();
    }
  }, [reorderMode, canReorder, reorderVisible, openReorderSheet, closeReorderSheet]);
  const reorderTranslateY = reorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [64, 0],
  });
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
            { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
          ]}
        >
        <GlassCardContainer>
          <View style={styles.sectionContent}>
            {showInvestments && (
              <SegmentedControlPill
                value={tab}
                onChange={(value) => setTab(value as "LIQUIDITY" | "INVEST")}
                options={[
                  { value: "LIQUIDITY", label: t("wallets.list.tabLiquidity"), tint: `${tokens.colors.income}33` },
                  { value: "INVEST", label: t("wallets.list.tabInvest"), tint: `${tokens.colors.accent}33` },
                ]}
              />
            )}

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
                {!showAddWallet.LIQUIDITY && (
                  <Animated.View style={shouldPulseAdd ? { transform: [{ scale: addWalletPulse }] } : undefined}>
                    <PrimaryPillButton
                      label={t("wallets.list.addWallet")}
                      onPress={() => handleRequestAddWallet("LIQUIDITY")}
                      color={tokens.colors.accent}
                    />
                  </Animated.View>
                )}
                {showAddWallet.LIQUIDITY && (
                  <GlassCardContainer>
                    <SectionHeader title={t("wallets.list.newLiquidityTitle")} />
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
                  </GlassCardContainer>
                )}
              </>
            )}

            {showInvestments && tab === "INVEST" && (
              <>
                {investmentWallets.map((wallet) => {
                  const subtitle = `${walletEdits[wallet.id]?.currency ?? wallet.currency}${
                    walletEdits[wallet.id]?.tag || wallet.tag ? ` · ${walletEdits[wallet.id]?.tag ?? wallet.tag}` : ""
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
                          label={t("wallets.form.brokerLabel")}
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
                        label={t("wallets.form.investmentTypeLabel")}
                        value={walletEdits[wallet.id]?.tag ?? wallet.tag ?? ""}
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
                      </View>
                    </AccordionItem>
                  );
                })}
                {!showAddWallet.INVEST && (
                  <PrimaryPillButton
                    label={t("wallets.list.addWallet")}
                    onPress={() => handleRequestAddWallet("INVEST")}
                    color={tokens.colors.accent}
                  />
                )}
                {showAddWallet.INVEST && (
                  <GlassCardContainer>
                    <SectionHeader title={t("wallets.list.newInvestTitle")} />
                    <View style={styles.sectionContent}>
                      <View style={[styles.colorLine]}>
                        <TextInput
                          label={t("wallets.form.brokerLabel")}
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
                        label={t("wallets.form.investmentTypeLabel")}
                        value={newWalletDraft.tag}
                        {...inputProps}
                        onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, tag: value }))}
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
                    </View>
                    <View style={styles.addWalletAction}>
                      <PrimaryPillButton
                        label={newWalletDraft.name.trim() ? t("common.add") : t("common.cancel")}
                        onPress={() => {
                          if (newWalletDraft.name.trim()) {
                            void addWallet("INVEST");
                            return;
                          }
                          setShowAddWallet((prev) => ({ ...prev, INVEST: false }));
                        }}
                        color={tokens.colors.accent}
                      />
                    </View>
                  </GlassCardContainer>
                )}
              </>
            )}
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
          onClose={() => {
            setLimitModalVisible(false);
            setPendingWalletType(null);
          }}
          onUpgrade={handlePurchasePro}
          plans={availablePlans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
          primaryDisabled={!canPurchaseSelectedPlan || !isProReady || isStoreLoading}
          onSecondaryAction={handleRestorePurchases}
          secondaryActionLabel={t("wallets.actions.restorePurchases")}
          onTertiaryAction={shouldShowRetryStore ? handleRetryStore : undefined}
          tertiaryActionLabel={shouldShowRetryStore ? t("wallets.actions.retryStoreLoad", { defaultValue: "Riprova" }) : undefined}
          secondaryLabel={t("wallets.actions.limitMaybeLater")}
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
      <Modal
        visible={reorderVisible && canReorder}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        onRequestClose={closeReorderModal}
      >
        <View style={styles.reorderOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={closeReorderModal}>
            <Animated.View
              pointerEvents="none"
              style={[styles.reorderOverlayDim, { backgroundColor: reorderOverlayTint, opacity: reorderAnim }]}
            />
          </Pressable>
          <Animated.View
            pointerEvents="auto"
            style={[
              styles.reorderSheet,
              {
                backgroundColor: reorderSheetBackground,
                borderColor: reorderSheetBorder,
                paddingBottom: insets.bottom + 12,
                transform: [{ translateY: reorderTranslateY }],
                opacity: reorderAnim,
              },
            ]}
          >
            <GlassBlur
              intensity={reorderBlurIntensity}
              tint={isDark ? "dark" : "light"}
              fallbackColor="transparent"
            />
            <View style={styles.reorderSheetHeader}>
              <Text style={[styles.reorderSheetTitle, { color: tokens.colors.text }]}>
                {t("wallets.list.reorderTitle")}
              </Text>
              <SmallOutlinePillButton
                label={t("wallets.list.doneOrder")}
                onPress={closeReorderModal}
                color={tokens.colors.accent}
              />
            </View>
            <Text style={[styles.orderHint, { color: tokens.colors.muted }]}>{t("wallets.list.reorderHint")}</Text>
            <ScrollView
              style={styles.reorderScroll}
              contentContainerStyle={styles.reorderGroups}
              showsVerticalScrollIndicator={false}
              bounces={scrollBounceEnabled}
              alwaysBounceVertical={scrollBounceEnabled}
              overScrollMode={scrollBounceEnabled ? "always" : "never"}
            >
              <View style={styles.reorderList}>
                {(tab === "INVEST" ? reorderLists.INVEST : reorderLists.LIQUIDITY).map((wallet, index) => (
                  <ReorderableRow
                    key={wallet.id}
                    wallet={wallet}
                    type={tab === "INVEST" ? "INVEST" : "LIQUIDITY"}
                    atTop={index === 0}
                  />
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
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
  orderToggleLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  orderToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  reorderOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  reorderOverlayDim: {
    ...StyleSheet.absoluteFillObject,
  },
  reorderSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 18,
    overflow: "hidden",
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    gap: 12,
  },
  reorderSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reorderSheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  reorderScroll: {
    maxHeight: 420,
  },
  orderHint: {
    fontSize: 12,
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
  },
  reorderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  reorderRowActive: {
    opacity: 0.85,
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
    padding: 6,
    borderRadius: 6,
  },
  screenRoot: {
    flex: 1,
  },
});
