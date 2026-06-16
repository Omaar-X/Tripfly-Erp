import { query, withTransaction, Row, WriteResult } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { round2 } from '../../utils/money';
import { nextDocNo } from '../../utils/numbering';
import { postVoucherTx } from '../accounting/accounting.service';

export interface ManualInvoiceInput {
  customerId: number;
  invoiceDate: string;
  dueDate?: string;
  incomeLedgerId: number;          // which Sales ledger the revenue credits
  discount?: number;
  vatPercent?: number;
  items: { description: string; quantity: number; rate: number }[];
}

export const invoicesService = {
  async list(companyId: number, filters: { status?: string; customerId?: number; q?: string }) {
    const where: string[] = ['i.company_id = ?'];
    const params: unknown[] = [companyId];
    if (filters.status) { where.push('i.status = ?'); params.push(filters.status); }
    if (filters.customerId) { where.push('i.customer_id = ?'); params.push(filters.customerId); }
    if (filters.q) { where.push('(i.invoice_no LIKE ? OR c.name LIKE ?)'); params.push(`%${filters.q}%`, `%${filters.q}%`); }
    return query<Row[]>(
      `SELECT i.id, i.invoice_no, i.invoice_date, i.due_date, i.subtotal, i.discount,
              i.vat_percent, i.vat_amount, i.total, i.paid_amount,
              (i.total - i.paid_amount) AS due, i.status,
              c.id AS customer_id, c.name AS customer_name, b.booking_no
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         LEFT JOIN bookings b ON b.id = i.booking_id
        WHERE ${where.join(' AND ')}
        ORDER BY i.id DESC
        LIMIT 300`, params);
  },

  async get(companyId: number, id: number) {
    const rows = await query<Row[]>(
      `SELECT i.*, (i.total - i.paid_amount) AS due,
              c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              c.address AS customer_address, b.booking_no, v.voucher_no
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         LEFT JOIN bookings b ON b.id = i.booking_id
         LEFT JOIN vouchers v ON v.id = i.voucher_id
        WHERE i.company_id = ? AND i.id = ?`, [companyId, id]);
    if (!rows.length) throw ApiError.notFound('Invoice not found');
    const items = await query<Row[]>(
      `SELECT description, quantity, rate, amount FROM invoice_items WHERE invoice_id = ? ORDER BY id`, [id]);
    const payments = await query<Row[]>(
      `SELECT payment_no, method, amount, payment_date FROM payments
        WHERE invoice_id = ? ORDER BY payment_date, id`, [id]);
    return { ...rows[0], items, payments };
  },

  /**
   * Manual invoice (not booking-driven) — e.g. visa processing fees, service
   * charges. Posts the same SALES voucher pattern as a confirmed booking.
   */
  async createManual(companyId: number, userId: number, input: ManualInvoiceInput) {
    if (!input.items.length) throw ApiError.badRequest('Invoice needs at least one line item');
    const lines = input.items.map(it => ({
      ...it,
      quantity: round2(it.quantity),
      rate: round2(it.rate),
      amount: round2(it.quantity * it.rate)
    }));
    if (lines.some(l => l.amount <= 0)) throw ApiError.badRequest('Every line amount must be positive');

    const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
    const discount = round2(input.discount ?? 0);
    if (discount < 0 || discount > subtotal) throw ApiError.badRequest('Invalid discount');
    const vatPercent = round2(input.vatPercent ?? 0);
    const taxable = round2(subtotal - discount);
    const vatAmount = round2(taxable * vatPercent / 100);
    const total = round2(taxable + vatAmount);

    return withTransaction(async (conn) => {
      const [custRows] = await conn.query<Row[]>(
        `SELECT id, name, ledger_id FROM customers WHERE company_id = ? AND id = ?`,
        [companyId, input.customerId]);
      if (!custRows.length) throw ApiError.badRequest('Customer does not exist');
      const customer = custRows[0];

      const [ledRows] = await conn.query<Row[]>(
        `SELECT l.id FROM ledgers l JOIN ledger_groups g ON g.id = l.group_id
          WHERE l.company_id = ? AND l.id = ? AND g.nature = 'INCOME'`,
        [companyId, input.incomeLedgerId]);
      if (!ledRows.length) throw ApiError.badRequest('incomeLedgerId must be an INCOME ledger');

      const entries = [
        { ledgerId: customer.ledger_id as number, type: 'DR' as const, amount: total, note: `Invoice to ${customer.name}` },
        { ledgerId: input.incomeLedgerId, type: 'CR' as const, amount: taxable, note: 'Service revenue' }
      ];
      if (vatAmount > 0) {
        const [vatRows] = await conn.query<Row[]>(
          `SELECT id FROM ledgers WHERE company_id = ? AND name = 'VAT Payable'`, [companyId]);
        if (!vatRows.length) throw ApiError.badRequest('VAT Payable ledger missing — run seed.sql');
        entries.push({ ledgerId: vatRows[0].id as number, type: 'CR' as const, amount: vatAmount, note: `VAT ${vatPercent}%` });
      }
      const voucher = await postVoucherTx(conn, companyId, userId, {
        type: 'SALES', date: input.invoiceDate,
        narration: `Manual invoice for ${customer.name}`, entries
      });

      const invoiceNo = await nextDocNo(conn, 'invoices', companyId, 'INV');
      const [invRes] = await conn.query<WriteResult>(
        `INSERT INTO invoices (company_id, invoice_no, customer_id, invoice_date, due_date,
                               subtotal, discount, vat_percent, vat_amount, total, voucher_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [companyId, invoiceNo, input.customerId, input.invoiceDate, input.dueDate ?? null,
         subtotal, discount, vatPercent, vatAmount, total, voucher.voucherId]);
      const invoiceId = invRes.insertId;
      const values = lines.map(l => [invoiceId, l.description, l.quantity, l.rate, l.amount]);
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES ?`, [values]);

      return { id: invoiceId, invoiceNo, subtotal, discount, vatPercent, vatAmount, total,
               voucherNo: voucher.voucherNo };
    });
  }
};
