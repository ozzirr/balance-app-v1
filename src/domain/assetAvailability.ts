import type { AssetAvailability, InvestmentKind, WalletType } from "@/repositories/types";

const RESTRICTED_HINTS = [
  "previdenza",
  "pensione",
  "fondo pensione",
  "pip",
  "lecoip",
  "vincol",
  "lock-up",
  "lockup",
];

export function inferAssetAvailability(
  type: WalletType,
  name?: string | null,
  tag?: string | null
): AssetAvailability {
  if (type === "LIQUIDITY") return "immediate";
  const searchable = `${name ?? ""} ${tag ?? ""}`.toLocaleLowerCase("it");
  return RESTRICTED_HINTS.some((hint) => searchable.includes(hint)) ? "restricted" : "liquid";
}

export function normalizeAssetAvailability(
  type: WalletType,
  availability: AssetAvailability,
  investmentKind: InvestmentKind = "STANDARD"
): AssetAvailability {
  if (type === "LIQUIDITY") return "immediate";
  if (investmentKind === "PENSION") return "restricted";
  return availability === "restricted" ? "restricted" : "liquid";
}

export function inferInvestmentKind(
  type: WalletType,
  name?: string | null,
  tag?: string | null
): InvestmentKind {
  if (type === "LIQUIDITY") return "STANDARD";
  const searchable = `${name ?? ""} ${tag ?? ""}`.toLocaleLowerCase("it");
  return searchable.includes("previdenz") || searchable.includes("pension") || searchable.includes("pip")
    ? "PENSION"
    : "STANDARD";
}

export function normalizeInvestmentKind(type: WalletType, kind: InvestmentKind): InvestmentKind {
  return type === "INVEST" && kind === "PENSION" ? "PENSION" : "STANDARD";
}

export function isInvestmentKind(value: unknown): value is InvestmentKind {
  return value === "STANDARD" || value === "PENSION";
}

export function isAssetAvailability(value: unknown): value is AssetAvailability {
  return value === "immediate" || value === "liquid" || value === "restricted";
}
