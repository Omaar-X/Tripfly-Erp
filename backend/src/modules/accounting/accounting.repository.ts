import { PoolConnection } from 'mysql2/promise';
import { query, Row, WriteResult } from '../../config/db';

export interface VoucherEntryInput {
  ledgerId: number;
  type: 'DR' | 'CR';
  amount: number;
  note?: string;
}

export const accountingRepo = {
  // ---------------- ledger groups ----------------
  listGroups: (companyId: number) =>
    query<Row[]>(
      `SELECT g.id, g.name, g.nature, g.parent_id, p.name AS parent_name
         FROM ledger_groups g LEFT JOIN ledger_groups p ON p.id = g.parent_id
        WHERE g.company_id = ? ORDER BY g.nature, g.name`, [companyId]),

  // ---------------- ledgers ----------------
  listLedgers: (companyId: number) =>
    query<Row[]>(
      `SELECT l.id, l.name, l.opening_balance, l.opening_type, l.is_system,
              g.name AS group_name, g.nature,
              COALESCE(SUM(CASE WHEN ve.entry_type = 'DR' THEN ve.amount ELSE 0 END), 0) AS total_debit,
              COALESCE(SUM(CASE WHEN ve.entry_type = 'CR' THEN ve.amount ELSE 0 END), 0) AS total_credit
         FROM ledgers l
         JOIN ledger_groups g ON g.id = l.group_id
         LEFT JOIN voucher_entries ve ON ve.ledger_id = l.id
        WHERE l.company_id = ?
        GROUP BY l.id, l.name, l.opening_balance, l.opening_type, l.is_system, g.name, g.nature
        ORDER BY g.nature, l.name`, [companyId]),

  getLedger: async (companyId: number, id: number) => {
    const rows = await query<Row[]>(
      `SELECT l.*, g.name AS group_name, g.nature FROM ledgers l
         JOIN ledger_groups g ON g.id = l.group_id
        WHERE l.company_id = ? AND l.id = ?`, [companyId, id]);
    return rows[0];
  },

  /** Statement of a single ledger with every voucher line that touched it. */
  ledgerStatement: (companyId: number, ledgerId: number, from: string, to: string) =>
    query<Row[]>(
      `SELECT v.voucher_date, v.voucher_no, v.voucher_type, v.narration,
              ve.entry_type, ve.amount
         FROM voucher_entries ve
         JOIN vouchers v ON v.id = ve.voucher_id
        WHERE v.company_id = ? AND ve.ledger_id = ? AND v.voucher_date BETWEEN ? AND ?
        ORDER BY v.voucher_date, v.id`, [companyId, ledgerId, from, to]),

  createLedger: async (conn: PoolConnection, companyId: number,
    input: { groupId: number; name: string; openingBalance: number; openingType: 'DR' | 'CR' }) => {
    const [result] = await conn.query<WriteResult>(
      `INSERT INTO ledgers (company_id, group_id, name, opening_balance, opening_type)
       VALUES (?,?,?,?,?)`,
      [companyId, input.groupId, input.name, input.openingBalance, input.openingType]);
    return result.insertId;
  },

  // ---------------- vouchers ----------------
  insertVoucher: async (conn: PoolConnection, v: {
    companyId: number; voucherNo: string; type: string; date: string;
    narration?: string; reference?: string; total: number; createdBy: number;
  }) => {
    const [result] = await conn.query<WriteResult>(
      `INSERT INTO vouchers (company_id, voucher_no, voucher_type, voucher_date, narration, reference, total_amount, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [v.companyId, v.voucherNo, v.type, v.date, v.narration ?? null, v.reference ?? null, v.total, v.createdBy]);
    return result.insertId;
  },

  insertEntries: async (conn: PoolConnection, voucherId: number, entries: VoucherEntryInput[]) => {
    const values = entries.map(e => [voucherId, e.ledgerId, e.type, e.amount, e.note ?? null]);
    await conn.query(
      'INSERT INTO voucher_entries (voucher_id, ledger_id, entry_type, amount, line_note) VALUES ?', [values]);
  },

  listVouchers: (companyId: number, filters: { type?: string; from?: string; to?: string; limit: number; offset: number }) => {
    const where: string[] = ['v.company_id = ?'];
    const params: unknown[] = [companyId];
    if (filters.type) { where.push('v.voucher_type = ?'); params.push(filters.type); }
    if (filters.from) { where.push('v.voucher_date >= ?'); params.push(filters.from); }
    if (filters.to)   { where.push('v.voucher_date <= ?'); params.push(filters.to); }
    params.push(filters.limit, filters.offset);
    return query<Row[]>(
      `SELECT v.id, v.voucher_no, v.voucher_type, v.voucher_date, v.narration, v.reference,
              v.total_amount, u.name AS created_by_name, v.created_at
         FROM vouchers v JOIN users u ON u.id = v.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY v.voucher_date DESC, v.id DESC
        LIMIT ? OFFSET ?`, params);
  },

  getVoucher: async (companyId: number, id: number) => {
    const heads = await query<Row[]>(
      `SELECT v.*, u.name AS created_by_name FROM vouchers v
         JOIN users u ON u.id = v.created_by WHERE v.company_id = ? AND v.id = ?`, [companyId, id]);
    if (!heads[0]) return undefined;
    const entries = await query<Row[]>(
      `SELECT ve.id, ve.ledger_id, l.name AS ledger_name, ve.entry_type, ve.amount, ve.line_note
         FROM voucher_entries ve JOIN ledgers l ON l.id = ve.ledger_id
        WHERE ve.voucher_id = ? ORDER BY ve.entry_type, ve.id`, [id]);
    return { ...heads[0], entries };
  }
};
