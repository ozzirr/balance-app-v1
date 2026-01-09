export type KPIItem = {
  id: string;
  label: string;
  value: number;
  deltaValue: number;
  deltaPct: number;
  accent?: string;
  breakdown?: { label: string; value: number }[];
};

export type PortfolioPoint = {
  date: string;
  total: number;
  liquidity: number;
  investments: number;
};

export type DistributionItem = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type CashflowMonth = {
  month: string;
  income: number;
  expense: number;
};

export type CashflowSummary = {
  avgIncome: number;
  avgExpense: number;
  avgSavings: number;
  months: CashflowMonth[];
};

export type CategoryRow = {
  id: string;
  label: string;
  value: number;
  color: string;
  pct: number;
};

export type RecurrenceRow = {
  id: string;
  entryId: number;
  date: string;
  type: "income" | "expense";
  category: string;
  categoryColor?: string;
  description: string;
  amount: number;
  recurring: boolean;
};

export type DashboardData = {
  kpis: KPIItem[];
  portfolioSeries: PortfolioPoint[];
  distributions: DistributionItem[];
  cashflow: CashflowSummary;
  categories: CategoryRow[];
  recurrences: RecurrenceRow[];
};
