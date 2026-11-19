export type KPIItem = {
  id: string;
  label: string;
  value: number;
  deltaValue: number;
  deltaPct: number;
  deltaStatus?: "OK" | "NO_DATA";
  accent?: string;
  breakdown?: { label: string; value: number }[];
};

export type KpiDeltaRange = "28D" | "3M" | "6M" | "12M";

export const KPI_DELTA_RANGE_LABELS: Record<KpiDeltaRange, string> = {
  "28D": "Ultimi 28 giorni",
  "3M": "Ultimi 3 mesi",
  "6M": "Ultimi 6 mesi",
  "12M": "Ultimi 12 mesi",
};

export function getKpiDeltaRangeLabel(range: KpiDeltaRange): string {
  return KPI_DELTA_RANGE_LABELS[range];
}

export type PortfolioPoint = {
  date: string;
  total: number;
  liquidity: number;
  investments: number;
  pension?: number;
};

export type WalletSeriesPoint = {
  date: string;
  value: number;
};

export type WalletSeries = {
  walletId: number;
  name: string;
  type: WalletType;
  investmentKind: "STANDARD" | "PENSION";
  color: string;
  points: WalletSeriesPoint[];
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
  categoryId: number | null;
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
  frequencyKey?: string | null;
};

export type DashboardData = {
  kpis: KPIItem[];
  availability: {
    immediate: number;
    liquid: number;
    restricted: number;
    available: number;
    total: number;
    availablePct: number;
    restrictedPct: number;
    products: Array<{
      id: number;
      name: string;
      value: number;
      availability: "immediate" | "liquid" | "restricted";
      availabilityDate: string | null;
      restrictionNote: string | null;
      investmentKind: "STANDARD" | "PENSION";
    }>;
  };
  portfolioSeries: PortfolioPoint[];
  walletSeries: WalletSeries[];
  distributions: DistributionItem[];
  cashflow: CashflowSummary;
  categories: CategoryRow[];
  recurrences: RecurrenceRow[];
};
import type { WalletType } from "@/repositories/types";
