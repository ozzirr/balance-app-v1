import { breakdownByWallet, totalsByWalletType } from "@/domain/calculations";
import { averageMonthlyTotals, totalsForMonth } from "@/domain/finance";
import { listOccurrencesInRange, upcomingOccurrences } from "@/domain/recurrence";
import type { ExpenseCategory, ExpenseEntry, IncomeEntry, Snapshot, SnapshotLineDetail } from "@/repositories/types";
import { addDays } from "@/utils/recurrence";
import type {
  CashflowMonth,
  CashflowSummary,
  CategoryRow,
  DashboardData,
  DistributionItem,
  KPIItem,
  PortfolioPoint,
  RecurrenceRow,
} from "./types";

type DashboardInput = {
  latestLines: SnapshotLineDetail[];
  snapshots: Snapshot[];
  snapshotLines: Record<number, SnapshotLineDetail[]>;
  incomeEntries: IncomeEntry[];
  expenseEntries: ExpenseEntry[];
  expenseCategories: ExpenseCategory[];
};

const palette = ["#9B7BFF", "#5C9DFF", "#F6C177", "#66D19E", "#C084FC", "#FF8FAB", "#6EE7B7", "#94A3B8"];

function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildPortfolioSeries(
  snapshots: Snapshot[],
  snapshotLines: Record<number, SnapshotLineDetail[]>
): PortfolioPoint[] {
  const points = snapshots
    .map((snapshot) => {
      const lines = snapshotLines[snapshot.id] ?? [];
      const totals = totalsByWalletType(lines);
      return {
        date: snapshot.date,
        total: totals.netWorth,
        liquidity: totals.liquidity,
        investments: totals.investments,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return points;
}

function buildKpis(latestLines: SnapshotLineDetail[], portfolio: PortfolioPoint[]): KPIItem[] {
  const totals = totalsByWalletType(latestLines);
  const last = portfolio[portfolio.length - 1];
  const prev = portfolio[portfolio.length - 2];
  const deltaTotal = last && prev ? last.total - prev.total : 0;
  const deltaLiquidity = last && prev ? last.liquidity - prev.liquidity : 0;
  const deltaInvest = last && prev ? last.investments - prev.investments : 0;
  const pct = (delta: number, base: number) => (base === 0 ? 0 : delta / base);
  const toBreakdown = (lines: SnapshotLineDetail[]) =>
    breakdownByWallet(lines)
      .filter((item) => item.label)
      .map((item) => ({ label: item.label, value: item.value }));
  const liquidityBreakdown = toBreakdown(latestLines.filter((line) => line.wallet_type !== "INVEST"));
  const investBreakdown = toBreakdown(latestLines.filter((line) => line.wallet_type === "INVEST"));
  const netWorthBreakdown = toBreakdown(latestLines);

  return [
    {
      id: "liquidity",
      label: "Liquidità",
      value: totals.liquidity,
      deltaValue: deltaLiquidity,
      deltaPct: pct(deltaLiquidity, prev?.liquidity ?? 0),
      accent: palette[0],
      breakdown: liquidityBreakdown,
    },
    {
      id: "investments",
      label: "Investimenti",
      value: totals.investments,
      deltaValue: deltaInvest,
      deltaPct: pct(deltaInvest, prev?.investments ?? 0),
      accent: palette[1],
      breakdown: investBreakdown,
    },
    {
      id: "netWorth",
      label: "Patrimonio",
      value: totals.netWorth,
      deltaValue: deltaTotal,
      deltaPct: pct(deltaTotal, prev?.total ?? 0),
      accent: palette[3],
      breakdown: netWorthBreakdown,
    },
  ];
}

function buildDistribution(latestLines: SnapshotLineDetail[]): DistributionItem[] {
  const items = breakdownByWallet(latestLines)
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({
      id: `${item.label}-${index}`,
      label: item.label,
      value: item.value,
      color: palette[index % palette.length],
    }));
  return items;
}

function buildCashflow(income: IncomeEntry[], expense: ExpenseEntry[]): CashflowMonth[] {
  const now = new Date();
  const months: CashflowMonth[] = [];
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  for (let i = 0; i < 6; i += 1) {
    const totals = totalsForMonth(income, expense, year, month);
    months.unshift({
      month: toMonthKey(year, month),
      income: totals.income,
      expense: totals.expense,
    });
    month -= 1;
    if (month <= 0) {
      month = 12;
      year -= 1;
    }
  }
  return months;
}

function buildCategories(expense: ExpenseEntry[], categories: ExpenseCategory[]): CategoryRow[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const nextStart = `${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01`;
  const end = addDays(nextStart, -1);
  const categoryMap = new Map<number, string>();
  categories.forEach((cat) => categoryMap.set(cat.id, cat.name));
  const totals = new Map<string, number>();
  expense.forEach((entry) => {
    const dates = listOccurrencesInRange(entry, start, end);
    if (dates.length === 0) return;
    const label = entry.expense_category_id ? categoryMap.get(entry.expense_category_id) ?? "Senza categoria" : "Senza categoria";
    totals.set(label, (totals.get(label) ?? 0) + dates.length * entry.amount);
  });
  const totalValue = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(totals.entries())
    .map(([label, value], index) => ({
      id: `${label}-${index}`,
      label,
      value,
      color: palette[index % palette.length],
      pct: totalValue === 0 ? 0 : value / totalValue,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildRecurrences(
  incomeEntries: IncomeEntry[],
  expenseEntries: ExpenseEntry[],
  categories: ExpenseCategory[]
): RecurrenceRow[] {
  const categoryMap = new Map<number, string>();
  categories.forEach((cat) => categoryMap.set(cat.id, cat.name));
  const incomeMap = new Map<number, IncomeEntry>();
  const expenseMap = new Map<number, ExpenseEntry>();
  incomeEntries.forEach((entry) => incomeMap.set(entry.id, entry));
  expenseEntries.forEach((entry) => expenseMap.set(entry.id, entry));
  return upcomingOccurrences(incomeEntries, expenseEntries, 8).map((occurrence, index) => {
    const entry = occurrence.type === "income" ? incomeMap.get(occurrence.entryId) : expenseMap.get(occurrence.entryId);
    const recurring = Boolean(entry?.recurrence_frequency && entry.one_shot === 0);
    const category =
      occurrence.type === "expense"
        ? categoryMap.get((entry as ExpenseEntry | undefined)?.expense_category_id ?? -1) ?? "Spesa"
        : "Entrata";
    return {
      id: `${occurrence.entryId}-${index}`,
      date: occurrence.date,
      type: occurrence.type,
      category,
      description: occurrence.name,
      amount: occurrence.amount,
      recurring,
    };
  });
}

export function buildDashboardData(input: DashboardInput): DashboardData {
  const portfolio = buildPortfolioSeries(input.snapshots, input.snapshotLines);
  const kpis = buildKpis(input.latestLines, portfolio);
  const distributions = buildDistribution(input.latestLines);
  const cashflowMonths = buildCashflow(input.incomeEntries, input.expenseEntries);
  const averages = averageMonthlyTotals(
    input.incomeEntries,
    input.expenseEntries,
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    6
  );
  return {
    kpis,
    portfolioSeries: portfolio,
    distributions,
    cashflow: {
      avgIncome: averages.income,
      avgExpense: averages.expense,
      avgSavings: averages.net,
      months: cashflowMonths,
    },
    categories: buildCategories(input.expenseEntries, input.expenseCategories),
    recurrences: buildRecurrences(input.incomeEntries, input.expenseEntries, input.expenseCategories),
  };
}

export function createMockDashboardData(): DashboardData {
  const kpis: KPIItem[] = [
    { id: "liquidity", label: "Liquidità", value: 16450, deltaValue: 420, deltaPct: 0.026 },
    { id: "investments", label: "Investimenti", value: 32800, deltaValue: -620, deltaPct: -0.018 },
    { id: "netWorth", label: "Patrimonio", value: 49250, deltaValue: -200, deltaPct: -0.004 },
  ];
  const portfolioSeries: PortfolioPoint[] = [
    { date: "2024-11-01", total: 46800, liquidity: 15800, investments: 31000 },
    { date: "2024-12-01", total: 47200, liquidity: 16050, investments: 31150 },
    { date: "2025-01-01", total: 48500, liquidity: 16400, investments: 32100 },
    { date: "2025-02-01", total: 49250, liquidity: 16450, investments: 32800 },
  ];
  const distributions: DistributionItem[] = [
    { id: "cash", label: "Contanti", value: 4200, color: palette[0] },
    { id: "bank", label: "Conto", value: 8450, color: palette[1] },
    { id: "broker", label: "Broker", value: 32800, color: palette[2] },
  ];
  const cashflow: CashflowSummary = {
    avgIncome: 2450,
    avgExpense: 1680,
    avgSavings: 770,
    months: [
      { month: "2024-10", income: 2200, expense: 1600 },
      { month: "2024-11", income: 2400, expense: 1620 },
      { month: "2024-12", income: 2350, expense: 1700 },
      { month: "2025-01", income: 2500, expense: 1750 },
      { month: "2025-02", income: 2600, expense: 1650 },
    ],
  };
  const categories: CategoryRow[] = [
    { id: "c1", label: "Casa", value: 520, pct: 0.32, color: palette[3] },
    { id: "c2", label: "Cibo", value: 420, pct: 0.26, color: palette[4] },
    { id: "c3", label: "Trasporti", value: 310, pct: 0.19, color: palette[5] },
    { id: "c4", label: "Altro", value: 240, pct: 0.15, color: palette[6] },
  ];
  const recurrences: RecurrenceRow[] = [
    { id: "r1", date: "2025-02-16", type: "income", category: "Entrata", description: "Stipendio", amount: 2100, recurring: true },
    { id: "r2", date: "2025-02-20", type: "expense", category: "Casa", description: "Affitto", amount: 850, recurring: true },
    { id: "r3", date: "2025-02-22", type: "expense", category: "Cibo", description: "Spesa", amount: 120, recurring: false },
  ];
  return {
    kpis,
    portfolioSeries,
    distributions,
    cashflow,
    categories,
    recurrences,
  };
}
