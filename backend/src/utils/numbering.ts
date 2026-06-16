import { PoolConnection } from 'mysql2/promise';
import { Row } from '../config/db';

const PREFIX: Record<string, string> = {
  JOURNAL: 'JV', PAYMENT: 'PV', RECEIPT: 'RV', SALES: 'SV', PURCHASE: 'PUR',
  CONTRA: 'CV', DEBIT_NOTE: 'DN', CREDIT_NOTE: 'CN'
};

/** Generates sequential document numbers like SV-2026-00014 (per company, per type). */
export async function nextVoucherNo(conn: PoolConnection, companyId: number, type: string): Promise<string> {
  const [rows] = await conn.query<Row[]>(
    'SELECT COUNT(*) AS c FROM vouchers WHERE company_id = ? AND voucher_type = ? FOR UPDATE',
    [companyId, type]
  );
  const n = Number(rows[0].c) + 1;
  return `${PREFIX[type] ?? 'V'}-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
}

export async function nextDocNo(conn: PoolConnection, table: 'invoices' | 'bookings' | 'payments', companyId: number, prefix: string): Promise<string> {
  const [rows] = await conn.query<Row[]>(
    `SELECT COUNT(*) AS c FROM ${table} WHERE company_id = ? FOR UPDATE`, [companyId]
  );
  const n = Number(rows[0].c) + 1;
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
}
