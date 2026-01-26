import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, View } from "react-native";
import { Snackbar, Text, TextInput, List } from "react-native-paper";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { createWallet, deleteWallet, listWallets, updateWallet } from "@/repositories/walletsRepo";
import {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  setExpenseCategoryActive,
  deleteExpenseCategory,
} from "@/repositories/expenseCategoriesRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import type { Wallet, Currency, ExpenseCategory } from "@/repositories/types";
import { APP_VARIANT, LIMITS } from "@/config/entitlements";
import { openProStoreLink } from "@/config/storeLinks";
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/settings/useSettings";
import LimitReachedModal from "@/ui/components/LimitReachedModal";
import AppBackground from "@/ui/components/AppBackground";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { onDataReset } from "@/app/dataEvents";
import {
  GlassCardContainer,
  PrimaryPillButton,
  PillChip,
  SmallOutlinePillButton,
  SegmentedControlPill,
} from "@/ui/components/EntriesUI";

type CategoryEdit = {
  name: string;
  color: string;
};

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
  icon: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

const AccordionItem = ({ title, subtitle, icon, expanded, onToggle, children }: AccordionItemProps) => {
  const { tokens } = useDashboardTheme();
  return (
    <GlassCardContainer contentStyle={{ gap: 12, padding: 12 }}>
      <PressScale onPress={onToggle} style={[styles.walletRow, { paddingVertical: 6 }]}>
        <View
          style={[
            styles.walletIconBadge,
            { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={18} color={tokens.colors.muted} />
        </View>
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
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={tokens.colors.muted}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
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

export default function WalletScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute();
  const routeParams = route.params as WalletRouteParams | undefined;
  const targetWalletId = routeParams?.walletId;
  const startSetup = routeParams?.startSetup;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const { t } = useTranslation();
  const { showInvestments } = useSettings();
  const [walletEdits, setWalletEdits] = useState<Record<number, { name: string; tag: string; currency: Currency }>>({});
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryEdits, setCategoryEdits] = useState<Record<number, CategoryEdit>>({});
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(presetColors[0]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null);
  const [tab, setTab] = useState<"LIQUIDITY" | "INVEST">("LIQUIDITY");
  const [newWalletDraft, setNewWalletDraft] = useState<{ name: string; tag: string; currency: Currency }>({
    name: "",
    tag: "",
    currency: "EUR",
  });
  const [showAddWallet, setShowAddWallet] = useState<{ LIQUIDITY: boolean; INVEST: boolean }>({
    LIQUIDITY: false,
    INVEST: false,
  });
  const [expandedWalletId, setExpandedWalletId] = useState<number | null>(null);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [storeErrorVisible, setStoreErrorVisible] = useState(false);
  const addWalletPulse = useRef(new Animated.Value(1)).current;
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
  }, [startSetup, wallets.length, showAddWallet.LIQUIDITY]);

  const load = useCallback(async () => {
    const [walletList, expenseCats] = await Promise.all([listWallets(), listExpenseCategories()]);
    setWallets(walletList);
    setCategories(expenseCats);
    const edits: Record<number, { name: string; tag: string; currency: Currency }> = {};
    walletList.forEach((wallet) => {
      edits[wallet.id] = {
        name: wallet.name,
        tag: wallet.tag ?? "",
        currency: wallet.currency,
      };
    });
    setWalletEdits(edits);

    const categoryEditsMap: Record<number, CategoryEdit> = {};
    expenseCats.forEach((cat) => {
      categoryEditsMap[cat.id] = { name: cat.name, color: cat.color };
    });
    setCategoryEdits(categoryEditsMap);

    const prefill = await getPreference("prefill_snapshot");
    const points = await getPreference("chart_points");
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    const parsedPoints = points ? Number(points.value) : 6;
    const safePoints = Number.isFinite(parsedPoints) ? Math.min(12, Math.max(3, parsedPoints)) : 6;
    setChartMonths(safePoints);
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

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
      return undefined;
    }, [refreshAll])
  );

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await createExpenseCategory(newCategory.trim(), newCategoryColor);
    setNewCategory("");
    setNewCategoryColor(presetColors[0]);
    await load();
  };

  const saveCategory = async (id: number) => {
    const edit = categoryEdits[id];
    const name = edit?.name?.trim();
    if (!name || !edit?.color) return;
    await updateExpenseCategory(id, name, edit.color);
    setExpandedCategoryId(null);
    await load();
  };

  const removeCategory = async (id: number) => {
    await deleteExpenseCategory(id);
    await load();
  };

  const liquidityWallets = useMemo(
    () => wallets.filter((wallet) => wallet.type === "LIQUIDITY"),
    [wallets]
  );
  const investmentWallets = useMemo(
    () => wallets.filter((wallet) => wallet.type === "INVEST"),
    [wallets]
  );
  const noWallets = wallets.length === 0;
  const shouldPulseAdd = noWallets && !showAddWallet.LIQUIDITY && tab === "LIQUIDITY";

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

  const getWalletCount = (type: "LIQUIDITY" | "INVEST") =>
    type === "LIQUIDITY" ? liquidityWallets.length : investmentWallets.length;
  const getLimitForType = (type: "LIQUIDITY" | "INVEST") =>
    type === "LIQUIDITY" ? LIMITS.liquidityWallets : LIMITS.investmentWallets;
  const hasReachedLimit = (type: "LIQUIDITY" | "INVEST") => {
    const limit = getLimitForType(type);
    if (limit === null) return false;
    return getWalletCount(type) >= limit;
  };
  const canCreateWallet = (type: "LIQUIDITY" | "INVEST") => !hasReachedLimit(type);

  const addWallet = async (type: "LIQUIDITY" | "INVEST") => {
    if (!newWalletDraft.name.trim()) return;
    if (APP_VARIANT === "free" && !canCreateWallet(type)) {
      setLimitModalVisible(true);
      return;
    }
    const wasEmpty = wallets.length === 0;
    await createWallet(
      newWalletDraft.name.trim(),
      type,
      newWalletDraft.currency,
      type === "INVEST" ? newWalletDraft.tag.trim() || null : null,
      1
    );
    setNewWalletDraft({ name: "", tag: "", currency: "EUR" });
    setShowAddWallet((prev) => ({ ...prev, [type]: false }));
    await load();
    if (startSetup && wasEmpty && type === "LIQUIDITY") {
      navigation.navigate("Snapshot", { openNew: true });
      navigation.setParams({ startSetup: undefined });
    }
  };

  const handleRequestAddWallet = (type: "LIQUIDITY" | "INVEST") => {
    if (APP_VARIANT === "pro") {
      setShowAddWallet((prev) => ({ ...prev, [type]: true }));
      return;
    }

    if (!canCreateWallet(type)) {
      setLimitModalVisible(true);
      return;
    }

    setShowAddWallet((prev) => ({ ...prev, [type]: true }));
  };

  const handleOpenProStore = useCallback(async () => {
    try {
      await openProStoreLink();
      setLimitModalVisible(false);
    } catch {
      setStoreErrorVisible(true);
    }
  }, []);

  const inputProps = {
    mode: "outlined" as const,
    outlineColor: tokens.colors.border,
    activeOutlineColor: tokens.colors.accent,
    textColor: tokens.colors.text,
    style: { backgroundColor: tokens.colors.glassBg },
  };

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
        alwaysBounceVertical
        bounces
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
                      <TextInput
                        label={t("wallets.form.name")}
                        value={newWalletDraft.name}
                        {...inputProps}
                        onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
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
                    <View style={styles.actionsRow}>
                      <PrimaryPillButton label={t("common.add")} onPress={() => addWallet("LIQUIDITY")} color={tokens.colors.accent} />
                      <SmallOutlinePillButton label={t("common.cancel")} onPress={() => setShowAddWallet((prev) => ({ ...prev, LIQUIDITY: false }))} color={tokens.colors.text} />
                    </View>
                  </GlassCardContainer>
                )}

                {liquidityWallets.map((wallet) => {
                  const subtitle = `${walletEdits[wallet.id]?.currency ?? wallet.currency}${wallet.tag ? ` · ${wallet.tag}` : ""}`;
                  return (
                    <AccordionItem
                      key={wallet.id}
                      title={walletEdits[wallet.id]?.name ?? wallet.name}
                      subtitle={subtitle}
                      icon="wallet"
                      expanded={expandedWalletId === wallet.id}
                      onToggle={() => setExpandedWalletId((prev) => (prev === wallet.id ? null : wallet.id))}
                    >
                      <View style={[styles.sectionContent, styles.accordionInner]}>
                        <TextInput
                          label={t("wallets.form.name")}
                          value={walletEdits[wallet.id]?.name ?? wallet.name}
                          {...inputProps}
                          onChangeText={(value) =>
                            setWalletEdits((prev) => ({
                              ...prev,
                              [wallet.id]: { ...prev[wallet.id], name: value },
                            }))
                          }
                        />
                        <SegmentedControlPill
                          value={walletEdits[wallet.id]?.currency ?? wallet.currency}
                          onChange={(value) =>
                            setWalletEdits((prev) => ({
                              ...prev,
                              [wallet.id]: { ...prev[wallet.id], currency: value as Currency },
                            }))
                          }
                          options={[
                            { value: "EUR", label: "EUR" },
                            { value: "USD", label: "USD" },
                            { value: "GBP", label: "GBP" },
                          ]}
                        />
                        <View style={styles.actionsRow}>
                          <PrimaryPillButton
                            label={t("common.save")}
                            onPress={async () => {
                              const edit = walletEdits[wallet.id];
                              if (!edit) return;
                              setExpandedWalletId(null);
                              await updateWallet(
                                wallet.id,
                                edit.name,
                                wallet.type,
                                edit.currency,
                                null,
                                wallet.active
                              );
                              await load();
                            }}
                            color={tokens.colors.accent}
                          />
                          <SmallOutlinePillButton
                            label={t("common.delete")}
                            onPress={async () => {
                              await deleteWallet(wallet.id);
                              await load();
                              setExpandedWalletId(null);
                            }}
                            color={tokens.colors.red}
                          />
                        </View>
                      </View>
                    </AccordionItem>
                  );
                })}
              </>
            )}

            {showInvestments && tab === "INVEST" && (
              <>
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
                      <TextInput
                        label={t("wallets.form.brokerLabel")}
                        value={newWalletDraft.name}
                        {...inputProps}
                        onChangeText={(value) => setNewWalletDraft((prev) => ({ ...prev, name: value }))}
                      />
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
                      <View style={styles.actionsRow}>
                        <PrimaryPillButton label={t("common.add")} onPress={() => addWallet("INVEST")} color={tokens.colors.accent} />
                        <SmallOutlinePillButton label={t("common.cancel")} onPress={() => setShowAddWallet((prev) => ({ ...prev, INVEST: false }))} color={tokens.colors.text} />
                    </View>
                  </GlassCardContainer>
                )}

                {investmentWallets.map((wallet) => {
                  const subtitle = `${walletEdits[wallet.id]?.currency ?? wallet.currency}${
                    walletEdits[wallet.id]?.tag || wallet.tag ? ` · ${walletEdits[wallet.id]?.tag ?? wallet.tag}` : ""
                  }`;
                  return (
                    <AccordionItem
                      key={wallet.id}
                      title={walletEdits[wallet.id]?.name ?? wallet.name}
                      subtitle={subtitle}
                      icon="wallet"
                      expanded={expandedWalletId === wallet.id}
                      onToggle={() => setExpandedWalletId((prev) => (prev === wallet.id ? null : wallet.id))}
                    >
                    <View style={[styles.sectionContent, styles.accordionInner]}>
                      <TextInput
                        label={t("wallets.form.brokerLabel")}
                        value={walletEdits[wallet.id]?.name ?? wallet.name}
                        {...inputProps}
                        onChangeText={(value) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [wallet.id]: { ...prev[wallet.id], name: value },
                          }))
                        }
                      />
                      <TextInput
                        label={t("wallets.form.investmentTypeLabel")}
                        value={walletEdits[wallet.id]?.tag ?? wallet.tag ?? ""}
                        {...inputProps}
                        onChangeText={(value) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [wallet.id]: { ...prev[wallet.id], tag: value },
                          }))
                        }
                      />
                      <SegmentedControlPill
                        value={walletEdits[wallet.id]?.currency ?? wallet.currency}
                        onChange={(value) =>
                          setWalletEdits((prev) => ({
                            ...prev,
                            [wallet.id]: { ...prev[wallet.id], currency: value as Currency },
                          }))
                        }
                        options={[
                          { value: "EUR", label: "EUR" },
                          { value: "USD", label: "USD" },
                          { value: "GBP", label: "GBP" },
                        ]}
                      />
                      <View style={styles.actionsRow}>
                        <PrimaryPillButton
                          label={t("common.save")}
                          onPress={async () => {
                            const edit = walletEdits[wallet.id];
                            if (!edit) return;
                            setExpandedWalletId(null);
                            await updateWallet(
                              wallet.id,
                              edit.name,
                              wallet.type,
                              edit.currency,
                              edit.tag || null,
                              wallet.active
                            );
                            await load();
                          }}
                          color={tokens.colors.accent}
                        />
                        <SmallOutlinePillButton
                          label={t("common.delete")}
                          onPress={async () => {
                            await deleteWallet(wallet.id);
                            await load();
                            setExpandedWalletId(null);
                          }}
                          color={tokens.colors.red}
                        />
                      </View>
                    </View>
                    </AccordionItem>
                  );
                })}
              </>
            )}
          </View>
        </GlassCardContainer>

        <GlassCardContainer contentStyle={{ gap: 12, padding: 12 }}>
          <SectionHeader title={t("wallets.list.categoriesTitle")} />
          {!showAddCategory && (
            <PrimaryPillButton
              label={t("wallets.list.addCategory", { defaultValue: t("common.add") })}
              onPress={() => setShowAddCategory(true)}
              color={tokens.colors.accent}
            />
          )}
          {showAddCategory && (
            <View style={{ gap: 10 }}>
              <View style={[styles.colorLine, { paddingVertical: 2 }]}>
                <TextInput
                  label={t("wallets.list.newCategoryLabel")}
                  value={newCategory}
                  {...inputProps}
                  style={[styles.categoryNameInput, { backgroundColor: tokens.colors.glassBg }]}
                  onChangeText={setNewCategory}
                />
                <PressScale
                  onPress={() => setNewCategoryColor((prev) => nextPresetColor(prev))}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: newCategoryColor, borderColor: tokens.colors.glassBorder },
                  ]}
                />
              </View>
              <View style={styles.actionsRow}>
                <PrimaryPillButton label={t("common.add")} onPress={addCategory} color={tokens.colors.accent} />
                <SmallOutlinePillButton
                  label={t("common.cancel")}
                  onPress={() => {
                    setShowAddCategory(false);
                    setNewCategory("");
                    setNewCategoryColor(presetColors[0]);
                  }}
                  color={tokens.colors.text}
                />
              </View>
            </View>
          )}
          {categories.length === 0 ? (
            <Text style={{ color: tokens.colors.muted }}>{t("wallets.list.noCategories")}</Text>
          ) : null}
          <View style={{ gap: 10 }}>
            {categories.map((cat) => {
              const isActive = cat.active === 1;
              const subtitle = isActive
                ? t("wallets.list.categoryActive")
                : t("wallets.list.categoryInactive");
              return (
                <AccordionItem
                  key={cat.id}
                  title={categoryEdits[cat.id]?.name ?? cat.name}
                  subtitle={subtitle}
                  icon="tag"
                  expanded={expandedCategoryId === cat.id}
                  onToggle={() => setExpandedCategoryId((prev) => (prev === cat.id ? null : cat.id))}
                >
                  <View style={[styles.sectionContent, styles.accordionInner]}>
                    <View style={[styles.colorLine, { paddingVertical: 0 }]}>
                      <TextInput
                        label="Nome categoria"
                        value={categoryEdits[cat.id]?.name ?? cat.name}
                        {...inputProps}
                        style={[styles.categoryNameInput, { backgroundColor: tokens.colors.glassBg }]}
                        onChangeText={(value) =>
                          setCategoryEdits((prev) => ({
                            ...prev,
                            [cat.id]: {
                              name: value,
                              color: prev[cat.id]?.color ?? cat.color,
                            },
                          }))
                        }
                      />
                      <PressScale
                        onPress={() =>
                          setCategoryEdits((prev) => {
                            const current = prev[cat.id]?.color ?? cat.color;
                            return {
                              ...prev,
                              [cat.id]: {
                                name: prev[cat.id]?.name ?? cat.name,
                                color: nextPresetColor(current),
                              },
                            };
                          })
                        }
                        style={[
                          styles.colorSwatch,
                          {
                            backgroundColor: categoryEdits[cat.id]?.color ?? cat.color,
                            borderColor: tokens.colors.glassBorder,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.actionsRow}>
                      <PrimaryPillButton label={t("common.save")} onPress={async () => { await saveCategory(cat.id); }} color={tokens.colors.accent} />
                      <SmallOutlinePillButton
                        label={
                          isActive
                            ? t("wallets.list.categoryDeactivate")
                            : t("wallets.list.categoryActivate")
                        }
                        onPress={async () => {
                          await setExpenseCategoryActive(cat.id, isActive ? 0 : 1);
                          await load();
                        }}
                        color={isActive ? tokens.colors.red : tokens.colors.accent}
                      />
                      <SmallOutlinePillButton
                        label={t("common.delete")}
                        onPress={async () => {
                          await removeCategory(cat.id);
                          setExpandedCategoryId(null);
                        }}
                        color={tokens.colors.red}
                      />
                    </View>
                  </View>
                </AccordionItem>
              );
            })}
          </View>
        </GlassCardContainer>

        <LimitReachedModal
          visible={limitModalVisible}
          onClose={() => setLimitModalVisible(false)}
          onUpgrade={handleOpenProStore}
        />

        <Snackbar visible={storeErrorVisible} onDismiss={() => setStoreErrorVisible(false)} duration={4000}>
          {t("wallets.actions.storeError")}
        </Snackbar>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionContent: {
    gap: 12,
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
  categoryNameInput: {
    flex: 1,
    minWidth: 160,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
});
