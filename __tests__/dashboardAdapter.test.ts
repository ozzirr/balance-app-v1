import { buildDashboardData, buildKpiDeltaForRange } from "@/ui/dashboard/adapter";
import type { ExpenseEntry, Snapshot, SnapshotLineDetail } from "@/repositories/types";
import type { PortfolioPoint } from "@/ui/dashboard/types";

const makeLine = (
  snapshotId: number,
  walletType: "LIQUIDITY" | "INVEST",
  amount: number
): SnapshotLineDetail => ({
  id: Number(`${snapshotId}${walletType === "LIQUIDITY" ? "1" : "2"}`),
  snapshot_id: snapshotId,
  wallet_id: walletType === "LIQUIDITY" ? 1 : 2,
  amount,
  wallet_name: walletType === "LIQUIDITY" ? "Cash" : "Invest",
  wallet_type: walletType,
  wallet_tag: null,
});

describe("dashboard expense categories", () => {
  test("keeps category IDs distinct even when names match and preserves uncategorized entries", () => {
    const date = new Date();
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    const expense = (id: number, categoryId: number | null, amount: number): ExpenseEntry => ({
      id, name: `Expense ${id}`, amount, start_date: day, end_date: null,
      recurrence_frequency: null, recurrence_interval: null, one_shot: 1,
      note: null, active: 1, wallet_id: null, expense_category_id: categoryId as number,
    });
    const data = buildDashboardData({
      latestLines: [], snapshots: [], snapshotLines: {}, incomeEntries: [],
      expenseEntries: [expense(1, 11, 100), expense(2, 22, 50), expense(3, null, 25)],
      expenseCategories: [{ id: 11, name: "Casa", color: "#123456", active: 1 }, { id: 22, name: "Casa", color: "#654321", active: 0 }],
      chartPoints: 3, wallets: [],
    });
    expect(data.categories.map(({ categoryId, value }) => ({ categoryId, value }))).toEqual([
      { categoryId: 11, value: 100 }, { categoryId: 22, value: 50 }, { categoryId: null, value: 25 },
    ]);
  });
});

describe("buildKpiDeltaForRange", () => {
  test("1D: uses latest snapshot vs previous snapshot", () => {
    const snapshots: Snapshot[] = [
      { id: 2, date: "2026-01-29" },
      { id: 1, date: "2026-01-28" },
    ];
    const snapshotLinesById: Record<number, SnapshotLineDetail[]> = {
      1: [makeLine(1, "LIQUIDITY", 100), makeLine(1, "INVEST", 50)],
      2: [makeLine(2, "LIQUIDITY", 120), makeLine(2, "INVEST", 40)],
    };

    const result = buildKpiDeltaForRange("1D", snapshots, [], snapshotLinesById);
    expect(result.status).toBe("OK");
    expect(result.deltas.liquidity.deltaAbs).toBe(20);
    expect(result.deltas.investments.deltaAbs).toBe(-10);
    expect(result.deltas.total.deltaAbs).toBe(10);
    expect(result.deltas.liquidity.deltaPct).toBeCloseTo(0.2, 5);
    expect(result.deltas.investments.deltaPct).toBeCloseTo(-0.2, 5);
    expect(result.deltas.total.deltaPct).toBeCloseTo(10 / 150, 5);
  });

  test("28D: selects closest snapshot on or before target date", () => {
    const snapshots: Snapshot[] = [
      { id: 3, date: "2026-01-29" },
      { id: 2, date: "2026-01-10" },
      { id: 1, date: "2025-12-31" },
    ];
    const snapshotLinesById: Record<number, SnapshotLineDetail[]> = {
      3: [makeLine(3, "LIQUIDITY", 200), makeLine(3, "INVEST", 100)],
      2: [makeLine(2, "LIQUIDITY", 180), makeLine(2, "INVEST", 90)],
      1: [makeLine(1, "LIQUIDITY", 150), makeLine(1, "INVEST", 80)],
    };

    const result = buildKpiDeltaForRange("28D", snapshots, [], snapshotLinesById);
    expect(result.status).toBe("OK");
    expect(result.meta?.startDate).toBe("2025-12-31");
    expect(result.meta?.endDate).toBe("2026-01-29");
    expect(result.deltas.total.deltaAbs).toBe(70);
  });

  test("weekly, four-week and monthly comparisons choose their own baseline", () => {
    const snapshots = [
      { id: 4, date: "2026-03-31" },
      { id: 3, date: "2026-03-24" },
      { id: 2, date: "2026-03-03" },
      { id: 1, date: "2026-02-28" },
    ];
    const lines = Object.fromEntries(snapshots.map(({ id }) => [id, [makeLine(id, "LIQUIDITY", id * 100)]]));
    const series = [{ date: "2026-03-31", total: 400, liquidity: 400, investments: 0 }];
    expect(buildKpiDeltaForRange("7D", snapshots, series, lines).deltas.total.deltaAbs).toBe(100);
    expect(buildKpiDeltaForRange("28D", snapshots, series, lines).deltas.total.deltaAbs).toBe(200);
    expect(buildKpiDeltaForRange("1M", snapshots, series, lines).deltas.total.deltaAbs).toBe(300);
  });

  test("28D: returns NO_DATA when start snapshot is missing", () => {
    const snapshots: Snapshot[] = [{ id: 1, date: "2026-01-29" }];
    const snapshotLinesById: Record<number, SnapshotLineDetail[]> = {
      1: [makeLine(1, "LIQUIDITY", 120), makeLine(1, "INVEST", 40)],
    };

    const result = buildKpiDeltaForRange("28D", snapshots, [], snapshotLinesById);
    expect(result.status).toBe("NO_DATA");
  });

  test("1D: keeps retirement savings separate from ordinary investments", () => {
    const snapshots: Snapshot[] = [
      { id: 2, date: "2026-01-29" },
      { id: 1, date: "2026-01-28" },
    ];
    const pensionStart = { ...makeLine(1, "INVEST", 100), wallet_id: 3, wallet_investment_kind: "PENSION" as const };
    const pensionEnd = { ...makeLine(2, "INVEST", 125), wallet_id: 3, wallet_investment_kind: "PENSION" as const };
    const result = buildKpiDeltaForRange("1D", snapshots, [], {
      1: [makeLine(1, "INVEST", 50), pensionStart],
      2: [makeLine(2, "INVEST", 60), pensionEnd],
    });

    expect(result.deltas.investments.deltaAbs).toBe(10);
    expect(result.deltas.pension.deltaAbs).toBe(25);
    expect(result.deltas.total.deltaAbs).toBe(35);
  });

  test("3M: uses complete snapshot history when the chart has missing months", () => {
    const snapshots: Snapshot[] = [
      { id: 2, date: "2026-01-31" },
      { id: 1, date: "2025-10-31" },
    ];
    const portfolioSeries: PortfolioPoint[] = [
      { date: "2025-12-01", total: 135, liquidity: 70, investments: 50, pension: 15 },
      { date: "2026-01-01", total: 150, liquidity: 75, investments: 55, pension: 20 },
    ];
    const pensionStart = {
      ...makeLine(1, "INVEST", 10),
      id: 13,
      wallet_id: 3,
      wallet_investment_kind: "PENSION" as const,
    };
    const snapshotLinesById: Record<number, SnapshotLineDetail[]> = {
      1: [makeLine(1, "LIQUIDITY", 60), makeLine(1, "INVEST", 40), pensionStart],
    };

    const result = buildKpiDeltaForRange("3M", snapshots, portfolioSeries, snapshotLinesById);
    expect(result.status).toBe("OK");
    expect(result.deltas.total.deltaAbs).toBe(40);
    expect(result.deltas.liquidity.deltaAbs).toBe(15);
    expect(result.deltas.investments.deltaAbs).toBe(15);
    expect(result.deltas.pension.deltaAbs).toBe(10);
    expect(result.meta?.startDate).toBe("2025-10-31");
    expect(result.meta?.endDate).toBe("2026-01-01");
  });
});
