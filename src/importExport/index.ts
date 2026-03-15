import * as FileSystem from "expo-file-system/legacy";
import { executeSql, runMigrations, withTransaction } from "@/db/db";
import type { ExportPayload } from "./types";
import { compareIsoDates, isIsoDate } from "@/utils/dates";
import { addYearsClamped } from "@/utils/recurrence";
import type { SnapshotLine } from "@/repositories/types";
import { DEFAULT_WALLET_COLOR } from "@/repositories/walletsRepo";

const REQUIRED_KEYS_V1: (keyof ExportPayload)[] = [
  "version",
  "wallets",
  "expense_categories",
  "income_entries",
  "expense_entries",
  "snapshots",
  "snapshot_lines",
];
const REQUIRED_KEYS_V2: (keyof ExportPayload)[] = [...REQUIRED_KEYS_V1, "preferences"];
const REQUIRED_KEYS_V3: (keyof ExportPayload)[] = [...REQUIRED_KEYS_V2, "wallet_order"];

type RecurringImportEntry = {
  start_date: string;
  end_date?: string | null;
  recurrence_frequency?: string | null;
  one_shot?: number;
};

function normalizeRecurringEndDate<T extends RecurringImportEntry>(entry: T): T {
  const recurring = entry.one_shot === 0 && Boolean(entry.recurrence_frequency);
  if (!recurring) {
    return { ...entry, end_date: entry.end_date ?? null };
  }
  const validEndDate =
    typeof entry.end_date === "string" &&
    isIsoDate(entry.end_date) &&
    isIsoDate(entry.start_date) &&
    compareIsoDates(entry.end_date, entry.start_date) >= 0;
  if (validEndDate) return entry;
  if (isIsoDate(entry.start_date)) {
    return { ...entry, end_date: addYearsClamped(entry.start_date, 20) };
  }
  return { ...entry, end_date: "2035-12-31" };
}

function normalizeImportPayload(payload: ExportPayload): ExportPayload {
  return {
    ...payload,
    income_entries: (payload.income_entries ?? []).map((entry) => normalizeRecurringEndDate(entry)),
    expense_entries: (payload.expense_entries ?? []).map((entry) => normalizeRecurringEndDate(entry)),
  };
}

export function validateExportPayload(payload: ExportPayload): string[] {
  const errors: string[] = [];
  const requiredKeys =
    payload.version >= 3 ? REQUIRED_KEYS_V3 : payload.version >= 2 ? REQUIRED_KEYS_V2 : REQUIRED_KEYS_V1;
  for (const key of requiredKeys) {
    if (!(key in payload)) {
      errors.push(`Campo mancante: ${String(key)}`);
    }
  }

  const requiredFields: { list: Record<string, unknown>[]; fields: string[]; label: string }[] = [
    { list: payload.wallets ?? [], fields: ["id", "name", "type", "currency"], label: "wallets" },
    { list: payload.expense_categories ?? [], fields: ["id", "name"], label: "expense_categories" },
    { list: payload.income_entries ?? [], fields: ["id", "name", "amount", "start_date"], label: "income_entries" },
    { list: payload.expense_entries ?? [], fields: ["id", "name", "amount", "start_date", "expense_category_id"], label: "expense_entries" },
    { list: payload.snapshots ?? [], fields: ["id", "date"], label: "snapshots" },
    { list: payload.snapshot_lines ?? [], fields: ["id", "snapshot_id", "wallet_id", "amount"], label: "snapshot_lines" },
  ];
  if (payload.preferences) {
    requiredFields.push({
      list: payload.preferences ?? [],
      fields: ["key", "value"],
      label: "preferences",
    });
  }

  requiredFields.forEach((group) => {
    group.list.forEach((row, index) => {
      group.fields.forEach((field) => {
        if (row[field] === undefined || row[field] === null) {
          errors.push(`Campo mancante in ${group.label}[${index}]: ${field}`);
        }
      });
    });
  });

  const dateFields: { list: { date?: string; start_date?: string; end_date?: string | null }[]; label: string; key: "date" | "start_date" }[] = [
    { list: payload.income_entries ?? [], label: "income_entries", key: "start_date" },
    { list: payload.expense_entries ?? [], label: "expense_entries", key: "start_date" },
    { list: payload.snapshots ?? [], label: "snapshots", key: "date" },
  ];

  for (const field of dateFields) {
    field.list.forEach((row, index) => {
      const value = row[field.key];
      if (!value || !isIsoDate(value)) {
        errors.push(`Data non valida in ${field.label}[${index}]: ${value}`);
      }
    });
  }

  const optionalEndDateFields: { list: { end_date?: string | null }[]; label: string }[] = [
    { list: payload.income_entries ?? [], label: "income_entries" },
    { list: payload.expense_entries ?? [], label: "expense_entries" },
  ];
  for (const field of optionalEndDateFields) {
    field.list.forEach((row, index) => {
      const value = row.end_date;
      if (value !== undefined && value !== null && value !== "" && !isIsoDate(value)) {
        errors.push(`Data non valida in ${field.label}[${index}]: ${value}`);
      }
    });
  }

  const recurringGroups: {
    list: Array<{ start_date: string; end_date?: string | null; recurrence_frequency?: string | null; one_shot?: number }>;
    label: string;
  }[] = [
    { list: payload.income_entries ?? [], label: "income_entries" },
    { list: payload.expense_entries ?? [], label: "expense_entries" },
  ];
  for (const group of recurringGroups) {
    group.list.forEach((row, index) => {
      const recurring = row.one_shot === 0 && Boolean(row.recurrence_frequency);
      if (!recurring) return;
      if (!row.end_date || !isIsoDate(row.end_date)) {
        errors.push(`Data fine obbligatoria in ${group.label}[${index}] per voce ricorrente`);
        return;
      }
      if (isIsoDate(row.start_date) && compareIsoDates(row.end_date, row.start_date) < 0) {
        errors.push(`Data fine precedente alla data inizio in ${group.label}[${index}]`);
      }
    });
  }

  return errors;
}

export async function exportToJson(): Promise<ExportPayload> {
  const tables = [
    "wallets",
    "expense_categories",
    "income_entries",
    "expense_entries",
    "snapshots",
    "snapshot_lines",
    "preferences",
  ] as const;

  const payload: Partial<ExportPayload> = { version: 3 };

  const isSensitivePreference = (key: string) => {
    const lowered = key.toLowerCase();
    return lowered.includes("pin") || lowered.includes("face") || lowered.includes("biometr");
  };

  for (const table of tables) {
    const result = await executeSql(`SELECT * FROM ${table}`);
    const rows: unknown[] = [];
    for (let i = 0; i < result.rows.length; i += 1) {
      rows.push(result.rows.item(i));
    }
    if (table === "preferences") {
      const filtered = (rows as Array<{ key?: string }>).filter(
        (row) => (row.key ? !isSensitivePreference(row.key) : true)
      );
      (payload as Record<string, unknown>)[table] = filtered;
    } else {
      (payload as Record<string, unknown>)[table] = rows;
    }
  }

  const wallets = (payload.wallets ?? []) as Array<{ id: number; type?: string; sort_order?: number; sortOrder?: number }>;
  const walletOrder = [...wallets]
    .sort((a, b) => {
      const typeA = String(a.type ?? "").toLowerCase() === "liquidity" ? 0 : 1;
      const typeB = String(b.type ?? "").toLowerCase() === "liquidity" ? 0 : 1;
      if (typeA !== typeB) return typeA - typeB;
      const sortA = a.sort_order ?? a.sortOrder ?? 0;
      const sortB = b.sort_order ?? b.sortOrder ?? 0;
      if (sortA !== sortB) return sortA - sortB;
      return (a.id ?? 0) - (b.id ?? 0);
    })
    .map((wallet) => wallet.id);
  payload.wallet_order = walletOrder;

  return payload as ExportPayload;
}

export async function exportToFile(filePath: string): Promise<void> {
  const payload = await exportToJson();
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(payload, null, 2));
}

export async function importFromJson(payload: ExportPayload): Promise<void> {
  await runMigrations();
  const normalizedPayload = normalizeImportPayload(payload);
  const errors = validateExportPayload(normalizedPayload);
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }

  await withTransaction(async (db) => {
    const tables = [
      "snapshot_lines",
      "snapshots",
      "income_entries",
      "expense_entries",
      "wallets",
      "expense_categories",
      ...(normalizedPayload.preferences ? ["preferences"] : []),
    ];

    for (const table of tables) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    const walletOrderMap = new Map<number, number>();
    if (normalizedPayload.wallet_order?.length) {
      normalizedPayload.wallet_order.forEach((id, index) => walletOrderMap.set(id, index));
    }

    for (const row of normalizedPayload.wallets) {
      const sortOrderFromPayload =
        (row as unknown as { sort_order?: number; sortOrder?: number }).sort_order ??
        (row as unknown as { sortOrder?: number }).sortOrder;
      const sortOrder = sortOrderFromPayload ?? walletOrderMap.get(row.id) ?? 0;
      await db.runAsync(
        "INSERT INTO wallets (id, name, type, currency, tag, active, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          row.id,
          row.name,
          row.type,
          row.currency,
          row.tag,
          row.active,
          row.color ?? DEFAULT_WALLET_COLOR,
          sortOrder,
        ]
      );
    }

    for (const row of normalizedPayload.expense_categories) {
      await db.runAsync("INSERT INTO expense_categories (id, name, active, color) VALUES (?, ?, ?, ?)", [
        row.id,
        row.name,
        row.active ?? 1,
        row.color ?? DEFAULT_WALLET_COLOR,
      ]);
    }

    for (const row of normalizedPayload.income_entries) {
      await db.runAsync(
        `INSERT INTO income_entries
        (id, name, amount, start_date, end_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.name,
          row.amount,
          row.start_date,
          row.end_date ?? null,
          row.recurrence_frequency,
          row.recurrence_interval,
          row.one_shot,
          row.note,
          row.active,
          row.wallet_id,
        ]
      );
    }

    for (const row of normalizedPayload.expense_entries) {
      await db.runAsync(
        `INSERT INTO expense_entries
        (id, name, amount, start_date, end_date, recurrence_frequency, recurrence_interval, one_shot, note, active, wallet_id, expense_category_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.name,
          row.amount,
          row.start_date,
          row.end_date ?? null,
          row.recurrence_frequency,
          row.recurrence_interval,
          row.one_shot,
          row.note,
          row.active,
          row.wallet_id,
          row.expense_category_id,
        ]
      );
    }

    for (const row of normalizedPayload.snapshots) {
      await db.runAsync("INSERT INTO snapshots (id, date) VALUES (?, ?)", [row.id, row.date]);
    }

    for (const row of normalizedPayload.snapshot_lines as SnapshotLine[]) {
      await db.runAsync(
        `INSERT INTO snapshot_lines
        (id, snapshot_id, wallet_id, amount)
        VALUES (?, ?, ?, ?)`,
        [row.id, row.snapshot_id, row.wallet_id, row.amount]
      );
    }

    if (normalizedPayload.preferences) {
      for (const row of normalizedPayload.preferences) {
        await db.runAsync("INSERT INTO preferences (key, value) VALUES (?, ?)", [
          row.key,
          row.value,
        ]);
      }
    }
  });
}

export async function importFromFile(filePath: string): Promise<void> {
  const content = await FileSystem.readAsStringAsync(filePath);
  const payload = JSON.parse(content) as ExportPayload;
  await importFromJson(payload);
}
