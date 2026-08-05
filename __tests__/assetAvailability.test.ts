import {
  inferAssetAvailability,
  inferInvestmentKind,
  isAssetAvailability,
  normalizeAssetAvailability,
} from "@/domain/assetAvailability";
import { totalsByAvailability } from "@/domain/calculations";
import type { AssetAvailability, SnapshotLineDetail } from "@/repositories/types";
import { migrations } from "@/db/migrations";

function line(id: number, amount: number, availability: AssetAvailability, type: "LIQUIDITY" | "INVEST" = "INVEST"): SnapshotLineDetail {
  return {
    id,
    snapshot_id: 1,
    wallet_id: id,
    amount,
    wallet_name: `Prodotto ${id}`,
    wallet_type: type,
    wallet_tag: null,
    wallet_availability: availability,
    wallet_availability_date: null,
    wallet_restriction_note: null,
  };
}

describe("asset availability totals", () => {
  const lines = [
    line(1, 2500, "immediate", "LIQUIDITY"),
    line(2, 1743.7, "liquid"),
    line(3, 3047, "restricted"),
  ];

  test("calculates total, available, restricted, immediate and liquid without double counting", () => {
    expect(totalsByAvailability(lines)).toEqual({
      immediate: 2500,
      liquid: 1743.7,
      restricted: 3047,
      available: 4243.7,
      total: 7290.7,
      availablePct: 4243.7 / 7290.7,
      restrictedPct: 3047 / 7290.7,
    });
  });

  test("excludes restricted products from available assets", () => {
    const totals = totalsByAvailability([line(1, 500, "restricted")]);
    expect(totals.available).toBe(0);
    expect(totals.restricted).toBe(500);
  });

  test("includes liquid investments in available assets", () => {
    expect(totalsByAvailability([line(1, 500, "liquid")]).available).toBe(500);
  });

  test("includes current accounts in immediate cash", () => {
    expect(totalsByAvailability([line(1, 500, "immediate", "LIQUIDITY")]).immediate).toBe(500);
  });

  test("always treats liquidity wallets as immediate even if legacy data says otherwise", () => {
    const totals = totalsByAvailability([line(1, 500, "restricted", "LIQUIDITY")]);
    expect(totals.immediate).toBe(500);
    expect(totals.restricted).toBe(0);
  });

  test("recalculates after a product availability is changed", () => {
    const product = line(1, 500, "liquid");
    expect(totalsByAvailability([product]).available).toBe(500);
    expect(totalsByAvailability([{ ...product, wallet_availability: "restricted" }]).available).toBe(0);
  });

  test("handles a zero total without division by zero", () => {
    const totals = totalsByAvailability([]);
    expect(totals.total).toBe(0);
    expect(totals.availablePct).toBe(0);
    expect(totals.restrictedPct).toBe(0);
  });

  test("preserves negative values", () => {
    const totals = totalsByAvailability([line(1, -100, "immediate"), line(2, 40, "restricted")]);
    expect(totals.available).toBe(-100);
    expect(totals.restricted).toBe(40);
    expect(totals.total).toBe(-60);
  });

  test("uses the legacy type fallback when availability is absent", () => {
    const legacyLiquidity = { ...line(1, 100, "immediate", "LIQUIDITY"), wallet_availability: undefined };
    const legacyInvestment = { ...line(2, 200, "liquid"), wallet_availability: undefined };
    const totals = totalsByAvailability([legacyLiquidity, legacyInvestment]);
    expect(totals.immediate).toBe(100);
    expect(totals.liquid).toBe(200);
  });
});

describe("availability migration defaults", () => {
  test("migration 10 only extends and classifies wallets without deleting data", () => {
    const migration = migrations.find((item) => item.version === 10);
    expect(migration).toBeDefined();
    const sql = migration?.statements.map((statement) => statement.sql.toUpperCase()).join("\n") ?? "";
    expect(sql).toContain("ALTER TABLE WALLETS ADD COLUMN AVAILABILITY");
    expect(sql).toContain("UPDATE WALLETS");
    expect(sql).not.toContain("DELETE FROM");
    expect(sql).not.toContain("DROP TABLE");
  });

  test.each([
    ["LIQUIDITY", "Conto corrente", null, "immediate"],
    ["INVEST", "ETF globale", "ETF", "liquid"],
    ["INVEST", "Fondo pensione", "Previdenza", "restricted"],
    ["INVEST", "PIP personale", null, "restricted"],
    ["INVEST", "LECOIP 2026-2029", null, "restricted"],
    ["INVEST", "Prodotto non riconosciuto", null, "liquid"],
  ] as const)("classifies %s / %s safely", (type, name, tag, expected) => {
    expect(inferAssetAvailability(type, name, tag)).toBe(expected);
  });

  test("accepts a manually changed availability", () => {
    expect(isAssetAvailability("restricted")).toBe(true);
    expect(isAssetAvailability("custom")).toBe(false);
  });

  test("normalizes availability according to the wallet type", () => {
    expect(normalizeAssetAvailability("LIQUIDITY", "restricted")).toBe("immediate");
    expect(normalizeAssetAvailability("INVEST", "immediate")).toBe("liquid");
    expect(normalizeAssetAvailability("INVEST", "restricted")).toBe("restricted");
    expect(normalizeAssetAvailability("INVEST", "liquid", "PENSION")).toBe("restricted");
  });

  test("recognizes previdential investments without changing the technical wallet type", () => {
    expect(inferInvestmentKind("INVEST", "Fondo pensione", null)).toBe("PENSION");
    expect(inferInvestmentKind("INVEST", "Generali", "PIP")).toBe("PENSION");
    expect(inferInvestmentKind("INVEST", "Broker", "ETF")).toBe("STANDARD");
    expect(inferInvestmentKind("LIQUIDITY", "Pensione", null)).toBe("STANDARD");
  });

  test("migration 11 adds and safely classifies the investment category", () => {
    const migration = migrations.find((item) => item.version === 11);
    const sql = migration?.statements.map((statement) => statement.sql.toUpperCase()).join("\n") ?? "";
    expect(sql).toContain("INVESTMENT_KIND");
    expect(sql).toContain("PENSION");
    expect(sql).not.toContain("DELETE FROM");
    expect(sql).not.toContain("DROP TABLE");
  });
});
