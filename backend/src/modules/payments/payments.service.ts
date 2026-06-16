import { PoolConnection } from 'mysql2/promise';
import { query, withTransaction, Row, WriteResult } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { round2 } from '../../utils/money';
import { nextDocNo } from '../../utils/numbering';
import { findLedgerId, moneyLedgerName } from '../../utils/systemLedgers';
import { postVoucherTx } from '../accounting/accounting.service';

export interface RecordPaymentInput {
  direction: 'IN' | 'OUT';
  customerId?: number;     // required for IN
  supplierId?: number;     // required for OUT
  invoiceId?: number;      // optional: settle a specific invoice (IN only)
  method: 'CASH' | 'BANK' | 'BKASH' | 'NAGAD' | 'CARD';
  amount: number;
  paymentDate: string;     // YYYY-MM-DD
  notes?: string;
}

/**
 * Money movement engine. Every payment row is backed by a balanced voucher:
 *
 *   IN  (customer pays us)   RECEIPT voucher   Dr Cash/Bank/Wallet
 *                                              Cr Customer A/R
 *   OUT (we pay a supplier)  PAYMENT voucher   Dr Supplier A/P
 *                                              Cr Cash/Bank/Wallet
 *
 * If an invoiceId is supplied, paid_amount/status on the invoice roll forward
 * (UNPAID → PARTIAL → PAID) inside the same transaction.
 */
export const paymentsService = {
  async list(companyId: number, filters: { direction?: string; from?: string; to?: string; q?: string }) {
    const where: string[] = ['p.company_id = ?'];
    const params: unknown[] = [companyId];
    if (filters.direction) { where.push('p.direction = ?'); params.push(filters.direction); }
    if (filters.from) { where.push('p.payment_date >= ?'); params.push(filters.from); }
    if (filters.to) { where.push('p.payment_date <= ?'); params.push(filters.to); }
    if (filters.q) {
      where.push('(p.payment_no LIKE ? OR c.name LIKE ? OR s.name LIKE ?)');
      params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }
    return query<Row[]>(
      `SELECT p.id, p.payment_no, p.direction, p.method, p.amount, p.payment_date, p.notes,
              c.name AS customer_name, s.name AS supplier_name,
              i.invoice_no, v.voucher_no
         FROM payments p
         LEFT JOIN customers c ON c.id = p.customer_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN invoices  i ON i.id = p.invoice_id
         LEFT JOIN vouchers  v ON v.id = p.voucher_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.payment_date DESC, p.id DESC
        LIMIT 300`, params);
  },

  async record(companyId: number, userId: number, input: RecordPaymentInput) {
    const amount = round2(input.amount);
    if (!(amount > 0)) throw ApiError.badRequest('Amount must be greater than zero');
    if (input.direction === 'IN' && !input.customerId)
      throw ApiError.badRequest('customerId is required for incoming payments');
    if (input.direction === 'OUT' && !input.supplierId)
      throw ApiError.badRequest('supplierId is required for outgoing payments');

    return withTransaction(async (conn) => {
      const moneyLedgerId = await findLedgerId(conn, companyId, moneyLedgerName(input.method));

      let partyLedgerId: number;
      let partyNote: string;
      if (input.direction === 'IN') {
        const c = await partyRow(conn, 'customers', companyId, input.customerId!);
        partyLedgerId = c.ledger_id; partyNote = `Received from ${c.name}`;
      } else {
        const s = await partyRow(conn, 'suppliers', companyId, input.supplierId!);
        partyLedgerId = s.ledger_id; partyNote = `Paid to ${s.name}`;
      }

      // ---- optional invoice settlement (locked so concurrent receipts can't overpay) ----
      let invoiceUpdate: { invoiceNo: string; paid: number; status: string } | null = null;
      if (input.invoiceId) {
        if (input.direction !== 'IN')
          throw ApiError.badRequest('Only incoming payments can settle an invoice');
        const [invRows] = await conn.query<Row[]>(
          `SELECT * FROM invoices WHERE id = ? AND company_id = ? FOR UPDATE`,
          [input.invoiceId, companyId]);
        if (!invRows.length) throw ApiError.notFound('Invoice not found');
        const inv = invRows[0];
        if (inv.status === 'VOID') throw ApiError.conflict('Invoice is void');
        if (inv.customer_id !== input.customerId)
          throw ApiError.badRequest('Invoice belongs to a different customer');
        const due = round2(Number(inv.total) - Number(inv.paid_amount));
        if (amount > due)
          throw ApiError.badRequest(`Payment ${amount.toFixed(2)} exceeds invoice due ${due.toFixed(2)}`);
        const newPaid = round2(Number(inv.paid_amount) + amount);
        const status = newPaid >= Number(inv.total) ? 'PAID' : 'PARTIAL';
        await conn.query(`UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?`,
          [newPaid, status, inv.id]);
        invoiceUpdate = { invoiceNo: inv.invoice_no, paid: newPaid, status };
      }

      // ---- balanced voucher ----
      const voucher = await postVoucherTx(conn, companyId, userId, {
        type: input.direction === 'IN' ? 'RECEIPT' : 'PAYMENT',
        date: input.paymentDate,
        reference: invoiceUpdate?.invoiceNo,
        narration: `${partyNote} via ${input.method}${input.notes ? ` — ${input.notes}` : ''}`,
        entries: input.direction === 'IN'
          ? [{ ledgerId: moneyLedgerId, type: 'DR', amount, note: input.method },
             { ledgerId: partyLedgerId, type: 'CR', amount, note: partyNote }]
          : [{ ledgerId: partyLedgerId, type: 'DR', amount, note: partyNote },
             { ledgerId: moneyLedgerId, type: 'CR', amount, note: input.method }]
      });

      const paymentNo = await nextDocNo(conn, 'payments', companyId, 'PMT');
      const [res] = await conn.query<WriteResult>(
        `INSERT INTO payments (company_id, payment_no, direction, customer_id, supplier_id,
                               invoice_id, method, amount, payment_date, voucher_id, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [companyId, paymentNo, input.direction, input.customerId ?? null, input.supplierId ?? null,
         input.invoiceId ?? null, input.method, amount, input.paymentDate,
         voucher.voucherId, input.notes ?? null, userId]);

      return { id: res.insertId, paymentNo, voucherNo: voucher.voucherNo, invoice: invoiceUpdate };
    });
  }
};

async function partyRow(conn: PoolConnection, table: 'customers' | 'suppliers', companyId: number, id: number): Promise<Row> {
  const [rows] = await conn.query<Row[]>(
    `SELECT id, name, ledger_id FROM ${table} WHERE company_id = ? AND id = ?`, [companyId, id]);
  if (!rows.length) throw ApiError.badRequest(`${table === 'customers' ? 'Customer' : 'Supplier'} does not exist`);
  return rows[0];
}
