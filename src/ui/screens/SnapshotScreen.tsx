import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Text, TextInput } from "react-native-paper";
import { useRoute } from "@react-navigation/native";
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
import type { Snapshot, SnapshotLineDetail, Wallet } from "@/repositories/types";
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
    setError(null);
    setEditingSnapshotId(null);
    const latest = snapshots[0];
    let initialLines: DraftLine[] = [];
    if (latest && prefillSnapshot) {
      const latestLines = await listSnapshotLines(latest.id);
      const latestMap = new Map<number, string>();
      latestLines.forEach((line) => {
        latestMap.set(line.wallet_id, line.amount.toString());
      });
      initialLines = orderedWallets.map((wallet) => ({
        walletId: wallet.id,
        amount: latestMap.get(wallet.id) ?? "0",
      }));
    }

    if (initialLines.length === 0) {
      initialLines = orderedWallets.map((wallet) => ({
        walletId: wallet.id,
        amount: "0",
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
      lineMap.set(line.wallet_id, line.amount.toString());
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
        amount: Number(line.amount.replace(",", ".").trim()),
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

  const totals = useMemo(() => totalsByWalletType(lines), [lines]);
  const sortedLines = useMemo(() => [...lines].sort((a, b) => b.amount - a.amount), [lines]);
  const orderedWallets = useMemo(() => {
    const liquidity = wallets.filter((wallet) => wallet.type === "LIQUIDITY");
    const invest = wallets.filter((wallet) => wallet.type === "INVEST");
    return [...liquidity, ...invest];
  }, [wallets]);

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
      void openEditSnapshot(nextId);
    }
  }, [activeMonth, selectedSnapshotId]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView
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
              Nuovo Snapshot
            </Button>
          </View>
        </PremiumCard>

        {showForm && (
          <PremiumCard>
            <SectionHeader title={editingSnapshotId ? "Modifica snapshot" : "Nuovo snapshot"} />
            <View style={styles.form}>
              <TextInput
                label="Data"
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
                    ? `${wallet.tag || "Tipo investimento"} - ${wallet.name} - ${wallet.currency}`
                    : `${wallet.name} - ${wallet.currency}`
                  : `Wallet #${line.walletId}`;
                return (
                  <PremiumCard key={`${line.walletId}-${index}`} style={{ backgroundColor: tokens.colors.surface2 }}>
                    <SectionHeader title={walletTitle} />
                    <TextInput
                      keyboardType="decimal-pad"
                      value={line.amount}
                      mode="outlined"
                      outlineColor={tokens.colors.border}
                      activeOutlineColor={tokens.colors.accent}
                      textColor={tokens.colors.text}
                      style={{ backgroundColor: tokens.colors.surface }}
                      onChangeText={(value) => updateDraftLine(index, { amount: value })}
                    />
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
            <SectionHeader title="Snapshot" />
            <Text style={{ color: tokens.colors.muted, padding: 16 }}>Nessuno snapshot.</Text>
          </PremiumCard>
        ) : (
          <>
            <PremiumCard>
              <SectionHeader title="Filtra snapshot per mese" />
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
                    Carica altri
                  </Button>
                )}
              </View>
            </PremiumCard>
            <PremiumCard>
              <SectionHeader title={`Snapshot ${activeMonth?.label ?? ""}`} />
              <View style={styles.list}>
                {activeMonth?.snapshots.map((snapshot) => (
                  <Button
                    key={snapshot.id}
                    onPress={() => {
                      setSelectedSnapshotId(snapshot.id);
                      void openEditSnapshot(snapshot.id);
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
          <SectionHeader title="Dettaglio" />
          <View style={styles.list}>
            {lines.length === 0 && <Text style={{ color: tokens.colors.muted }}>Nessuna linea.</Text>}
            {sortedLines.map((line) => (
              <Text key={line.id} style={{ color: tokens.colors.text }}>
                {line.wallet_name ?? "Sconosciuto"} • {line.amount.toFixed(2)}
              </Text>
            ))}
            {lines.length > 0 && (
              <View style={styles.totals}>
                <Text style={{ color: tokens.colors.muted }}>Liquidità: {totals.liquidity.toFixed(2)}</Text>
                <Text style={{ color: tokens.colors.muted }}>Investimenti: {totals.investments.toFixed(2)}</Text>
                <Text style={{ color: tokens.colors.text }}>Patrimonio: {totals.netWorth.toFixed(2)}</Text>
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
});
