import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper";
import { useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { listIncomeEntries, createIncomeEntry, updateIncomeEntry, deleteIncomeEntry } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries, createExpenseEntry, updateExpenseEntry, deleteExpenseEntry } from "@/repositories/expenseEntriesRepo";
import { listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import type { ExpenseCategory, ExpenseEntry, IncomeEntry, RecurrenceFrequency } from "@/repositories/types";
import { isIsoDate, todayIso } from "@/utils/dates";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import Chip from "@/ui/dashboard/components/Chip";
import { formatEUR, formatShortDate } from "@/ui/dashboard/formatters";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

type Mode = "income" | "expense";


type FormState = {
  id: number | null;
  name: string;
  amount: string;
  startDate: string;
  categoryId: string;
  active: boolean;
  recurring: boolean;
  frequency: RecurrenceFrequency;
  interval: string;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  amount: "",
  startDate: todayIso(),
  categoryId: "",
  active: true,
  recurring: false,
  frequency: "MONTHLY",
  interval: "1",
};

export default function EntriesScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute();
  const scrollRef = useRef<ScrollView | null>(null);
  const routeMode = (route.params as { mode?: Mode; entryId?: number } | undefined)?.mode;
  const routeEntryId = (route.params as { mode?: Mode; entryId?: number } | undefined)?.entryId;
  const [mode, setMode] = useState<Mode>(routeMode ?? "income");
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);

  const load = useCallback(async () => {
    const [income, expense, cats] = await Promise.all([
      listIncomeEntries(),
      listExpenseEntries(),
      listExpenseCategories(),
    ]);
    setIncomeEntries(income);
    setExpenseEntries(expense);
    setCategories(cats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    if (routeMode) {
      setMode(routeMode);
    }
  }, [routeMode]);

  useEffect(() => {
    if (!routeEntryId) return;
    if (form.id === routeEntryId) return;
    const entryMode: Mode = routeMode ?? "income";
    const entriesList = entryMode === "income" ? incomeEntries : expenseEntries;
    const found = entriesList.find((entry) => entry.id === routeEntryId);
    if (found) {
      applyEntryToForm(found, entryMode);
      setShowNewEntry(true);
    }
  }, [routeEntryId, routeMode, incomeEntries, expenseEntries, form.id]);

  const applyEntryToForm = (entry: IncomeEntry | ExpenseEntry, entryMode: Mode) => {
    setMode(entryMode);
    setForm({
      id: entry.id,
      name: entry.name,
      amount: String(entry.amount),
      startDate: entry.start_date,
      categoryId: "expense_category_id" in entry ? String(entry.expense_category_id) : "",
      active: entry.active === 1,
      recurring: entry.recurrence_frequency !== null && entry.one_shot === 0,
      frequency: entry.recurrence_frequency ?? "MONTHLY",
      interval: entry.recurrence_interval?.toString() ?? "1",
    });
  };

  const saveEntry = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Nome obbligatorio.");
      return;
    }
    if (!isIsoDate(form.startDate)) {
      setError("Data non valida (YYYY-MM-DD).");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount)) {
      setError("Importo non valido.");
      return;
    }
    const recurring = form.recurring;
    const frequency = recurring ? form.frequency : null;
    const interval = recurring ? Number(form.interval) || 1 : null;
    const oneShot = recurring ? 0 : 1;
    const active = form.active ? 1 : 0;

    if (mode === "income") {
      const payload: Omit<IncomeEntry, "id"> = {
        name: form.name.trim(),
        amount,
        start_date: form.startDate,
        recurrence_frequency: frequency,
        recurrence_interval: interval,
        one_shot: oneShot,
        note: null,
        active,
        wallet_id: null,
      };
      if (form.id) {
        await updateIncomeEntry(form.id, payload);
      } else {
        await createIncomeEntry(payload);
      }
    } else {
      const categoryId = Number(form.categoryId);
      if (!Number.isFinite(categoryId)) {
        setError("Categoria obbligatoria.");
        return;
      }
      const payload: Omit<ExpenseEntry, "id"> = {
        name: form.name.trim(),
        amount,
        start_date: form.startDate,
        recurrence_frequency: frequency,
        recurrence_interval: interval,
        one_shot: oneShot,
        note: null,
        active,
        wallet_id: null,
        expense_category_id: categoryId,
      };
      if (form.id) {
        await updateExpenseEntry(form.id, payload);
      } else {
        await createExpenseEntry(payload);
      }
    }

    setForm(emptyForm);
    await load();
  };

  const removeEntry = async () => {
    if (!form.id) return;
    if (mode === "income") {
      await deleteIncomeEntry(form.id);
    } else {
      await deleteExpenseEntry(form.id);
    }
    setForm(emptyForm);
    await load();
  };

  const entries = mode === "income" ? incomeEntries : expenseEntries;

  const activeCategories = useMemo(() => categories.filter((cat) => cat.active === 1), [categories]);
  const categoryById = useMemo(() => {
    const map = new Map<number, ExpenseCategory>();
    categories.forEach((cat) => map.set(cat.id, cat));
    return map;
  }, [categories]);

  const toIsoDate = (value: Date): string => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const datePickerValue = form.startDate && isIsoDate(form.startDate) ? new Date(form.startDate) : new Date();

  const toAnnualAmount = (entry: IncomeEntry | ExpenseEntry): number | null => {
    if (entry.one_shot === 1 || !entry.recurrence_frequency) return null;
    const interval = entry.recurrence_interval && entry.recurrence_interval > 0 ? entry.recurrence_interval : 1;
    const periods =
      entry.recurrence_frequency === "WEEKLY"
        ? 52 / interval
        : entry.recurrence_frequency === "MONTHLY"
          ? 12 / interval
          : 1 / interval;
    return entry.amount * periods;
  };

  const sortedEntries = useMemo(() => {
    const getAnnualForSort = (entry: IncomeEntry | ExpenseEntry) => toAnnualAmount(entry) ?? 0;
    return [...entries].sort((a, b) => getAnnualForSort(b) - getAnnualForSort(a));
  }, [entries]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
        alwaysBounceVertical
        bounces
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
      >
        <PremiumCard>
          <SectionHeader title="Seleziona il tipo" />
          <SegmentedButtons
            value={mode}
            onValueChange={(value) => setMode(value as Mode)}
            buttons={[
              { value: "income", label: "Entrate" },
              { value: "expense", label: "Uscite" },
            ]}
            style={{ backgroundColor: tokens.colors.surface2 }}
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader
            title="Aggiungi una nuova voce"
            trailing={
              <Button
                mode="contained"
                buttonColor={tokens.colors.accent}
                style={styles.addButton}
                contentStyle={styles.addButtonContent}
                labelStyle={styles.addButtonLabel}
                onPress={() => setShowNewEntry((prev) => !prev)}
              >
                <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
              </Button>
            }
          />
          {showNewEntry ? (
            <>
              <View style={styles.form}>
                <TextInput
                  label="Nome"
                  value={form.name}
                  mode="outlined"
                  outlineColor={tokens.colors.border}
                  activeOutlineColor={tokens.colors.accent}
                  textColor={tokens.colors.text}
                  style={{ backgroundColor: tokens.colors.surface2 }}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                />
                <TextInput
                  label="Importo"
                  keyboardType="decimal-pad"
                  value={form.amount}
                  mode="outlined"
                  outlineColor={tokens.colors.border}
                  activeOutlineColor={tokens.colors.accent}
                  textColor={tokens.colors.text}
                  style={{ backgroundColor: tokens.colors.surface2 }}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, amount: text }))}
                />
                <TextInput
                  label="Data"
                  value={form.startDate}
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
                        setForm((prev) => ({ ...prev, startDate: toIsoDate(selected) }));
                      }
                      setShowDatePicker(false);
                    }}
                  />
                )}
                {mode === "expense" && (
                  <PremiumCard style={{ backgroundColor: tokens.colors.surface2 }}>
                    <SectionHeader title="Categoria spesa" />
                    <View style={styles.list}>
                      {activeCategories.length === 0 && (
                        <Text style={{ color: tokens.colors.muted }}>
                          Nessuna categoria attiva. Aggiungine una qui sotto.
                        </Text>
                      )}
                      {activeCategories.map((cat) => (
                        <Button
                          key={cat.id}
                          mode={form.categoryId === String(cat.id) ? "contained" : "outlined"}
                          buttonColor={form.categoryId === String(cat.id) ? cat.color : undefined}
                          textColor={form.categoryId === String(cat.id) ? tokens.colors.text : tokens.colors.muted}
                          onPress={() => setForm((prev) => ({ ...prev, categoryId: String(cat.id) }))}
                          style={
                            form.categoryId !== String(cat.id)
                              ? { borderColor: cat.color }
                              : undefined
                          }
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </View>
                  </PremiumCard>
                )}
                <View style={styles.row}>
                  <Switch
                    value={form.recurring}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, recurring: value }))}
                  />
                  <Text style={{ color: tokens.colors.text }}>Ricorrente</Text>
                </View>
                {form.recurring && (
                  <>
                    <SegmentedButtons
                      value={form.frequency}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, frequency: value as RecurrenceFrequency }))}
                      buttons={[
                        { value: "WEEKLY", label: "Weekly" },
                        { value: "MONTHLY", label: "Monthly" },
                        { value: "YEARLY", label: "Yearly" },
                      ]}
                      style={{ backgroundColor: tokens.colors.surface2 }}
                    />
                    <TextInput
                      label="Intervallo"
                      keyboardType="numeric"
                      value={form.interval}
                      mode="outlined"
                      outlineColor={tokens.colors.border}
                      activeOutlineColor={tokens.colors.accent}
                      textColor={tokens.colors.text}
                      style={{ backgroundColor: tokens.colors.surface2 }}
                      onChangeText={(text) => setForm((prev) => ({ ...prev, interval: text }))}
                    />
                  </>
                )}
                {error && <Text style={{ color: tokens.colors.red }}>{error}</Text>}
              </View>
              <View style={styles.actionsRow}>
                <Button mode="contained" buttonColor={tokens.colors.accent} onPress={saveEntry}>
                  Salva
                </Button>
                <Button mode="outlined" textColor={tokens.colors.text} onPress={() => setForm(emptyForm)}>
                  Reset
                </Button>
                {form.id && (
                  <Button mode="outlined" textColor={tokens.colors.red} onPress={removeEntry}>
                    Elimina
                  </Button>
                )}
              </View>
            </>
          ) : null}
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Lista" />
          {entries.length === 0 ? (
            <Text style={{ color: tokens.colors.muted }}>Nessuna voce.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.table}>
              <View>
                <View style={styles.headerRow}>
                  <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDate]} numberOfLines={1}>
                    Data
                  </Text>
                  <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellDesc]} numberOfLines={1}>
                    Nome
                  </Text>
                  <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellAmount]} numberOfLines={1}>
                    Importo
                  </Text>
                  <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellAnnual]} numberOfLines={1}>
                    Importo annuo
                  </Text>
                  <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellCategory]} numberOfLines={1}>
                    Categoria
                  </Text>
                  <Text style={[styles.headerCell, { color: tokens.colors.muted }, styles.cellAction]} numberOfLines={1}>
                    Modifica
                  </Text>
                </View>
                {sortedEntries.map((entry, index) => {
                  const annualAmount = toAnnualAmount(entry);
                  const category =
                    "expense_category_id" in entry
                      ? categoryById.get(entry.expense_category_id)
                      : null;
                  return (
                    <React.Fragment key={`${mode}-${entry.id}`}>
                      <View style={styles.row}>
                        <Text style={[styles.cell, { color: tokens.colors.text }, styles.cellDate]}>
                          {formatShortDate(entry.start_date)}
                        </Text>
                        <Text style={[styles.cell, { color: tokens.colors.text }, styles.cellDesc]} numberOfLines={1}>
                          {entry.name}
                        </Text>
                        <Text style={[styles.cell, { color: tokens.colors.text }, styles.cellAmount]}>
                          {formatEUR(entry.amount)}
                        </Text>
                        <Text style={[styles.cell, { color: tokens.colors.muted }, styles.cellAnnual]}>
                          {annualAmount === null ? "—" : formatEUR(annualAmount)}
                        </Text>
                        <View style={[styles.cell, styles.cellCategory]}>
                          {"expense_category_id" in entry ? (
                            <Chip label={category?.name ?? "Senza categoria"} color={category?.color} />
                          ) : (
                            <Chip label="Entrata" tone="green" />
                          )}
                        </View>
                        <View style={[styles.cell, styles.cellAction]}>
                          <PressScale
                            onPress={() => {
                              applyEntryToForm(entry, mode);
                              setShowNewEntry(true);
                              scrollRef.current?.scrollTo({ y: 0, animated: true });
                            }}
                            style={[
                              styles.actionButton,
                              { borderColor: tokens.colors.accent, backgroundColor: `${tokens.colors.accent}14` },
                            ]}
                          >
                            <Text style={[styles.actionText, { color: tokens.colors.accent }]}>Modifica</Text>
                          </PressScale>
                        </View>
                      </View>
                      {index < entries.length - 1 ? (
                        <View style={[styles.separator, { backgroundColor: tokens.colors.border }]} />
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </View>
            </ScrollView>
          )}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    flexWrap: "wrap",
  },
  addButton: {
    borderRadius: 12,
    minWidth: 44,
  },
  addButtonContent: {
    height: 44,
    width: 44,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonLabel: {
    marginVertical: 0,
  },
  list: {
    gap: 8,
  },
  table: {
    gap: 12,
    paddingBottom: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8,
    flexWrap: "nowrap",
    width: 760,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    flexWrap: "nowrap",
    width: 760,
  },
  cell: {
    fontSize: 12,
    minWidth: 0,
  },
  cellDate: {
    width: 80,
    flexShrink: 0,
    marginRight: 6,
  },
  cellDesc: {
    width: 180,
    flexShrink: 1,
    marginRight: 6,
  },
  cellCategory: {
    width: 140,
    flexShrink: 0,
    marginRight: 6,
  },
  cellAmount: {
    width: 110,
    flexShrink: 0,
    marginRight: 6,
  },
  cellAnnual: {
    width: 140,
    flexShrink: 0,
  },
  cellAction: {
    width: 90,
    flexShrink: 0,
    marginLeft: 6,
  },
  separator: {
    height: 1,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
