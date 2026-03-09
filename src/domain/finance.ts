import type { ExpenseEntry, IncomeEntry } from "@/repositories/types";
import { listOccurrencesInRange } from "./recurrence";
import { addDays } from "@/utils/recurrence";

export type MonthlyTotals = {
  income: number;
  expense: number;
  net: number;
};

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const nextStart = `${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01`;
  const end = addDays(nextStart, -1);
  return { start, end };
}

export function totalsForMonth(
  incomes: IncomeEntry[],
  expenses: ExpenseEntry[],
  year: number,
  month: number
): MonthlyTotals {
  const range = monthRange(year, month);
  const incomeTotal = incomes.reduce((sum, entry) => {
    const dates = listOccurrencesInRange(entry, range.start, range.end);
    return sum + dates.length * entry.amount;
  }, 0);
  const expenseTotal = expenses.reduce((sum, entry) => {
    const dates = listOccurrencesInRange(entry, range.start, range.end);
    return sum + dates.length * entry.amount;
  }, 0);
  return { income: incomeTotal, expense: expenseTotal, net: incomeTotal - expenseTotal };
}

export function averageMonthlyTotals(
  incomes: IncomeEntry[],
  expenses: ExpenseEntry[],
  year: number,
  month: number,
  months: number
): MonthlyTotals {
  const monthsWindow = Math.max(1, Math.floor(months));
  let cursorYear = year;
  let cursorMonth = month;
  let incomeSum = 0;
  let expenseSum = 0;

  for (let i = 0; i < monthsWindow; i += 1) {
    const totals = totalsForMonth(incomes, expenses, cursorYear, cursorMonth);
    incomeSum += totals.income;
    expenseSum += totals.expense;
    cursorMonth -= 1;
    if (cursorMonth <= 0) {
      cursorMonth = 12;
      cursorYear -= 1;
    }
  }

  const avgIncome = incomeSum / monthsWindow;
  const avgExpense = expenseSum / monthsWindow;
  return {
    income: avgIncome,
    expense: avgExpense,
    net: avgIncome - avgExpense,
  };
}
