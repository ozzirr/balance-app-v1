import type { OnboardingDraft } from "@/onboarding/state/OnboardingContext";
import { withTransaction } from "@/db/db";

const CATEGORY_COLOR = "#9B7BFF";

function parseNumber(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString().split("T")[0];
    }
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export async function seedOnboardingData(draft: OnboardingDraft): Promise<void> {
  await withTransaction(async (db) => {
    const tablesToClear = ["expense_entries", "income_entries", "wallets", "expense_categories"];
    for (const table of tablesToClear) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    const walletIds: Record<string, number> = {};
    const createWalletRecord = async (name: string, type: "LIQUIDITY" | "INVEST") => {
      const cleaned = name.trim() || (type === "LIQUIDITY" ? "Conto principale" : "Investimento");
      const result = await db.runAsync(
        "INSERT INTO wallets (name, type, currency, tag, active) VALUES (?, ?, 'EUR', NULL, 1)",
        [cleaned, type]
      );
      walletIds[cleaned] = result.lastInsertRowId ?? 0;
      return cleaned;
    };

    const liquidityName = await createWalletRecord(draft.liquidityWallet.name, "LIQUIDITY");
    for (const wallet of draft.investmentWallets) {
      await createWalletRecord(wallet.name, "INVEST");
    }
    const categories = Array.from(
      new Set(
        draft.categories
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );
    if (!categories.length) {
      categories.push("Altro");
    }
    const categoryIds: Record<string, number> = {};
    for (const category of categories) {
      const result = await db.runAsync(
        "INSERT INTO expense_categories (name, color, active) VALUES (?, ?, 1)",
        [category, CATEGORY_COLOR]
      );
      categoryIds[category] = result.lastInsertRowId ?? 0;
    }

    const recurringAmount = parseNumber(draft.recurringIncome.amount);
    if (recurringAmount === null || recurringAmount <= 0) {
      throw new Error("Importo entrata ricorrente non valido");
    }
    const recurringWallet =
      walletIds[draft.recurringIncome.walletName.trim()] ?? walletIds[liquidityName];
    await db.runAsync(
      `INSERT INTO income_entries
       (name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id)
       VALUES (?, ?, ?, 'MONTHLY', 1, 0, NULL, 1, ?)`,
      [
        draft.recurringIncome.name.trim() || "Stipendio",
        recurringAmount,
        normalizeDate(draft.recurringIncome.nextDate),
        recurringWallet,
      ]
    );

    for (const expense of draft.expenses) {
      const amount = parseNumber(expense.amount);
      if (amount === null || amount <= 0) continue;
      const cleanedCategory = expense.category.trim() || categories[0];
      const categoryId = categoryIds[cleanedCategory] ?? categoryIds[categories[0]];
      const cleanedWallet = expense.wallet.trim() || liquidityName;
      const expenseWalletId = walletIds[cleanedWallet] ?? walletIds[liquidityName];
      const recurrenceFrequency = expense.recurring ? "MONTHLY" : null;
      const recurrenceInterval = expense.recurring ? 1 : null;
      const oneShot = expense.recurring ? 0 : 1;
      await db.runAsync(
        `INSERT INTO expense_entries
         (name, amount, start_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id, expense_category_id)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
        [
          expense.title.trim() || "Spesa",
          amount,
          normalizeDate(expense.date),
          recurrenceFrequency,
          recurrenceInterval,
          oneShot,
          expenseWalletId,
          categoryId,
        ]
      );
    }
  });
}
