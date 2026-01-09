import { executeSql } from "@/db/db";
import { fetchAll, fetchOne } from "./helpers";
import type { ExpenseCategory } from "./types";

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return fetchAll<ExpenseCategory>(
    "SELECT id, name, COALESCE(color, '#9B7BFF') AS color, COALESCE(active, 1) AS active FROM expense_categories ORDER BY name ASC"
  );
}

export async function getExpenseCategory(id: number): Promise<ExpenseCategory | null> {
  return fetchOne<ExpenseCategory>(
    "SELECT id, name, COALESCE(color, '#9B7BFF') AS color, COALESCE(active, 1) AS active FROM expense_categories WHERE id = ?",
    [id]
  );
}

export async function createExpenseCategory(name: string, color: string): Promise<number> {
  const result = await executeSql("INSERT INTO expense_categories (name, color, active) VALUES (?, ?, 1)", [
    name,
    color,
  ]);
  return result.insertId ?? 0;
}

export async function updateExpenseCategory(id: number, name: string, color: string): Promise<void> {
  await executeSql("UPDATE expense_categories SET name = ?, color = ? WHERE id = ?", [name, color, id]);
}

export async function setExpenseCategoryActive(id: number, active: number): Promise<void> {
  await executeSql("UPDATE expense_categories SET active = ? WHERE id = ?", [active, id]);
}

export async function deleteExpenseCategory(id: number): Promise<void> {
  await executeSql("DELETE FROM expense_categories WHERE id = ?", [id]);
}
