import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { listIncomeEntries, createIncomeEntry, updateIncomeEntry, deleteIncomeEntry } from "@/repositories/incomeEntriesRepo";
import { listExpenseEntries, createExpenseEntry, updateExpenseEntry, deleteExpenseEntry } from "@/repositories/expenseEntriesRepo";
import {
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from "@/repositories/expenseCategoriesRepo";
import type { ExpenseCategory, ExpenseEntry, IncomeEntry, RecurrenceFrequency } from "@/repositories/types";
import { addMonths, compareIsoDates, isIsoDate, todayIso } from "@/utils/dates";
import { listOccurrencesInRange } from "@/domain/recurrence";
import { formatEUR, formatMonthLabel, formatShortDate } from "@/ui/dashboard/formatters";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import AppBackground from "@/ui/components/AppBackground";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { emitDataChanged, onDataChanged, onDataReset } from "@/app/dataEvents";
import EntriesTable, { EntriesTableRow } from "@/ui/dashboard/components/EntriesTable";
import {
  FrequencyPillGroup,
  GlassCardContainer,
  PrimaryPillButton,
  SegmentedControlPill,
  SmallOutlinePillButton,
} from "@/ui/components/EntriesUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import PressScale from "@/ui/dashboard/components/PressScale";
import { createStandardTextInputProps } from "@/ui/components/standardInputProps";
import ConfirmDialog from "@/ui/components/ConfirmDialog";
import { useSettings } from "@/settings/useSettings";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type EntryType = "income" | "expense";
type FormMode = "create" | "edit";
type CategoryFilter = "all" | number;
type MonthFilter = "all" | string;
type EntryOccurrence = {
  base: IncomeEntry | ExpenseEntry;
  date: string;
  occurrence: boolean;
};
type CategoryEdit = {
  name: string;
  color: string;
};

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
  endDate: string;
  categoryId: string;
  active: boolean;
  recurring: boolean;
  frequency: RecurrenceFrequency;
};

const ENTRIES_BATCH_SIZE = 10;

const emptyForm: FormState = {
  id: null,
  name: "",
  amount: "",
  startDate: todayIso(),
  endDate: todayIso(),
  categoryId: "",
  active: true,
  recurring: false,
  frequency: "MONTHLY",
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

function sanitizeAmountInput(value: string): string {
  const normalized = value.replace(/\./g, ",");
  const cleaned = normalized.replace(/[^0-9,]/g, "");
  const commaIndex = cleaned.indexOf(",");
  if (commaIndex === -1) {
    return cleaned;
  }
  const whole = cleaned.slice(0, commaIndex);
  const fraction = cleaned.slice(commaIndex + 1).replace(/,/g, "");
  const safeWhole = whole === "" ? "0" : whole;
  return `${safeWhole},${fraction}`;
}

type AccordionItemProps = {
  title: string;
  subtitle?: string;
  icon: IconName;
  iconOverride?: IconName;
  iconBackgroundOverride?: string;
  iconColorOverride?: string;
  onIconPress?: () => void;
  expanded: boolean;
  onToggle: () => void;
  color?: string;
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
  children,
}: AccordionItemProps) => {
  const { tokens, isDark } = useDashboardTheme();
  const iconName = iconOverride ?? icon;
  const iconBg = iconBackgroundOverride ?? color ?? tokens.colors.glassBg;
  const iconFg = iconColorOverride ?? (isDark ? tokens.colors.bg : "#FFFFFF");
  return (
    <GlassCardContainer contentStyle={{ gap: 12, padding: 12 }}>
      <PressScale onPress={onToggle} style={[styles.walletRow, { paddingVertical: 6 }]}>
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
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={tokens.colors.muted}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
      </PressScale>
      {expanded ? (
        <View style={[styles.accordionBody, { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder }]}>
          {children}
        </View>
      ) : null}
    </GlassCardContainer>
  );
};

export default function EntriesScreen(): JSX.Element {
  const { tokens, isDark } = useDashboardTheme();
  const { scrollBounceEnabled } = useSettings();
  const deleteIconColor = isDark ? tokens.colors.bg : tokens.colors.surface;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const scrollRef = useRef<ScrollView | null>(null);
  const routeParams = (route.params ?? {}) as EntriesRouteParams;
  const { width } = useWindowDimensions();
  const lastFormModeRef = useRef<FormMode | undefined>(routeParams.formMode);
  const [entryType, setEntryType] = useState<EntryType>(routeParams.entryType ?? "expense");
  const [formMode, setFormMode] = useState<FormMode>(routeParams.formMode ?? "create");
  const [editingId, setEditingId] = useState<number | null>(
    routeParams.formMode === "edit" ? routeParams.entryId ?? null : null
  );
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoryEdits, setCategoryEdits] = useState<Record<number, CategoryEdit>>({});
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(presetColors[0]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null);
  const [confirmCategoryId, setConfirmCategoryId] = useState<number | null>(null);
  const [confirmCategoryLoading, setConfirmCategoryLoading] = useState(false);
  const [confirmCategoryError, setConfirmCategoryError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategoryFilters, setShowCategoryFilters] = useState(false);
  const [showMonthFilters, setShowMonthFilters] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<"start" | "end">("start");
  const [visibleEntriesCount, setVisibleEntriesCount] = useState(ENTRIES_BATCH_SIZE);
  const searchInputRef = useRef<any>(null);
  const filtersRowRef = useRef<ScrollView | null>(null);
  const [showNewEntry, setShowNewEntry] = useState(routeParams.formMode === "edit");
  const categoriesOffsetY = useRef(0);

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
      setVisibleEntriesCount(ENTRIES_BATCH_SIZE);
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
    const subscription = onDataChanged(() => {
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
      lastFormModeRef.current = nextFormMode;
      return;
    }
    if (nextFormMode === "create") {
      if (lastFormModeRef.current !== "create") {
        setFormMode("create");
        setEditingId(null);
        setForm(emptyForm);
      }
    }
    lastFormModeRef.current = nextFormMode;
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
      endDate: entry.end_date ?? entry.start_date,
      categoryId:
        "expense_category_id" in entry && entry.expense_category_id
          ? String(entry.expense_category_id)
          : "",
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
    if (entryType === "expense" && !isCategorySelected) {
      setError(t("entries.validation.categoryRequired"));
      Alert.alert(t("entries.validation.categoryRequired"));
      return;
    }
    if (!form.name.trim()) {
      setError(t("entries.validation.nameRequired"));
      return;
    }
    if (!isIsoDate(form.startDate)) {
      setError(t("entries.validation.invalidDate"));
      return;
    }
    if (form.recurring && !isIsoDate(form.endDate)) {
      setError(t("entries.validation.endDateRequired", { defaultValue: "Data fine obbligatoria per ricorrenza." }));
      return;
    }
    if (form.recurring && compareIsoDates(form.endDate, form.startDate) < 0) {
      setError(
        t("entries.validation.endDateBeforeStart", {
          defaultValue: "La data fine deve essere uguale o successiva alla data inizio.",
        })
      );
      return;
    }
    const amount = Number(form.amount.replace(",", "."));
    if (!Number.isFinite(amount)) {
      setError(t("entries.validation.amountInvalid"));
      return;
    }
    if (amount < 0.01) {
      setError(t("entries.validation.amountTooSmall"));
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
        end_date: recurring ? form.endDate : null,
        recurrence_frequency: frequency,
        recurrence_interval: interval,
        one_shot: oneShot,
        note: null,
        active,
        wallet_id: null,
      };
      try {
        if (formMode === "edit") {
          await updateIncomeEntry(form.id!, payload);
        } else {
          await createIncomeEntry(payload);
        }
      } catch (error) {
        if (error instanceof Error && error.message === "END_DATE_REQUIRED") {
          setError(t("entries.validation.endDateRequired", { defaultValue: "Data fine obbligatoria per ricorrenza." }));
          return;
        }
        if (error instanceof Error && error.message === "END_DATE_BEFORE_START") {
          setError(
            t("entries.validation.endDateBeforeStart", {
              defaultValue: "La data fine deve essere uguale o successiva alla data inizio.",
            })
          );
          return;
        }
        throw error;
      }
    } else {
      const categoryId = Number(form.categoryId);
      if (!Number.isFinite(categoryId) || categoryId <= 0) {
        setError(t("entries.validation.categoryRequired"));
        return;
      }
      const payload: Omit<ExpenseEntry, "id"> = {
        name: form.name.trim(),
        amount,
        start_date: form.startDate,
        end_date: recurring ? form.endDate : null,
        recurrence_frequency: frequency,
        recurrence_interval: interval,
        one_shot: oneShot,
        note: null,
        active,
        wallet_id: null,
        expense_category_id: categoryId,
      };
      if (formMode === "edit") {
        try {
          await updateExpenseEntry(form.id!, payload);
        } catch (error) {
          if (error instanceof Error && error.message === "CATEGORY_REQUIRED") {
            setError(t("entries.validation.categoryRequired"));
            Alert.alert(t("entries.validation.categoryRequired"));
            return;
          }
          if (error instanceof Error && error.message === "END_DATE_REQUIRED") {
            setError(t("entries.validation.endDateRequired", { defaultValue: "Data fine obbligatoria per ricorrenza." }));
            return;
          }
          if (error instanceof Error && error.message === "END_DATE_BEFORE_START") {
            setError(
              t("entries.validation.endDateBeforeStart", {
                defaultValue: "La data fine deve essere uguale o successiva alla data inizio.",
              })
            );
            return;
          }
          throw error;
        }
      } else {
        try {
          await createExpenseEntry(payload);
        } catch (error) {
          if (error instanceof Error && error.message === "CATEGORY_REQUIRED") {
            setError(t("entries.validation.categoryRequired"));
            Alert.alert(t("entries.validation.categoryRequired"));
            return;
          }
          if (error instanceof Error && error.message === "END_DATE_REQUIRED") {
            setError(t("entries.validation.endDateRequired", { defaultValue: "Data fine obbligatoria per ricorrenza." }));
            return;
          }
          if (error instanceof Error && error.message === "END_DATE_BEFORE_START") {
            setError(
              t("entries.validation.endDateBeforeStart", {
                defaultValue: "La data fine deve essere uguale o successiva alla data inizio.",
              })
            );
            return;
          }
          throw error;
        }
      }
    }

    resetToCreateMode();
    setShowNewEntry(false);
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

  const activeCategories = useMemo(() => categories.filter((cat) => cat.active === 1), [categories]);
  const inputProps = createStandardTextInputProps(tokens);

  useEffect(() => {
    const edits: Record<number, CategoryEdit> = {};
    categories.forEach((cat) => {
      edits[cat.id] = { name: cat.name, color: cat.color };
    });
    setCategoryEdits(edits);
  }, [categories]);

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    await createExpenseCategory(newCategory.trim(), newCategoryColor);
    setNewCategory("");
    setNewCategoryColor(presetColors[0]);
    setShowAddCategory(false);
    await refreshAll();
    emitDataChanged();
  };

  const persistCategoryEdit = useCallback(
    async (categoryId: number, updates: Partial<CategoryEdit>) => {
      const category = categories.find((cat) => cat.id === categoryId);
      if (!category) return;
      const current = categoryEdits[categoryId] ?? { name: category.name, color: category.color };
      const merged = { ...current, ...updates };
      setCategoryEdits((prev) => ({ ...prev, [categoryId]: merged }));
      setCategories((prev) =>
        prev.map((item) => (item.id === categoryId ? { ...item, ...merged } : item))
      );
      const trimmedName = merged.name.trim();
      if (!trimmedName) return;
      try {
        await updateExpenseCategory(categoryId, trimmedName, merged.color);
      } catch (error) {
        console.warn("Failed to auto-save category", error);
      }
    },
    [categories, categoryEdits]
  );

  const openConfirmDeleteCategory = (id: number) => {
    setConfirmCategoryId(id);
    setConfirmCategoryError(null);
  };

  const closeConfirmDeleteCategory = () => {
    if (confirmCategoryLoading) return;
    setConfirmCategoryId(null);
    setConfirmCategoryError(null);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!confirmCategoryId) return;
    setConfirmCategoryLoading(true);
    setConfirmCategoryError(null);
    try {
      await deleteExpenseCategory(confirmCategoryId);
      await refreshAll();
      emitDataChanged();
      setExpandedCategoryId(null);
      setConfirmCategoryId(null);
    } catch (error) {
      console.warn("Failed to delete category", error);
      setConfirmCategoryError(
        t("wallets.list.categoryDeleteError", { defaultValue: "Errore durante l'eliminazione. Riprova." })
      );
    } finally {
      setConfirmCategoryLoading(false);
    }
  };

  const openCategorySection = useCallback(() => {
    setExpandedCategoryId(null);
    setShowAddCategory(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(categoriesOffsetY.current - 16, 0), animated: true });
    });
  }, []);
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

  const openDatePicker = (target: "start" | "end") => {
    if (showDatePicker && datePickerTarget === target) {
      setShowDatePicker(false);
      return;
    }
    setDatePickerTarget(target);
    setShowDatePicker(true);
  };

  const datePickerIso = datePickerTarget === "start" ? form.startDate : form.endDate;
  const datePickerValue = datePickerIso && isIsoDate(datePickerIso) ? new Date(datePickerIso) : new Date();

  const formatIsoToDMY = (iso: string) => {
    if (!isIsoDate(iso)) return iso;
    const date = new Date(iso);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  };

  const horizonStart = todayIso();
  const horizonEnd = addMonths(horizonStart, 12);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const expandedEntries = useMemo<EntryOccurrence[]>(() => {
    const result: EntryOccurrence[] = [];
    entries.forEach((entry) => {
      const isRecurring = Boolean(entry.recurrence_frequency && entry.one_shot === 0);
      if (isRecurring) {
        const dates = listOccurrencesInRange(entry, horizonStart, horizonEnd);
        dates.forEach((date) => {
          result.push({ base: entry, date, occurrence: true });
        });
        return;
      }
      if (compareIsoDates(entry.start_date, horizonStart) >= 0 && compareIsoDates(entry.start_date, horizonEnd) <= 0) {
        result.push({ base: entry, date: entry.start_date, occurrence: false });
      }
    });
    return result;
  }, [entries, horizonEnd, horizonStart]);

  const entriesAfterCategoryAndSearch = useMemo(() => {
    let result = expandedEntries;
    if (entryType === "expense") {
      result = result.filter((entry) => {
        if (categoryFilter === "all") return true;
        return "expense_category_id" in entry.base && entry.base.expense_category_id === categoryFilter;
      });
    }
    if (normalizedSearch) {
      result = result.filter((entry) => entry.base.name.toLowerCase().includes(normalizedSearch));
    }
    return result;
  }, [expandedEntries, entryType, categoryFilter, normalizedSearch]);

  const availableMonthKeys = useMemo(() => {
    const keys = Array.from(
      new Set(
        entriesAfterCategoryAndSearch
          .map((entry) => entry.date.slice(0, 7))
          .filter((key) => /^\d{4}-\d{2}$/.test(key))
      )
    );
    return keys.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  }, [entriesAfterCategoryAndSearch]);

  const filteredEntries = useMemo(() => {
    if (monthFilter === "all") {
      return entriesAfterCategoryAndSearch;
    }
    return entriesAfterCategoryAndSearch.filter((entry) => entry.date.startsWith(monthFilter));
  }, [entriesAfterCategoryAndSearch, monthFilter]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
    });
  }, [filteredEntries]);

  const entryAccent = entryType === "income" ? tokens.colors.income : tokens.colors.expense;
  const expenseCategoryCount = useMemo(() => {
    if (entryType !== "expense") return 0;
    const activeCategoryIds = new Set(activeCategories.map((cat) => cat.id));
    const ids = new Set<number>();
    entries.forEach((entry) => {
      if (
        "expense_category_id" in entry &&
        typeof entry.expense_category_id === "number" &&
        activeCategoryIds.has(entry.expense_category_id)
      ) {
        ids.add(entry.expense_category_id);
      }
    });
    return ids.size;
  }, [activeCategories, entries, entryType]);
  const shouldShowEntriesCard = entries.length > 0;
  const shouldShowCategoryFilter =
    entryType === "expense" && entries.length >= 5 && expenseCategoryCount >= 2;
  const shouldShowMonthFilter = availableMonthKeys.length > 1;
  const canSubmitNewCategory = showAddCategory && newCategory.trim().length > 0;
  const categoryIdNumber = Number(form.categoryId);
  const isCategorySelected = entryType !== "expense" || (Number.isFinite(categoryIdNumber) && categoryIdNumber > 0);
  const shouldShowCategoryHint = entryType === "expense" && !isCategorySelected;
  const isSaveDisabled = entryType === "expense" && !isCategorySelected;
  const categoryFiltersActive = showCategoryFilters || categoryFilter !== "all";
  const monthFiltersActive = showMonthFilters || monthFilter !== "all";
  const newEntryTitle =
    entryType === "income"
      ? t("entries.form.newIncomeTitle", { defaultValue: "Nuova voce in entrata" })
      : t("entries.form.newExpenseTitle", { defaultValue: "Nuova voce in uscita" });

  useEffect(() => {
    if (!shouldShowCategoryFilter && categoryFilter !== "all") {
      setCategoryFilter("all");
    }
  }, [categoryFilter, shouldShowCategoryFilter]);

  useEffect(() => {
    if (monthFilter === "all") return;
    if (!availableMonthKeys.includes(monthFilter)) {
      setMonthFilter("all");
    }
  }, [availableMonthKeys, monthFilter]);

  useEffect(() => {
    if (showSearchInput) {
      const handle = setTimeout(() => {
        searchInputRef.current?.focus?.();
      }, 60);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [showSearchInput]);

  useEffect(() => {
    if (!showSearchInput) return;
    const handle = requestAnimationFrame(() => {
      filtersRowRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(handle);
  }, [showSearchInput]);

  useEffect(() => {
    if (!shouldShowCategoryFilter && showCategoryFilters) {
      setShowCategoryFilters(false);
    }
  }, [shouldShowCategoryFilter, showCategoryFilters]);

  useEffect(() => {
    if (categoryFilter !== "all" && !showCategoryFilters) {
      setShowCategoryFilters(true);
    }
  }, [categoryFilter, showCategoryFilters]);

  useEffect(() => {
    if (!shouldShowMonthFilter && showMonthFilters) {
      setShowMonthFilters(false);
    }
  }, [shouldShowMonthFilter, showMonthFilters]);

  useEffect(() => {
    if (monthFilter !== "all" && !showMonthFilters) {
      setShowMonthFilters(true);
    }
  }, [monthFilter, showMonthFilters]);

  useEffect(() => {
    setVisibleEntriesCount(ENTRIES_BATCH_SIZE);
  }, [entryType, categoryFilter, monthFilter, normalizedSearch]);

  const tableRows = useMemo<EntriesTableRow<(IncomeEntry | ExpenseEntry) | null>[]>(
    () =>
      sortedEntries.map((item) => {
        const baseEntry = item.base;
        const amountAbs = Math.abs(baseEntry.amount);
        const amountText = `${entryType === "income" ? "+" : "-"} ${formatEUR(amountAbs)}`;
        const dateLabel = formatShortDate(item.date);
        const category =
          "expense_category_id" in baseEntry ? categoryById.get(baseEntry.expense_category_id) : null;
        const categoryLabel =
          entryType === "income"
            ? t("entries.list.incomeLabel")
            : category?.name ?? t("entries.list.categoryFallback");
        const categoryColor =
          entryType === "income" ? tokens.colors.income : category?.color ?? tokens.colors.expense;
        const frequencyKey =
          baseEntry.recurrence_frequency && typeof baseEntry.recurrence_frequency === "string"
            ? (`entries.form.frequency.${baseEntry.recurrence_frequency.toLowerCase()}` as const)
            : null;

        return {
          id: `${baseEntry.id}-${item.date}`,
          dateLabel,
          amountLabel: amountText,
          amountTone: entryType,
          amountColor: entryType === "income" ? tokens.colors.income : tokens.colors.expense,
          name: baseEntry.name,
          subtitle: frequencyKey ? t(frequencyKey) : undefined,
          categoryLabel,
          categoryColor,
          meta: baseEntry,
        };
      }),
    [sortedEntries, entryType, categoryById, tokens.colors.income, tokens.colors.expense, t]
  );

  const visibleTableRows = useMemo(
    () => tableRows.slice(0, visibleEntriesCount),
    [tableRows, visibleEntriesCount]
  );

  const canLoadMoreRows = visibleEntriesCount < tableRows.length;
  const visibleRows = Math.min(visibleEntriesCount, tableRows.length);
  const totalRows = tableRows.length;
  const loadMoreLabel = `${t("entries.list.loadMore", { defaultValue: "Carica altro" })} (${visibleRows}/${totalRows})`;

  const handleLoadMoreRows = useCallback(() => {
    setVisibleEntriesCount((prev) => Math.min(prev + ENTRIES_BATCH_SIZE, tableRows.length));
  }, [tableRows.length]);

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
    <View style={styles.screenRoot}>
      <AppBackground>
        <ScrollView
          ref={scrollRef}
          bounces={scrollBounceEnabled}
          alwaysBounceVertical={scrollBounceEnabled}
          overScrollMode={scrollBounceEnabled ? "always" : "never"}
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
              { value: "expense", label: t("entries.list.tabExpense"), tint: `${tokens.colors.expense}33` },
              { value: "income", label: t("entries.list.tabIncome"), tint: `${tokens.colors.income}44` },
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
          <GlassCardContainer style={{ borderColor: entryAccent }}>
            <Text style={[styles.sectionTitle, { color: tokens.colors.text }]}>{newEntryTitle}</Text>
            <View style={{ gap: 12 }}>
              <TextInput
                label={t("entries.form.name")}
                value={form.name}
                mode="outlined"
                outlineColor={tokens.colors.glassBorder}
                activeOutlineColor={tokens.colors.accent}
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
                  outlineColor={tokens.colors.glassBorder}
                  activeOutlineColor={tokens.colors.accent}
                  textColor={tokens.colors.text}
                  style={[styles.glassInput, styles.flex, { backgroundColor: tokens.colors.glassBg }]}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, amount: sanitizeAmountInput(text) }))}
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
                  onPressIn={() => openDatePicker("start")}
                />
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  textColor={tokens.colors.text}
                  themeVariant="dark"
                  onChange={(_, selected) => {
                    if (selected) {
                      const isoDate = toIsoDate(selected);
                      setForm((prev) => {
                        if (datePickerTarget === "start") {
                          const nextEndDate =
                            prev.recurring && compareIsoDates(prev.endDate, isoDate) < 0 ? isoDate : prev.endDate;
                          return { ...prev, startDate: isoDate, endDate: nextEndDate };
                        }
                        return { ...prev, endDate: isoDate };
                      });
                    }
                    if (Platform.OS !== "ios") {
                      setShowDatePicker(false);
                    }
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
                            openCategorySection();
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
                          onPress={() => {
                            setForm((prev) => ({ ...prev, categoryId: String(cat.id) }));
                          }}
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
                  {shouldShowCategoryHint ? (
                    <Text style={[styles.categoryHint, { color: tokens.colors.expense }]}>
                      {t("entries.form.categoryHint", { defaultValue: "Seleziona una categoria." })}
                    </Text>
                  ) : null}
                </View>
              )}

              <View style={[styles.inlineInputs, { alignItems: "center" }]}>
                <Text style={{ color: tokens.colors.text, flex: 1 }}>{t("entries.form.recurringLabel")}</Text>
                <Switch
                  value={form.recurring}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      recurring: value,
                      endDate:
                        value && (!isIsoDate(prev.endDate) || compareIsoDates(prev.endDate, prev.startDate) < 0)
                          ? prev.startDate
                          : prev.endDate,
                    }))
                  }
                  color={entryAccent}
                />
              </View>

              {form.recurring && (
                <>
                  <FrequencyPillGroup
                    value={form.frequency}
                    onChange={(next) => setForm((prev) => ({ ...prev, frequency: next as RecurrenceFrequency }))}
                    options={[
                      { value: "WEEKLY", label: t("entries.form.frequency.weekly"), tint: `${entryAccent}33` },
                      { value: "MONTHLY", label: t("entries.form.frequency.monthly"), tint: `${entryAccent}33` },
                      { value: "YEARLY", label: t("entries.form.frequency.yearly"), tint: `${entryAccent}33` },
                    ]}
                  />
                  <TextInput
                    label={t("entries.form.endDate", { defaultValue: "Data fine" })}
                    value={formatIsoToDMY(form.endDate)}
                    editable={false}
                    mode="outlined"
                    outlineColor={tokens.colors.glassBorder}
                    activeOutlineColor={tokens.colors.accent}
                    textColor={tokens.colors.text}
                    right={<TextInput.Icon icon="calendar" />}
                    style={[styles.glassInput, { backgroundColor: tokens.colors.glassBg }]}
                    onPressIn={() => openDatePicker("end")}
                  />
                </>
              )}

              {error && <Text style={{ color: tokens.colors.expense }}>{error}</Text>}

              <View style={styles.actionsRow}>
                <Button
                  mode="contained"
                  buttonColor={entryAccent}
                  textColor="#0B0B0B"
                  onPress={saveEntry}
                  disabled={isSaveDisabled}
                  style={styles.flex}
                >
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

        {shouldShowEntriesCard ? (
          <GlassCardContainer contentStyle={styles.entriesTableCard}>
            <ScrollView
              ref={filtersRowRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              contentContainerStyle={styles.filtersBar}
            >
                {shouldShowMonthFilter ? (
                  <Pressable
                    onPress={() => setShowMonthFilters((prev) => !prev)}
                    style={[
                      styles.filterPill,
                      monthFiltersActive
                        ? { borderColor: entryAccent, backgroundColor: `${entryAccent}18` }
                        : { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={16}
                      color={monthFiltersActive ? entryAccent : tokens.colors.muted}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: monthFiltersActive ? entryAccent : tokens.colors.muted },
                      ]}
                    >
                      {t("entries.list.filterMonthShort", { defaultValue: "Mese" })}
                    </Text>
                  </Pressable>
                ) : null}
                {shouldShowCategoryFilter ? (
                  <Pressable
                    onPress={() => setShowCategoryFilters((prev) => !prev)}
                    style={[
                      styles.filterPill,
                      categoryFiltersActive
                        ? { borderColor: entryAccent, backgroundColor: `${entryAccent}18` }
                        : { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="filter-variant"
                      size={16}
                      color={categoryFiltersActive ? entryAccent : tokens.colors.muted}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: categoryFiltersActive ? entryAccent : tokens.colors.muted },
                      ]}
                    >
                      {t("entries.list.filterCategoryShort", { defaultValue: "Categorie" })}
                    </Text>
                  </Pressable>
                ) : null}
                {!showSearchInput && !searchQuery ? (
                  <Pressable
                    onPress={() => setShowSearchInput(true)}
                    style={[
                      styles.filterIconButton,
                      { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
                    ]}
                  >
                    <MaterialCommunityIcons name="magnify" size={16} color={tokens.colors.muted} />
                  </Pressable>
                ) : null}
                {showSearchInput || searchQuery ? (
                <TextInput
                  ref={searchInputRef}
                  placeholder={t("entries.list.searchPlaceholder", { defaultValue: "Cerca..." })}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  dense
                  right={
                    <TextInput.Icon
                      icon="close"
                      color={tokens.colors.muted}
                      onPress={() => {
                        setSearchQuery("");
                        setShowSearchInput(false);
                      }}
                    />
                  }
                  {...inputProps}
                  style={[styles.glassInput, styles.filtersSearch, { backgroundColor: tokens.colors.glassBg }]}
                />
                ) : null}
            </ScrollView>
            {(shouldShowMonthFilter && showMonthFilters) || (shouldShowCategoryFilter && showCategoryFilters) ? (
              <View style={styles.filterSection}>
                {shouldShowMonthFilter && showMonthFilters ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.filterRow, { paddingHorizontal: 4 }]}
                  >
                    <Pressable
                      onPress={() => setMonthFilter("all")}
                      style={[
                        styles.filterChip,
                        {
                          borderColor: monthFilter === "all" ? tokens.colors.accent : tokens.colors.glassBorder,
                          backgroundColor: monthFilter === "all" ? `${tokens.colors.accent}22` : tokens.colors.glassBg,
                        },
                      ]}
                    >
                      <Text style={{ color: tokens.colors.text, fontWeight: "600" }}>
                        {t("common.all", { defaultValue: "Tutti" })}
                      </Text>
                    </Pressable>
                    {availableMonthKeys.map((monthKey) => {
                      const selected = monthFilter === monthKey;
                      return (
                        <Pressable
                          key={monthKey}
                          onPress={() => setMonthFilter(monthKey)}
                          style={[
                            styles.filterChip,
                            {
                              borderColor: selected ? tokens.colors.accent : tokens.colors.glassBorder,
                              backgroundColor: selected ? `${tokens.colors.accent}22` : tokens.colors.glassBg,
                            },
                          ]}
                        >
                          <Text style={{ color: tokens.colors.text, fontWeight: "600" }}>
                            {formatMonthLabel(monthKey)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
                {shouldShowCategoryFilter && showCategoryFilters ? (
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
                ) : null}
              </View>
            ) : null}
            <EntriesTable
              rows={visibleTableRows}
              minWidth={entryType === "income" ? Math.max(420, width - 64) : Math.max(436, width - 64)}
              emptyLabel={t("entries.empty.noEntries")}
              showCategory={entryType !== "income"}
              showPagination={false}
              renderAction={(row) =>
                row.meta ? (
                  <SmallOutlinePillButton
                    label=""
                    onPress={() => handleRowAction(row.meta!)}
                    color={tokens.colors.accent}
                    icon={<MaterialCommunityIcons name="pencil-outline" size={16} color={tokens.colors.accent} />}
                  />
                ) : null
              }
            />
            {canLoadMoreRows ? (
              <View style={styles.loadMoreRow}>
                <Button
                  mode="outlined"
                  onPress={handleLoadMoreRows}
                  icon="chevron-down"
                  textColor={tokens.colors.accent}
                  style={[styles.loadMoreButton, { borderColor: tokens.colors.accent }]}
                >
                  {loadMoreLabel}
                </Button>
              </View>
            ) : null}
          </GlassCardContainer>
        ) : null}
        {entryType === "expense" ? (
          <View
            onLayout={(event) => {
              categoriesOffsetY.current = event.nativeEvent.layout.y;
            }}
          >
            <GlassCardContainer contentStyle={{ gap: 12, padding: 12 }}>
              <SectionHeader title={t("wallets.list.categoriesTitle")} />
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
                      color={categoryEdits[cat.id]?.color ?? cat.color}
                      iconOverride={expandedCategoryId === cat.id ? "trash-can-outline" : undefined}
                      iconBackgroundOverride={expandedCategoryId === cat.id ? tokens.colors.red : undefined}
                      iconColorOverride={expandedCategoryId === cat.id ? deleteIconColor : undefined}
                      onIconPress={
                        expandedCategoryId === cat.id
                          ? () => {
                              openConfirmDeleteCategory(cat.id);
                            }
                          : undefined
                      }
                    >
                      <View style={[styles.sectionContent, styles.accordionInner]}>
                        <View style={[styles.colorLine, { paddingVertical: 0 }]}>
                          <TextInput
                            label={t("wallets.list.newCategoryLabel")}
                            value={categoryEdits[cat.id]?.name ?? cat.name}
                            {...inputProps}
                            style={[styles.categoryNameInput, { backgroundColor: tokens.colors.glassBg }]}
                            onChangeText={(value) =>
                              void persistCategoryEdit(cat.id, { name: value })
                            }
                          />
                          <PressScale
                            onPress={() => {
                              const currentColor = categoryEdits[cat.id]?.color ?? cat.color;
                              void persistCategoryEdit(cat.id, { color: nextPresetColor(currentColor) });
                            }}
                            style={[
                              styles.colorSwatch,
                              {
                                backgroundColor: categoryEdits[cat.id]?.color ?? cat.color,
                                borderColor: tokens.colors.glassBorder,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </AccordionItem>
                  );
                })}
              </View>
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
                </View>
              )}
              <PrimaryPillButton
                label={
                  showAddCategory
                    ? canSubmitNewCategory
                      ? t("common.add")
                      : t("common.cancel")
                    : t("wallets.list.addCategory", { defaultValue: t("common.add") })
                }
                onPress={() => {
                  if (showAddCategory) {
                    if (canSubmitNewCategory) {
                      void addCategory();
                      return;
                    }
                    setShowAddCategory(false);
                    setNewCategory("");
                    setNewCategoryColor(presetColors[0]);
                    return;
                  }
                  setExpandedCategoryId(null);
                  setShowAddCategory(true);
                }}
                color={tokens.colors.accent}
              />
            </GlassCardContainer>
          </View>
        ) : null}
        <ConfirmDialog
          visible={confirmCategoryId !== null}
          title={t("categories.delete.title", { defaultValue: "Eliminare categoria?" })}
          message={t("categories.delete.body", {
            defaultValue:
              "Eliminando questa categoria verranno eliminate anche tutte le spese associate. Se devi solo cambiarne il nome, modifica la categoria invece di eliminarla.",
          })}
          confirmLabel={t("categories.delete.confirm", { defaultValue: "Elimina categoria" })}
          cancelLabel={t("common.cancel", { defaultValue: "Annulla" })}
          onConfirm={handleConfirmDeleteCategory}
          onCancel={closeConfirmDeleteCategory}
          loading={confirmCategoryLoading}
          error={confirmCategoryError}
          confirmColor={tokens.colors.expense}
        />
        </ScrollView>
      </AppBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenRoot: {
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
  sectionContent: {
    gap: 12,
  },
  flex: {
    flex: 1,
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
  categoryNameInput: {
    flex: 1,
    minWidth: 160,
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
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryLink: {
    fontWeight: "600",
  },
  categoryHint: {
    fontSize: 12,
    fontWeight: "600",
  },
  filterRow: {
    gap: 8,
    paddingLeft: 8,
  },
  filtersBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 4,
  },
  filtersSearch: {
    width: 180,
    minWidth: 160,
    height: 40,
    borderRadius: 999,
  },
  filterIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
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
  loadMoreRow: {
    alignItems: "center",
    marginTop: 2,
  },
  loadMoreButton: {
    borderRadius: 999,
  },
});
