import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Text, TextInput } from "react-native-paper";
import { useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  createSnapshotWithLines,
  getSnapshotByDate,
  listSnapshotLines,
  listSnapshots,
  updateSnapshotWithLines,
  deleteSnapshot,
} from "@/repositories/snapshotsRepo";
import { listWallets } from "@/repositories/walletsRepo";
import { getPreference } from "@/repositories/preferencesRepo";
import type { Snapshot, SnapshotLineDetail, Wallet, Currency } from "@/repositories/types";
import { isIsoDate, todayIso } from "@/utils/dates";
import { totalsByWalletType } from "@/domain/calculations";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

type DraftLine = {
  walletId: number;
  amount: string;
};

const MONTH_LABELS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const currencySymbols: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

const currencySymbol = (currency?: Currency | null): string => {
  if (!currency) {
    return "";
  }
  return currencySymbols[currency] ?? currency;
};

const amountFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatAmount = (value: number): string => amountFormatter.format(value);

const normalizeInputAmount = (value: string): string =>
  value.replace(/\./g, "").replace(",", ".").trim();

const monthKeyFromDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
};

const monthLabelFromKey = (key: string) => {
  const [year, month] = key.split("-");
  const labelMonth = MONTH_LABELS[Number(month)];
  return `${labelMonth.slice(0, 3)} '${year.slice(-2)}`;
};

export default function SnapshotScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();
  const route = useRoute();
  const openNew = (route.params as { openNew?: boolean } | undefined)?.openNew;
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [lines, setLines] = useState<SnapshotLineDetail[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(todayIso());
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);
  const [focusedLineId, setFocusedLineId] = useState<number | null>(null);
  const inputRefs = useRef<Record<number, React.ComponentRef<typeof TextInput> | null>>({});

  const load = useCallback(async () => {
    const [snap, walletList] = await Promise.all([
      listSnapshots(),
      listWallets(true),
    ]);
    setSnapshots(snap);
    setWallets(walletList);
    const prefill = await getPreference("prefill_snapshot");
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    if (snap.length > 0 && selectedSnapshotId === null) {
      setSelectedSnapshotId(snap[0].id);
    }
  }, [selectedSnapshotId]);

  const loadLines = useCallback(async (snapshotId?: number) => {
    const targetId = snapshotId ?? selectedSnapshotId;
    if (!targetId) {
      setLines([]);
      return;
    }
    const data = await listSnapshotLines(targetId);
    setLines(data);
  }, [selectedSnapshotId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    await loadLines();
    setRefreshing(false);
  }, [load, loadLines]);

  useEffect(() => {
    if (openNew) {
      openNewSnapshot();
    }
  }, [openNew]);

  const openNewSnapshot = async () => {
    if (showForm) {
      setShowForm(false);
      setEditingSnapshotId(null);
      return;
    }
    setError(null);
    setEditingSnapshotId(null);
    const latest = snapshots[0];
    let initialLines: DraftLine[] = [];
    if (latest && prefillSnapshot) {
      const latestLines = await listSnapshotLines(latest.id);
      const latestMap = new Map<number, string>();
      latestLines.forEach((line) => {
        latestMap.set(line.wallet_id, formatAmount(line.amount));
      });
      initialLines = orderedWallets.map((wallet) => ({
        walletId: wallet.id,
        amount: latestMap.get(wallet.id) ?? formatAmount(0),
      }));
    }

    if (initialLines.length === 0) {
      initialLines = orderedWallets.map((wallet) => ({
        walletId: wallet.id,
        amount: formatAmount(0),
      }));
    }

    setDraftLines(initialLines);
    setSnapshotDate(todayIso());
    setShowForm(true);
  };

  const openEditSnapshot = async (snapshotId: number) => {
    setError(null);
    const snapshot = snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) {
      return;
    }
    const snapshotLines = await listSnapshotLines(snapshotId);
    const lineMap = new Map<number, string>();
    snapshotLines.forEach((line) => {
      lineMap.set(line.wallet_id, formatAmount(line.amount));
    });
    const initialLines = orderedWallets.map((wallet) => ({
      walletId: wallet.id,
      amount: lineMap.get(wallet.id) ?? "0",
    }));
    setDraftLines(initialLines);
    setSnapshotDate(snapshot.date);
    setEditingSnapshotId(snapshotId);
    setShowForm(true);
  };

  const updateDraftLine = (index: number, patch: Partial<DraftLine>) => {
    setDraftLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const toIsoDate = (value: Date): string => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const datePickerValue = snapshotDate && isIsoDate(snapshotDate) ? new Date(snapshotDate) : new Date();

  const confirmOverwrite = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        "Snapshot già esistente",
        "Esiste già uno snapshot per questa data. Vuoi sovrascriverlo?",
        [
          { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
          { text: "Sovrascrivi", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });

  const saveSnapshot = async () => {
    setError(null);
    if (!isIsoDate(snapshotDate)) {
      setError("Data non valida (YYYY-MM-DD).");
      return;
    }
    const cleaned = draftLines
      .map((line) => ({
        wallet_id: line.walletId,
        amount: Number(normalizeInputAmount(line.amount)),
      }))
      .filter((line) => Number.isFinite(line.amount));

    if (cleaned.length === 0) {
      setError("Inserisci almeno una linea valida.");
      return;
    }

    const existing = await getSnapshotByDate(snapshotDate);
    if (existing && existing.id !== editingSnapshotId) {
      const ok = await confirmOverwrite();
      if (!ok) {
        return;
      }
      await deleteSnapshot(existing.id);
    }

    const id = editingSnapshotId
      ? await updateSnapshotWithLines(editingSnapshotId, snapshotDate, cleaned)
      : await createSnapshotWithLines(snapshotDate, cleaned);
    setShowForm(false);
    setEditingSnapshotId(null);
    setSelectedSnapshotId(id);
    await load();
    await loadLines(id);
  };

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null,
    [snapshots, selectedSnapshotId]
  );
  const totals = useMemo(() => totalsByWalletType(lines), [lines]);
  const sortedLines = useMemo(() => [...lines].sort((a, b) => b.amount - a.amount), [lines]);
  const orderedWallets = useMemo(() => {
    const liquidity = wallets.filter((wallet) => wallet.type === "LIQUIDITY");
    const invest = wallets.filter((wallet) => wallet.type === "INVEST");
    return [...liquidity, ...invest];
  }, [wallets]);
  const walletById = useMemo(() => {
    const map = new Map<number, Wallet>();
    wallets.forEach((wallet) => map.set(wallet.id, wallet));
    return map;
  }, [wallets]);
  const totalsCurrency = useMemo<Currency | null>(() => {
    const firstLine = sortedLines[0];
    const wallet = firstLine ? walletById.get(firstLine.wallet_id) : null;
    return wallet?.currency ?? null;
  }, [sortedLines, walletById]);
  const totalsCurrencySymbol = currencySymbol(totalsCurrency);

  const monthGroups = useMemo(() => {
    const map = new Map<string, Snapshot[]>();
    const sorted = [...snapshots].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
    sorted.forEach((snapshot) => {
      const key = monthKeyFromDate(snapshot.date);
      if (!key) return;
      const collection = map.get(key) ?? [];
      collection.push(snapshot);
      map.set(key, collection);
    });
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      label: monthLabelFromKey(key),
      snapshots: list,
    }));
  }, [snapshots]);

  useEffect(() => {
    if (!activeMonthKey && monthGroups.length > 0) {
      setActiveMonthKey(monthGroups[0].key);
    }
  }, [activeMonthKey, monthGroups]);

  const activeMonth = monthGroups.find((group) => group.key === activeMonthKey) ?? monthGroups[0];
  const monthLimit = showAllMonths ? monthGroups.length : 5;
  const visibleMonthGroups = monthGroups.slice(0, monthLimit);
  const hasMoreMonths = monthGroups.length > visibleMonthGroups.length;

  useEffect(() => {
    if (!activeMonth) return;
    const contains = selectedSnapshotId
      ? activeMonth.snapshots.some((snapshot) => snapshot.id === selectedSnapshotId)
      : false;
    if (contains) return;
    const nextId = activeMonth.snapshots[0]?.id ?? null;
    if (nextId) {
      setSelectedSnapshotId(nextId);
      void loadLines(nextId);
    }
  }, [activeMonth, selectedSnapshotId, loadLines]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
        alwaysBounceVertical
        bounces
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
      >
        <PremiumCard>
          <View style={styles.actionsRow}>
            <Button
              mode="contained"
              buttonColor={tokens.colors.accent}
              style={styles.fullWidthButton}
              contentStyle={styles.fullWidthButtonContent}
              onPress={openNewSnapshot}
            >
              {t("snapshot.actions.new")}
            </Button>
          </View>
        </PremiumCard>

        {showForm && (
          <PremiumCard>
            <SectionHeader
              title={editingSnapshotId ? t("snapshot.actions.edit") : t("snapshot.actions.new")}
            />
            <View style={styles.form}>
              <TextInput
                label={t("snapshot.form.dateLabel")}
                value={snapshotDate}
                editable={false}
                mode="outlined"
                outlineColor={tokens.colors.border}
                activeOutlineColor={tokens.colors.accent}
                textColor={tokens.colors.text}
                style={{ backgroundColor: tokens.colors.surface2 }}
                onPressIn={() => setShowDatePicker(true)}
              />
              {showDatePicker && (
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selected) => {
                    if (selected) {
                      setSnapshotDate(toIsoDate(selected));
                    }
                    setShowDatePicker(false);
                  }}
                />
              )}
              {draftLines.map((line, index) => {
                const wallet = orderedWallets.find((item) => item.id === line.walletId);
                const walletTitle = wallet
                  ? wallet.type === "INVEST"
                    ? `${wallet.tag || t("wallets.snapshot.investmentTypeFallback")} - ${wallet.name} - ${
                        wallet.currency
                      }`
                    : `${wallet.name} - ${wallet.currency}`
                  : t("wallets.snapshot.walletFallback", { id: line.walletId });
                const toggleSign = () => {
                  const current = line.amount.trim();
                  const toggled = current.startsWith("-") ? current.slice(1) : current === "" ? "-" : `-${current}`;
                  updateDraftLine(index, { amount: toggled });
                  setFocusedLineId(line.walletId);
                  inputRefs.current[line.walletId]?.focus();
                };
                const onAmountChange = (value: string) => {
                  updateDraftLine(index, { amount: value });
                };
                return (
                  <PremiumCard key={`${line.walletId}-${index}`} style={{ backgroundColor: tokens.colors.surface2 }}>
                    <SectionHeader title={walletTitle} />
                    <View style={styles.lineInputRow}>
                      <TextInput
                        ref={(ref) => {
                          inputRefs.current[line.walletId] = ref;
                        }}
                        keyboardType="decimal-pad"
                        value={line.amount}
                        mode="outlined"
                        outlineColor={tokens.colors.border}
                        activeOutlineColor={tokens.colors.accent}
                        textColor={tokens.colors.text}
                        style={{ backgroundColor: tokens.colors.surface, flex: 1 }}
                        onChangeText={onAmountChange}
                        onFocus={() => setFocusedLineId(line.walletId)}
                        onBlur={() => setFocusedLineId((prev) => (prev === line.walletId ? null : prev))}
                        right={
                          focusedLineId === line.walletId ? (
                            <TextInput.Icon
                              icon="minus"
                              onPress={toggleSign}
                              forceTextInputFocus
                              color={tokens.colors.accent}
                            />
                          ) : undefined
                        }
                      />
                    </View>
                  </PremiumCard>
                );
              })}
              {error && <Text style={{ color: tokens.colors.red }}>{error}</Text>}
            </View>
            <View style={styles.actionsRow}>
              <Button mode="contained" buttonColor={tokens.colors.accent} onPress={saveSnapshot}>
                Salva
              </Button>
              <Button mode="outlined" textColor={tokens.colors.text} onPress={() => setShowForm(false)}>
                Chiudi
              </Button>
            </View>
          </PremiumCard>
        )}

        {monthGroups.length === 0 ? (
          <PremiumCard>
            <SectionHeader title={t("snapshot.title")} />
            <Text style={{ color: tokens.colors.muted, padding: 16 }}>
              {t("snapshot.empty.noSnapshots")}
            </Text>
          </PremiumCard>
        ) : (
          <>
            <PremiumCard>
              <SectionHeader title={t("snapshot.filter.byMonth")} />
              <View style={styles.monthRow}>
                {visibleMonthGroups.map((group) => (
                  <Button
                    key={group.key}
                    mode={group.key === activeMonthKey ? "contained" : "outlined"}
                    buttonColor={group.key === activeMonthKey ? tokens.colors.accent : undefined}
                    contentStyle={styles.monthButtonContent}
                    style={styles.monthButton}
                    textColor={group.key === activeMonthKey ? tokens.colors.text : tokens.colors.muted}
                    onPress={() => {
                      setActiveMonthKey(group.key);
                    }}
                  >
                    {group.label}
                  </Button>
                ))}
                {hasMoreMonths && (
                  <Button
                    mode="outlined"
                    contentStyle={styles.monthButtonContent}
                    style={styles.monthButton}
                    textColor={tokens.colors.text}
                    onPress={() => setShowAllMonths(true)}
                  >
                    {t("snapshot.actions.loadMore")}
                  </Button>
                )}
              </View>
            </PremiumCard>
            <PremiumCard>
              <SectionHeader
                title={
                  activeMonth?.label
                    ? `${t("snapshot.title")} ${activeMonth.label}`
                    : t("snapshot.title")
                }
              />
              <View style={styles.list}>
                {activeMonth?.snapshots.map((snapshot) => (
                  <Button
                    key={snapshot.id}
                    onPress={() => {
                      setSelectedSnapshotId(snapshot.id);
                      void loadLines(snapshot.id);
                    }}
                    mode={snapshot.id === selectedSnapshotId ? "contained" : "outlined"}
                    buttonColor={snapshot.id === selectedSnapshotId ? tokens.colors.accent : undefined}
                    textColor={snapshot.id === selectedSnapshotId ? tokens.colors.text : tokens.colors.muted}
                  >
                    {snapshot.date}
                  </Button>
                ))}
              </View>
            </PremiumCard>
          </>
        )}

        <PremiumCard>
          <SectionHeader title={t("snapshot.detail.title")} />
          <View style={styles.list}>
            {lines.length === 0 && (
              <Text style={{ color: tokens.colors.muted }}>
                {t("snapshot.detail.emptyLines")}
              </Text>
            )}
            {sortedLines.map((line) => {
              const walletLabel =
                line.wallet_type === "INVEST" && line.wallet_tag
                  ? `${line.wallet_tag} • ${line.wallet_name ?? t("wallets.snapshot.unknown")}`
                  : line.wallet_name ?? t("wallets.snapshot.unknown");
              const wallet = walletById.get(line.wallet_id);
              const currencySuffix = wallet ? currencySymbol(wallet.currency) : "";
              return (
                <Text key={line.id} style={{ color: tokens.colors.text }}>
                  {walletLabel} • {formatAmount(line.amount)}
                  {currencySuffix ? ` ${currencySuffix}` : ""}
                </Text>
              );
            })}
            {lines.length > 0 && (
              <View style={styles.totals}>
                <Text style={{ color: tokens.colors.muted }}>
                  {t("snapshot.totals.liquidity")}: {formatAmount(totals.liquidity)}
                  {totalsCurrencySymbol ? ` ${totalsCurrencySymbol}` : ""}
                </Text>
                <Text style={{ color: tokens.colors.muted }}>
                  {t("snapshot.totals.investments")}: {formatAmount(totals.investments)}
                  {totalsCurrencySymbol ? ` ${totalsCurrencySymbol}` : ""}
                </Text>
                <Text style={{ color: tokens.colors.text }}>
                  {t("snapshot.totals.netWorth")}: {formatAmount(totals.netWorth)}
                  {totalsCurrencySymbol ? ` ${totalsCurrencySymbol}` : ""}
                </Text>
              </View>
            )}
            {selectedSnapshotId && (
              <View style={styles.editButtonRow}>
                <Button
                  mode="outlined"
                  textColor={tokens.colors.accent}
                  style={{ borderColor: tokens.colors.accent }}
                  onPress={() => openEditSnapshot(selectedSnapshotId)}
                >
                  {t("snapshot.actions.edit")}
                </Button>
              </View>
            )}
          </View>
        </PremiumCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  form: {
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    width: "100%",
    alignItems: "stretch",
  },
  fullWidthButton: {
    alignSelf: "stretch",
    flex: 1,
  },
  fullWidthButtonContent: {
    width: "100%",
  },
  list: {
    gap: 8,
  },
  totals: {
    marginTop: 8,
    gap: 4,
  },
  monthRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  monthButton: {
    borderRadius: 999,
    minHeight: 44,
  },
  monthButtonContent: {
    paddingHorizontal: 16,
    height: 44,
    justifyContent: "center",
  },
  lineInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  editButtonRow: {
    marginTop: 12,
    alignItems: "flex-start",
  },
});
