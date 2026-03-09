import { executeSql } from "@/db/db";
import { compareIsoDates, isIsoDate } from "@/utils/dates";
import { fetchAll, fetchOne } from "./helpers";
import type { ExpenseEntry } from "./types";

export async function listExpenseEntries(): Promise<ExpenseEntry[]> {
  return fetchAll<ExpenseEntry>("SELECT * FROM expense_entries ORDER BY start_date DESC");
}

function validateRecurringRange(entry: Omit<ExpenseEntry, "id">): void {
  const recurring = entry.one_shot === 0 && Boolean(entry.recurrence_frequency);
  if (!recurring) return;
  if (!entry.end_date || !isIsoDate(entry.end_date)) {
    throw new Error("END_DATE_REQUIRED");
  }
  if (!isIsoDate(entry.start_date) || compareIsoDates(entry.end_date, entry.start_date) < 0) {
    throw new Error("END_DATE_BEFORE_START");
  }
}

export async function getExpenseEntry(id: number): Promise<ExpenseEntry | null> {
  return fetchOne<ExpenseEntry>("SELECT * FROM expense_entries WHERE id = ?", [id]);
}

export async function createExpenseEntry(entry: Omit<ExpenseEntry, "id">): Promise<number> {
  if (!entry.expense_category_id || entry.expense_category_id <= 0) {
    throw new Error("CATEGORY_REQUIRED");
  }
  validateRecurringRange(entry);
  const result = await executeSql(
    `INSERT INTO expense_entries (name, amount, start_date, end_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id, expense_category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      entry.name,
      entry.amount,
      entry.start_date,
      entry.end_date,
      entry.recurrence_frequency,
      entry.recurrence_interval,
      entry.one_shot,
      entry.note,
      entry.active,
      entry.wallet_id,
      entry.expense_category_id,
    ]
  );
  return result.insertId ?? 0;
}

export async function updateExpenseEntry(id: number, entry: Omit<ExpenseEntry, "id">): Promise<void> {
  if (!entry.expense_category_id || entry.expense_category_id <= 0) {
    throw new Error("CATEGORY_REQUIRED");
  }
  validateRecurringRange(entry);
  await executeSql(
    `UPDATE expense_entries
     SET name = ?, amount = ?, start_date = ?, end_date = ?, recurrence_frequency = ?, recurrence_interval = ?, one_shot = ?, note = ?, active = ?, wallet_id = ?, expense_category_id = ?
     WHERE id = ?`,
    [
      entry.name,
      entry.amount,
      entry.start_date,
      entry.end_date,
      entry.recurrence_frequency,
      entry.recurrence_interval,
      entry.one_shot,
      entry.note,
      entry.active,
      entry.wallet_id,
      entry.expense_category_id,
      id,
    ]
  );
}

export async function deleteExpenseEntry(id: number): Promise<void> {
  await executeSql("DELETE FROM expense_entries WHERE id = ?", [id]);
}
