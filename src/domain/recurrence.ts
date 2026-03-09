import { compareIsoDates, isIsoDate, todayIso } from "@/utils/dates";
import type { ExpenseEntry, IncomeEntry, RecurrenceFrequency } from "@/repositories/types";
import type { RecurrenceRule } from "@/utils/recurrence";
import { addDays, addMonthsClamped, addYearsClamped, nextOccurrence } from "@/utils/recurrence";

export type Occurrence = {
  date: string;
  type: "income" | "expense";
  amount: number;
  name: string;
  note: string | null;
  entryId: number;
  frequency: RecurrenceFrequency | null;
};

function toRule(
  frequency: RecurrenceFrequency | null,
  interval: number | null
): RecurrenceRule | null {
  if (!frequency) return null;
  return {
    frequency,
    interval: interval && interval > 0 ? interval : 1,
  };
}

function advance(date: string, rule: RecurrenceRule): string {
  if (rule.frequency === "WEEKLY") return addDays(date, 7 * rule.interval);
  if (rule.frequency === "MONTHLY") return addMonthsClamped(date, rule.interval);
  return addYearsClamped(date, rule.interval);
}

function isActiveEntry(entry: IncomeEntry | ExpenseEntry): boolean {
  return entry.active === 1;
}

function getEntryEndDate(entry: IncomeEntry | ExpenseEntry): string | null {
  if (!entry.end_date || !isIsoDate(entry.end_date)) return null;
  return compareIsoDates(entry.end_date, entry.start_date) < 0 ? null : entry.end_date;
}

export function nextOccurrenceForEntry(
  entry: IncomeEntry | ExpenseEntry,
  fromDateIso: string
): string | null {
  if (!isActiveEntry(entry)) return null;
  const endDate = getEntryEndDate(entry);
  if (endDate && compareIsoDates(endDate, fromDateIso) < 0) return null;
  if (!entry.recurrence_frequency || entry.one_shot === 1) {
    if (compareIsoDates(entry.start_date, fromDateIso) < 0) return null;
    if (endDate && compareIsoDates(entry.start_date, endDate) > 0) return null;
    return entry.start_date;
  }
  const rule = toRule(entry.recurrence_frequency, entry.recurrence_interval);
  if (!rule) return null;
  const nextDate = nextOccurrence(entry.start_date, rule, fromDateIso);
  if (endDate && compareIsoDates(nextDate, endDate) > 0) return null;
  return nextDate;
}

export function listOccurrencesInRange(
  entry: IncomeEntry | ExpenseEntry,
  fromDateIso: string,
  toDateIso: string
): string[] {
  if (!isActiveEntry(entry)) return [];
  const endDate = getEntryEndDate(entry);
  const effectiveTo = endDate && compareIsoDates(endDate, toDateIso) < 0 ? endDate : toDateIso;
  if (compareIsoDates(effectiveTo, fromDateIso) < 0) return [];
  if (!entry.recurrence_frequency || entry.one_shot === 1) {
    if (
      compareIsoDates(entry.start_date, fromDateIso) >= 0 &&
      compareIsoDates(entry.start_date, effectiveTo) <= 0
    ) {
      return [entry.start_date];
    }
    return [];
  }

  const rule = toRule(entry.recurrence_frequency, entry.recurrence_interval);
  if (!rule) return [];
  const dates: string[] = [];
  let cursor = nextOccurrence(entry.start_date, rule, fromDateIso);
  let safety = 0;
  while (compareIsoDates(cursor, effectiveTo) <= 0 && safety < 500) {
    dates.push(cursor);
    cursor = advance(cursor, rule);
    safety += 1;
  }
  return dates;
}

export function nextOccurrencesForEntries(
  incomeEntries: IncomeEntry[],
  expenseEntries: ExpenseEntry[],
  count: number,
  fromDate: string = todayIso()
): Occurrence[] {
  const occurrences: Occurrence[] = [];

  incomeEntries.forEach((entry) => {
    const next = nextOccurrenceForEntry(entry, fromDate);
    if (next) {
      occurrences.push({
        date: next,
        type: "income",
        amount: entry.amount,
        name: entry.name,
        note: entry.note,
        entryId: entry.id,
        frequency: entry.recurrence_frequency ?? null,
      });
    }
  });

  expenseEntries.forEach((entry) => {
    const next = nextOccurrenceForEntry(entry, fromDate);
    if (next) {
      occurrences.push({
        date: next,
        type: "expense",
        amount: entry.amount,
        name: entry.name,
        note: entry.note,
        entryId: entry.id,
        frequency: entry.recurrence_frequency ?? null,
      });
    }
  });

  return occurrences.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, count);
}

export function upcomingOccurrences(
  incomeEntries: IncomeEntry[],
  expenseEntries: ExpenseEntry[],
  count: number,
  fromDate: string = todayIso()
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const pushOccurrences = (entry: IncomeEntry | ExpenseEntry, type: "income" | "expense") => {
    const rule = toRule(entry.recurrence_frequency, entry.recurrence_interval);
    const endDate = getEntryEndDate(entry);
    if (!isActiveEntry(entry)) return;
    if (endDate && compareIsoDates(endDate, fromDate) < 0) return;
    if (!rule || entry.one_shot === 1) {
      if (
        compareIsoDates(entry.start_date, fromDate) >= 0 &&
        (!endDate || compareIsoDates(entry.start_date, endDate) <= 0)
      ) {
        occurrences.push({
          date: entry.start_date,
          type,
          amount: entry.amount,
          name: entry.name,
          note: entry.note,
          entryId: entry.id,
          frequency: entry.recurrence_frequency ?? null,
        });
      }
      return;
    }
    let cursor = nextOccurrence(entry.start_date, rule, fromDate);
    let added = 0;
    let safety = 0;
    while (added < count && safety < 500 && (!endDate || compareIsoDates(cursor, endDate) <= 0)) {
      occurrences.push({
        date: cursor,
        type,
        amount: entry.amount,
        name: entry.name,
        note: entry.note,
        entryId: entry.id,
        frequency: entry.recurrence_frequency ?? null,
      });
      cursor = advance(cursor, rule);
      added += 1;
      safety += 1;
    }
  };

  incomeEntries.forEach((entry) => pushOccurrences(entry, "income"));
  expenseEntries.forEach((entry) => pushOccurrences(entry, "expense"));

  return occurrences.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, count);
}
