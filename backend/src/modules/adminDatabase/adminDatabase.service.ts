import { RowDataPacket } from 'mysql2';
import { env } from '../../config/env';
import { query } from '../../config/db';
import { ApiError } from '../../utils/ApiError';

export interface TableInfo {
  name: string;
  rows: number;
  sizeBytes: number;
  updatedAt: string | null;
}

const IDENTIFIER = /^[A-Za-z0-9_]+$/;
const MAX_LIMIT = 500;

const quoteIdentifier = (value: string): string => {
  if (!IDENTIFIER.test(value)) throw ApiError.badRequest('Invalid table name');
  return `\`${value}\``;
};

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function ensureTable(table: string): Promise<void> {
  const rows = await query<RowDataPacket[]>(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      LIMIT 1`,
    [env.db.database, table]
  );
  if (rows.length === 0) throw ApiError.notFound('Table not found');
}

export const adminDatabaseService = {
  async tables(): Promise<TableInfo[]> {
    const rows = await query<RowDataPacket[]>(
      `SELECT
         TABLE_NAME AS name,
         COALESCE(TABLE_ROWS, 0) AS \`rows\`,
         COALESCE(DATA_LENGTH, 0) + COALESCE(INDEX_LENGTH, 0) AS sizeBytes,
         UPDATE_TIME AS updatedAt
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [env.db.database]
    );
    return rows as TableInfo[];
  },

  async tableData(table: string, limit = 100, offset = 0) {
    await ensureTable(table);
    const safeTable = quoteIdentifier(table);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), MAX_LIMIT);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const [columns, countRows, rows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT COLUMN_NAME AS name, DATA_TYPE AS type
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [env.db.database, table]
      ),
      query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${safeTable}`),
      query<RowDataPacket[]>(`SELECT * FROM ${safeTable} LIMIT ? OFFSET ?`, [safeLimit, safeOffset])
    ]);

    return {
      table,
      columns,
      rows,
      total: Number(countRows[0]?.total ?? 0),
      limit: safeLimit,
      offset: safeOffset
    };
  },

  async tableCsv(table: string): Promise<string> {
    await ensureTable(table);
    const safeTable = quoteIdentifier(table);
    const rows = await query<RowDataPacket[]>(`SELECT * FROM ${safeTable}`);
    const columns = rows.length > 0
      ? Object.keys(rows[0])
      : (await query<RowDataPacket[]>(
          `SELECT COLUMN_NAME AS name
             FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION`,
          [env.db.database, table]
        )).map((c) => String(c.name));

    return [
      columns.map(csvCell).join(','),
      ...rows.map((row) => columns.map((col) => csvCell(row[col])).join(','))
    ].join('\n');
  },

  async fullBackup() {
    const tables = await this.tables();
    const data: Record<string, RowDataPacket[]> = {};

    for (const table of tables) {
      const safeTable = quoteIdentifier(table.name);
      data[table.name] = await query<RowDataPacket[]>(`SELECT * FROM ${safeTable}`);
    }

    return {
      exportedAt: new Date().toISOString(),
      database: env.db.database,
      tables: tables.map((t) => t.name),
      data
    };
  }
};
