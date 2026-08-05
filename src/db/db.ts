import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { migrations } from "./migrations";

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("openMoney.db").catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

type SqlArgs = (string | number | null)[];

type RowList<T = unknown> = {
  length: number;
  item: (index: number) => T;
};

export type SqlResult<T = unknown> = {
  rows: RowList<T>;
  insertId?: number;
  rowsAffected?: number;
};

function isQueryReturningRows(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  return upper.startsWith("SELECT") || upper.startsWith("PRAGMA");
}

export async function executeSql(sql: string, args: SqlArgs = []): Promise<SqlResult> {
  const db = await getDb();
  if (isQueryReturningRows(sql)) {
    const rows = await db.getAllAsync<unknown>(sql, args);
    return {
      rows: {
        length: rows.length,
        item: (index: number) => rows[index],
      },
    };
  }

  const result = await db.runAsync(sql, args);
  return {
    rows: {
      length: 0,
      item: () => {
        throw new Error("No rows available.");
      },
    },
    insertId: result.lastInsertRowId,
    rowsAffected: result.changes,
  };
}

export async function runSqlBatch(statements: { sql: string; args?: SqlArgs }[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const statement of statements) {
      await db.runAsync(statement.sql, statement.args ?? []);
    }
  });
}

async function getUserVersion(): Promise<number> {
  const result = await executeSql("PRAGMA user_version");
  return (result.rows.item(0) as { user_version: number }).user_version;
}

async function setUserVersion(version: number): Promise<void> {
  await executeSql(`PRAGMA user_version = ${version}`);
}

type TableInfoRow = {
  name?: string;
};

async function hasColumn(table: string, column: string): Promise<boolean> {
  const result = await executeSql(`PRAGMA table_info(${table})`);
  for (let i = 0; i < result.rows.length; i += 1) {
    const row = result.rows.item(i) as TableInfoRow;
    if (row.name === column) return true;
  }
  return false;
}

async function ensureCriticalSchema(): Promise<void> {
  // Self-heal for legacy DBs where user_version may be ahead but columns are missing.
  if (!(await hasColumn("income_entries", "end_date"))) {
    await executeSql("ALTER TABLE income_entries ADD COLUMN end_date TEXT");
  }
  if (!(await hasColumn("expense_entries", "end_date"))) {
    await executeSql("ALTER TABLE expense_entries ADD COLUMN end_date TEXT");
  }
  await executeSql("CREATE INDEX IF NOT EXISTS idx_income_end_date ON income_entries(end_date)");
  await executeSql("CREATE INDEX IF NOT EXISTS idx_expense_end_date ON expense_entries(end_date)");
  if (!(await hasColumn("wallets", "availability"))) {
    await executeSql("ALTER TABLE wallets ADD COLUMN availability TEXT");
  }
  if (!(await hasColumn("wallets", "availability_date"))) {
    await executeSql("ALTER TABLE wallets ADD COLUMN availability_date TEXT");
  }
  if (!(await hasColumn("wallets", "restriction_note"))) {
    await executeSql("ALTER TABLE wallets ADD COLUMN restriction_note TEXT");
  }
  if (!(await hasColumn("wallets", "investment_kind"))) {
    await executeSql("ALTER TABLE wallets ADD COLUMN investment_kind TEXT NOT NULL DEFAULT 'STANDARD'");
  }
  await executeSql(`UPDATE wallets SET availability = CASE
    WHEN UPPER(type) = 'LIQUIDITY' THEN 'immediate'
    WHEN LOWER(COALESCE(name, '') || ' ' || COALESCE(tag, '')) LIKE '%previdenz%'
      OR LOWER(COALESCE(name, '') || ' ' || COALESCE(tag, '')) LIKE '%pension%'
      OR LOWER(COALESCE(name, '') || ' ' || COALESCE(tag, '')) LIKE '%lecoip%'
      OR LOWER(COALESCE(name, '') || ' ' || COALESCE(tag, '')) LIKE '%pip%'
      OR LOWER(COALESCE(name, '') || ' ' || COALESCE(tag, '')) LIKE '%vincol%'
    THEN 'restricted' ELSE 'liquid' END
    WHERE availability IS NULL OR availability NOT IN ('immediate', 'liquid', 'restricted')`);
  await executeSql("CREATE INDEX IF NOT EXISTS idx_wallets_availability ON wallets(availability)");
  await executeSql(`UPDATE wallets SET investment_kind = CASE
    WHEN UPPER(type) = 'INVEST' AND (
      LOWER(COALESCE(name, '') || ' ' || COALESCE(tag, '')) LIKE '%previdenz%'
      OR LOWER(COALESCE(name, '') || ' ' || COALESCE(tag, '')) LIKE '%pension%'
      OR LOWER(COALESCE(name, '') || ' ' || COALESCE(tag, '')) LIKE '%pip%'
    ) THEN 'PENSION' ELSE 'STANDARD' END
    WHERE investment_kind IS NULL OR investment_kind NOT IN ('STANDARD', 'PENSION')`);
  await executeSql("UPDATE wallets SET availability = 'restricted' WHERE investment_kind = 'PENSION'");
  await executeSql("CREATE INDEX IF NOT EXISTS idx_wallets_investment_kind ON wallets(investment_kind)");
}

export async function runMigrations(): Promise<void> {
  const currentVersion = await getUserVersion();
  let version = currentVersion;
  for (const migration of migrations) {
    if (migration.version > version) {
      await runSqlBatch(migration.statements);
      version = migration.version;
      await setUserVersion(version);
    }
  }
  await ensureCriticalSchema();
}

export async function withTransaction(fn: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(() => fn(db));
}
