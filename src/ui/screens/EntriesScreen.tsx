import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { listIncomeEntries, createIncomeEntry, updateIncomeEntry, deleteIncomeEntry } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries, createExpenseEntry, updateExpenseEntry, deleteExpenseEntry } from "@/repositories/expenseEntriesRepo";
import { listExpenseCategories } from "@/repositories/expenseCategoriesRepo";
import type { ExpenseCategory, ExpenseEntry, IncomeEntry, RecurrenceFrequency } from "@/repositories/types";
import { isIsoDate, todayIso } from "@/utils/dates";
import { formatEUR, formatShortDate } from "@/ui/dashboard/formatters";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import AppBackground from "@/ui/components/AppBackground";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { onDataReset } from "@/app/dataEvents";
import EntriesTable, { EntriesTableRow } from "@/ui/dashboard/components/EntriesTable";
import {
  FrequencyPillGroup,
  GlassCardContainer,
  PrimaryPillButton,
  SegmentedControlPill,
  SmallOutlinePillButton,
} from "@/ui/components/EntriesUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type EntryType = "income" | "expense";
type FormMode = "create" | "edit";
type CategoryFilter = "all" | number;

type EntriesRouteParams = {
  entryType?: EntryType;
  formMode?: FormMode;
  entryId?: number;
};

type FormState = {
  id: number | null;
  name: string;
  amount: string;
  startDate: string;
  categoryId: string;
  active: boolean;
  recurring: boolean;
  frequency: RecurrenceFrequency;
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
};

export default function EntriesScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const scrollRef = useRef<ScrollView | null>(null);
  const routeParams = (route.params ?? {}) as EntriesRouteParams;
  const [entryType, setEntryType] = useState<EntryType>(routeParams.entryType ?? "income");
  const [formMode, setFormMode] = useState<FormMode>(routeParams.formMode ?? "create");
  const [editingId, setEditingId] = useState<number | null>(
    routeParams.formMode === "edit" ? routeParams.entryId ?? null : null
  );
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(routeParams.formMode === "edit");

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

  const refreshAll = useCallback(async () => {
    await load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void refreshAll();
      return undefined;
    }, [refreshAll])
  );

  useEffect(() => {
    const subscription = onDataReset(() => {
      void refreshAll();
    });
    return () => subscription.remove();
  }, [refreshAll]);

  useEffect(() => {
    if (routeParams.entryType) {
      setEntryType(routeParams.entryType);
    }
  }, [routeParams.entryType]);

  useEffect(() => {
    const nextFormMode = routeParams.formMode;
    if (nextFormMode === "edit" && typeof routeParams.entryId === "number") {
      const targetType = routeParams.entryType ?? entryType;
      const entriesList = targetType === "income" ? incomeEntries : expenseEntries;
      const found = entriesList.find((entry) => entry.id === routeParams.entryId);
      if (found) {
        applyEntryToForm(found, targetType);
        setShowNewEntry(true);
      }
      return;
    }
    if (nextFormMode === "create") {
      setFormMode("create");
      setEditingId(null);
      setForm(emptyForm);
      setShowNewEntry(true);
    }
  }, [routeParams.formMode, routeParams.entryId, routeParams.entryType, incomeEntries, expenseEntries]);

  useEffect(() => {
    // reset category filter when switching to income
    if (entryType === "income") {
      setCategoryFilter("all");
    }
  }, [entryType]);

  const applyEntryToForm = (entry: IncomeEntry | ExpenseEntry, entryMode: EntryType) => {
    setEntryType(entryMode);
    setForm({
      id: entry.id,
      name: entry.name,
      amount: String(entry.amount),
      startDate: entry.start_date,
      categoryId: "expense_category_id" in entry ? String(entry.expense_category_id) : "",
      active: entry.active === 1,
      recurring: entry.recurrence_frequency !== null && entry.one_shot === 0,
      frequency: entry.recurrence_frequency ?? "MONTHLY",
    });
    setFormMode("edit");
    setEditingId(entry.id);
  };

  const resetToCreateMode = () => {
    setForm(emptyForm);
    setFormMode("create");
    setEditingId(null);
    (navigation as any).setParams({ formMode: "create", entryId: undefined, entryType });
  };

  const toggleNewEntryVisibility = () => {
    setShowNewEntry((prev) => {
      const next = !prev;
      if (next) {
        resetToCreateMode();
      }
      return next;
    });
  };

  const saveEntry = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError(t("entries.validation.nameRequired"));
      return;
    }
    if (!isIsoDate(form.startDate)) {
      setError(t("entries.validation.invalidDate"));
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount)) {
      setError(t("entries.validation.amountInvalid"));
      return;
    }
    const recurring = form.recurring;
    const frequency = recurring ? form.frequency : null;
    const interval = recurring ? 1 : null;
    const oneShot = recurring ? 0 : 1;
    const active = form.active ? 1 : 0;

    if (formMode === "create" && form.id) {
      setError(t("entries.validation.removeIdBeforeCreate"));
      return;
    }
    if (formMode === "edit" && !form.id) {
      setError(t("entries.validation.noEntryForEdit"));
      return;
    }

    if (entryType === "income") {
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
      if (formMode === "edit") {
        await updateIncomeEntry(form.id!, payload);
      } else {
        await createIncomeEntry(payload);
      }
    } else {
      const categoryId = Number(form.categoryId);
      if (!Number.isFinite(categoryId)) {
        setError(t("entries.validation.categoryRequired"));
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
      if (formMode === "edit") {
        await updateExpenseEntry(form.id!, payload);
      } else {
        await createExpenseEntry(payload);
      }
    }

    resetToCreateMode();
    setShowNewEntry(true);
    await load();
  };

  const removeEntry = async () => {
    if (formMode !== "edit" || !form.id) return;
    if (entryType === "income") {
      await deleteIncomeEntry(form.id);
    } else {
      await deleteExpenseEntry(form.id);
    }
    resetToCreateMode();
    setShowNewEntry(true);
    await load();
  };

  const entries = entryType === "income" ? incomeEntries : expenseEntries;
  const { width } = useWindowDimensions();

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

  const formatIsoToDMY = (iso: string) => {
    if (!isIsoDate(iso)) return iso;
    const date = new Date(iso);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  };

  const filteredEntries = useMemo(() => {
    if (entryType === "income") return entries;
    return entries.filter((entry) => {
      if (categoryFilter === "all") return true;
      return entry.expense_category_id === categoryFilter;
    });
  }, [entries, entryType, categoryFilter]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      if (a.start_date < b.start_date) return -1;
      if (a.start_date > b.start_date) return 1;
      return 0;
    });
  }, [filteredEntries]);

  const entryAccent = entryType === "income" ? tokens.colors.income : tokens.colors.expense;

  const tableRows = useMemo<EntriesTableRow<(IncomeEntry | ExpenseEntry) | null>[]>(
    () =>
      sortedEntries.map((item) => {
        const amountAbs = Math.abs(item.amount);
        const amountText = `${entryType === "income" ? "+" : "-"} ${formatEUR(amountAbs)}`;
        const dateLabel = formatShortDate(item.start_date);
        const category =
          "expense_category_id" in item ? categoryById.get(item.expense_category_id) : null;
        const categoryLabel =
          entryType === "income"
            ? t("entries.list.incomeLabel")
            : category?.name ?? t("entries.list.categoryFallback");
        const categoryColor =
          entryType === "income" ? tokens.colors.income : category?.color ?? tokens.colors.expense;
        const frequencyKey =
          item.recurrence_frequency && typeof item.recurrence_frequency === "string"
            ? (`entries.form.frequency.${item.recurrence_frequency.toLowerCase()}` as const)
            : null;

        return {
          id: item.id,
          dateLabel,
          amountLabel: amountText,
          amountTone: entryType,
          amountColor: entryType === "income" ? tokens.colors.income : tokens.colors.expense,
          name: item.name,
          subtitle: frequencyKey ? t(frequencyKey) : undefined,
          categoryLabel,
          categoryColor,
          meta: item,
        };
      }),
    [sortedEntries, entryType, categoryById, tokens.colors.income, tokens.colors.expense, t]
  );

  const scrollToForm = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const handleRowAction = useCallback(
    (entry: IncomeEntry | ExpenseEntry) => {
      (navigation as any).setParams({
        formMode: "edit",
        entryId: entry.id,
        entryType,
      });
      setShowNewEntry(true);
      scrollToForm();
    },
    [entryType, navigation, scrollToForm]
  );

  return (
    <AppBackground>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.lg, paddingBottom: 140 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
      >
        <GlassCardContainer contentStyle={{ gap: tokens.spacing.md }}>
          <SegmentedControlPill
            value={entryType}
            onChange={(next) => setEntryType(next as EntryType)}
            options={[
              { value: "income", label: t("entries.list.tabIncome"), tint: `${tokens.colors.income}44` },
              { value: "expense", label: t("entries.list.tabExpense"), tint: `${tokens.colors.expense}33` },
            ]}
          />

          <PrimaryPillButton
            label={showNewEntry ? t("common.cancel") : t("entries.actions.toggleForm")}
            onPress={() => {
              toggleNewEntryVisibility();
              setTimeout(scrollToForm, 80);
            }}
            color={tokens.colors.purplePrimary}
          />
        </GlassCardContainer>

        {showNewEntry && (
          <GlassCardContainer>
            <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>{t("entries.form.newEntryTitle") ?? "New Entry"}</Text>
            <View style={{ gap: 12 }}>
              <TextInput
                label={t("entries.form.name")}
                value={form.name}
                mode="outlined"
                outlineColor={tokens.colors.glassBorder}
                activeOutlineColor={entryAccent}
                textColor={tokens.colors.text}
                style={[styles.glassInput, { backgroundColor: tokens.colors.glassBg }]}
                onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
              />
              <View style={styles.inlineInputs}>
                <TextInput
                  label={t("entries.form.amount")}
                  keyboardType="decimal-pad"
                  value={form.amount}
                  mode="outlined"
                  outlineColor={entryAccent}
                  activeOutlineColor={entryAccent}
                  textColor={tokens.colors.text}
                  style={[styles.glassInput, styles.flex, { backgroundColor: tokens.colors.glassBg }]}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, amount: text }))}
                />
                <TextInput
                  label={t("entries.form.date")}
                  value={formatIsoToDMY(form.startDate)}
                  editable={false}
                  mode="outlined"
                  outlineColor={tokens.colors.glassBorder}
                  activeOutlineColor={tokens.colors.accent}
                  textColor={tokens.colors.text}
                  right={<TextInput.Icon icon="calendar" />}
                  style={[styles.glassInput, styles.flex, { backgroundColor: tokens.colors.glassBg }]}
                  onPressIn={() => setShowDatePicker((prev) => !prev)}
                />
              </View>
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

              {entryType === "expense" && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: tokens.colors.muted }}>{t("entries.form.categoryTitle")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {activeCategories.length === 0 ? (
                      <Text style={{ color: tokens.colors.muted }}>
                        {t("entries.empty.noCategoriesActivePrefix")}
                        {" "}
                        <Text
                          style={[styles.categoryLink, { color: tokens.colors.accent }]}
                          onPress={() => {
                            navigation.navigate("Wallet", { startCategory: true });
                          }}
                        >
                          {t("entries.empty.noCategoriesActiveLink")}
                        </Text>
                      </Text>
                    ) : null}
                    {activeCategories.map((cat) => {
                      const selected = form.categoryId === String(cat.id);
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => setForm((prev) => ({ ...prev, categoryId: String(cat.id) }))}
                          style={[
                            styles.categoryChip,
                            {
                              borderColor: selected ? cat.color : tokens.colors.glassBorder,
                              backgroundColor: selected ? `${cat.color}33` : tokens.colors.glassBg,
                            },
                          ]}
                        >
                          <Text style={{ color: selected ? tokens.colors.text : tokens.colors.muted }}>{cat.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={[styles.inlineInputs, { alignItems: "center" }]}>
                <Text style={{ color: tokens.colors.text, flex: 1 }}>{t("entries.form.recurringLabel")}</Text>
                <Switch
                  value={form.recurring}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, recurring: value }))}
                  color={entryAccent}
                />
              </View>

              {form.recurring && (
                <FrequencyPillGroup
                  value={form.frequency}
                  onChange={(next) => setForm((prev) => ({ ...prev, frequency: next as RecurrenceFrequency }))}
                  options={[
                    { value: "WEEKLY", label: t("entries.form.frequency.weekly"), tint: `${entryAccent}33` },
                    { value: "MONTHLY", label: t("entries.form.frequency.monthly"), tint: `${entryAccent}33` },
                    { value: "YEARLY", label: t("entries.form.frequency.yearly"), tint: `${entryAccent}33` },
                  ]}
                />
              )}

              {error && <Text style={{ color: tokens.colors.expense }}>{error}</Text>}

              <View style={styles.actionsRow}>
                <Button mode="contained" buttonColor={entryAccent} textColor="#0B0B0B" onPress={saveEntry} style={styles.flex}>
                  {t("common.save")}
                </Button>
                <Button mode="outlined" textColor={tokens.colors.text} onPress={() => setForm(emptyForm)} style={styles.flex}>
                  {t("common.reset")}
                </Button>
                {form.id && (
                  <Button mode="outlined" textColor={tokens.colors.expense} onPress={removeEntry} style={styles.flex}>
                    {t("common.delete")}
                  </Button>
                )}
              </View>
            </View>
          </GlassCardContainer>
        )}

        <GlassCardContainer contentStyle={styles.entriesTableCard}>
          {entryType === "expense" && activeCategories.length > 0 ? (
            <View style={styles.filterSection}>
              <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>
                {t("entries.list.filterByCategory", { defaultValue: "Filtra per categoria" })}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.filterRow, { paddingHorizontal: 4 }]}
              >
                <Pressable
                  onPress={() => setCategoryFilter("all")}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: categoryFilter === "all" ? tokens.colors.accent : tokens.colors.glassBorder,
                      backgroundColor: categoryFilter === "all" ? `${tokens.colors.accent}22` : tokens.colors.glassBg,
                    },
                  ]}
                >
                  <Text style={{ color: tokens.colors.text, fontWeight: "600" }}>
                    {t("common.all", { defaultValue: "Tutti" })}
                  </Text>
                </Pressable>
                {activeCategories.map((cat) => {
                  const selected = categoryFilter === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategoryFilter(cat.id)}
                      style={[
                        styles.filterChip,
                        {
                          borderColor: selected ? cat.color : tokens.colors.glassBorder,
                          backgroundColor: selected ? `${cat.color}33` : tokens.colors.glassBg,
                        },
                      ]}
                    >
                      <Text style={{ color: tokens.colors.text, fontWeight: "600" }}>{cat.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <EntriesTable
            rows={tableRows}
            minWidth={entryType === "income" ? Math.max(420, width - 48) : Math.max(520, width - 48)}
            emptyLabel={t("entries.empty.noEntries")}
            showCategory={entryType !== "income"}
            renderAction={(row) =>
              row.meta ? (
                <SmallOutlinePillButton
                  label=""
                  onPress={() => handleRowAction(row.meta)}
                  color={tokens.colors.accent}
                  icon={<MaterialCommunityIcons name="pencil-outline" size={16} color={tokens.colors.accent} />}
                />
              ) : null
            }
          />
        </GlassCardContainer>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  glassInput: {
    borderRadius: 12,
  },
  inlineInputs: {
    flexDirection: "row",
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
    flexWrap: "wrap",
  },
  flex: {
    flex: 1,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryLink: {
    fontWeight: "600",
  },
  filterRow: {
    gap: 8,
    paddingLeft: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterSection: {
    gap: 8,
    paddingBottom: 4,
    marginBottom: 12,
  },
  entriesTableCard: {
    gap: 16,
    paddingBottom: 6,
  },
});
