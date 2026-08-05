import type { AssetAvailability, Snapshot, SnapshotLineDetail, WalletType } from "@/repositories/types";

export type BreakdownItem = { label: string; value: number };
export type SnapshotPoint = { date: string; total: number };
export type SnapshotTotals = { liquidity: number; investments: number; pension: number; netWorth: number };
export type AvailabilityTotals = {
  immediate: number;
  liquid: number;
  restricted: number;
  available: number;
  total: number;
  availablePct: number;
  restrictedPct: number;
};

function availabilityForLine(line: SnapshotLineDetail): AssetAvailability {
  if (line.wallet_type === "LIQUIDITY") return "immediate";
  if (line.wallet_investment_kind === "PENSION") return "restricted";
  return line.wallet_availability === "restricted" ? "restricted" : "liquid";
}

export function totalsByAvailability(lines: SnapshotLineDetail[]): AvailabilityTotals {
  const parts = lines.reduce(
    (totals, line) => {
      totals[availabilityForLine(line)] += line.amount;
      return totals;
    },
    { immediate: 0, liquid: 0, restricted: 0 }
  );
  const available = parts.immediate + parts.liquid;
  const total = available + parts.restricted;
  return {
    ...parts,
    available,
    total,
    availablePct: total === 0 ? 0 : available / total,
    restrictedPct: total === 0 ? 0 : parts.restricted / total,
  };
}

export function breakdownByAvailability(lines: SnapshotLineDetail[]) {
  const grouped = new Map<AssetAvailability, SnapshotLineDetail[]>();
  lines.forEach((line) => {
    const availability = availabilityForLine(line);
    grouped.set(availability, [...(grouped.get(availability) ?? []), line]);
  });
  return grouped;
}

export function totalFromSnapshot(lines: SnapshotLineDetail[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

export function totalsByWalletType(lines: SnapshotLineDetail[]): SnapshotTotals {
  const totals = lines.reduce(
    (acc, line) => {
      if (line.wallet_type === "INVEST") {
        if (line.wallet_investment_kind === "PENSION") {
          acc.pension += line.amount;
        } else {
          acc.investments += line.amount;
        }
      } else {
        acc.liquidity += line.amount;
      }
      return acc;
    },
    { liquidity: 0, investments: 0, pension: 0 }
  );
  return { ...totals, netWorth: totals.liquidity + totals.investments + totals.pension };
}

export function breakdownByWallet(lines: SnapshotLineDetail[]): BreakdownItem[] {
  const map = new Map<string, number>();
  lines.forEach((line) => {
    const label = line.wallet_name ?? "Sconosciuto";
    map.set(label, (map.get(label) ?? 0) + line.amount);
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

export function breakdownInvestByTag(lines: SnapshotLineDetail[]): BreakdownItem[] {
  const map = new Map<string, number>();
  lines.forEach((line) => {
    if (line.wallet_type !== "INVEST") return;
    const label = line.wallet_tag ?? "Altro";
    map.set(label, (map.get(label) ?? 0) + line.amount);
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

export function snapshotSeries(
  snapshots: Snapshot[],
  linesBySnapshot: Record<number, SnapshotLineDetail[]>,
  limit = 12
): SnapshotPoint[] {
  const series = snapshots
    .map((snapshot) => ({
      date: snapshot.date,
      total: totalFromSnapshot(linesBySnapshot[snapshot.id] ?? []),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return series.slice(-limit);
}

export function sumByWalletType(lines: SnapshotLineDetail[], type: WalletType): number {
  return lines.reduce((sum, line) => (line.wallet_type === type ? sum + line.amount : sum), 0);
}
