import { PoolConnection } from 'mysql2/promise';
import { query, withTransaction, Row, WriteResult } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { round2 } from '../../utils/money';
import { nextDocNo } from '../../utils/numbering';
import { findLedgerId, salesLedgerName, SYSTEM_LEDGERS } from '../../utils/systemLedgers';
import { postVoucherTx } from '../accounting/accounting.service';

export interface CreateBookingInput {
  customerId: number;
  bookingType: 'FLIGHT' | 'HOTEL' | 'TOUR';
  travelDate?: string;
  returnDate?: string;
  details?: Record<string, unknown>;   // PNR, airline, hotel name, pax list…
  costPrice: number;                   // payable to supplier
  salePrice: number;                   // billed to customer
  supplierId?: number;
  agentId?: number;                    // selling employee → commission
}

export interface ConfirmBookingInput {
  vatPercent?: number;                 // e.g. 5 → adds BD VAT on top
  discount?: number;                   // flat discount off sale price
  dueDate?: string;
}

/**
 * Booking lifecycle:
 *   PENDING ──confirm()──▶ CONFIRMED   (auto-invoice + SALES voucher + supplier liability)
 *   PENDING ──cancel()───▶ CANCELLED
 *   CONFIRMED ─cancel()──▶ CANCELLED   (invoice voided, reversing CREDIT_NOTE posted)
 */
export const bookingsService = {
  async list(companyId: number, filters: { status?: string; type?: string; customerId?: number; q?: string }) {
    const where: string[] = ['b.company_id = ?'];
    const params: unknown[] = [companyId];
    if (filters.status) { where.push('b.status = ?'); params.push(filters.status); }
    if (filters.type) { where.push('b.booking_type = ?'); params.push(filters.type); }
    if (filters.customerId) { where.push('b.customer_id = ?'); params.push(filters.customerId); }
    if (filters.q) { where.push('(b.booking_no LIKE ? OR c.name LIKE ?)'); params.push(`%${filters.q}%`, `%${filters.q}%`); }
    return query<Row[]>(
      `SELECT b.id, b.booking_no, b.booking_type, b.status, b.travel_date, b.return_date,
              b.cost_price, b.sale_price, (b.sale_price - b.cost_price) AS margin,
              b.details, b.invoice_id, b.created_at,
              c.id AS customer_id, c.name AS customer_name,
              s.name AS supplier_name, e.name AS agent_name, i.invoice_no
         FROM bookings b
         JOIN customers c ON c.id = b.customer_id
         LEFT JOIN suppliers s ON s.id = b.supplier_id
         LEFT JOIN employees e ON e.id = b.agent_id
         LEFT JOIN invoices  i ON i.id = b.invoice_id
        WHERE ${where.join(' AND ')}
        ORDER BY b.id DESC
        LIMIT 300`, params);
  },

  async get(companyId: number, id: number) {
    const rows = await query<Row[]>(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone,
              s.name AS supplier_name, e.name AS agent_name, i.invoice_no
         FROM bookings b
         JOIN customers c ON c.id = b.customer_id
         LEFT JOIN suppliers s ON s.id = b.supplier_id
         LEFT JOIN employees e ON e.id = b.agent_id
         LEFT JOIN invoices  i ON i.id = b.invoice_id
        WHERE b.company_id = ? AND b.id = ?`, [companyId, id]);
    if (!rows.length) throw ApiError.notFound('Booking not found');
    return rows[0];
  },

  /** Customer travel history — every trip ever booked, newest first. */
  async travelHistory(companyId: number, customerId: number) {
    return query<Row[]>(
      `SELECT b.id, b.booking_no, b.booking_type, b.status, b.travel_date, b.return_date,
              b.sale_price, b.details, i.invoice_no
         FROM bookings b LEFT JOIN invoices i ON i.id = b.invoice_id
        WHERE b.company_id = ? AND b.customer_id = ?
        ORDER BY COALESCE(b.travel_date, DATE(b.created_at)) DESC`, [companyId, customerId]);
  },

  async create(companyId: number, userId: number, input: CreateBookingInput) {
    if (input.salePrice < 0 || input.costPrice < 0)
      throw ApiError.badRequest('Prices cannot be negative');
    return withTransaction(async (conn) => {
      await assertCustomer(conn, companyId, input.customerId);
      const bookingNo = await nextDocNo(conn, 'bookings', companyId, 'BK');
      const [res] = await conn.query<WriteResult>(
        `INSERT INTO bookings (company_id, booking_no, customer_id, booking_type, travel_date,
                               return_date, details, cost_price, sale_price, supplier_id, agent_id, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [companyId, bookingNo, input.customerId, input.bookingType, input.travelDate ?? null,
         input.returnDate ?? null, JSON.stringify(input.details ?? {}), round2(input.costPrice),
         round2(input.salePrice), input.supplierId ?? null, input.agentId ?? null, userId]);
      return { id: res.insertId, bookingNo, status: 'PENDING' };
    });
  },

  /**
   * CONFIRM = the money moment. In ONE transaction:
   *  1. invoice is generated (subtotal − discount + VAT),
   *  2. a SALES voucher posts   Dr Customer A/R          total
   *                             Cr Sales — <type>        subtotal − discount
   *                             Cr VAT Payable           vat            (if any)
   *  3. if the booking has a supplier cost, a PURCHASE voucher posts
   *                             Dr Cost of Services      cost
   *                             Cr Supplier A/P          cost
   * Both vouchers go through postVoucherTx → debit==credit is guaranteed.
   */
  async confirm(companyId: number, userId: number, bookingId: number, input: ConfirmBookingInput) {
    return withTransaction(async (conn) => {
      const booking = await lockBooking(conn, companyId, bookingId);
      if (booking.status !== 'PENDING')
        throw ApiError.conflict(`Only PENDING bookings can be confirmed (current: ${booking.status})`);

      const customerLedgerId = await customerLedger(conn, companyId, booking.customer_id);

      const subtotal = round2(Number(booking.sale_price));
      const discount = round2(input.discount ?? 0);
      if (discount < 0 || discount > subtotal) throw ApiError.badRequest('Invalid discount');
      const vatPercent = round2(input.vatPercent ?? 0);
      const taxable = round2(subtotal - discount);
      const vatAmount = round2(taxable * vatPercent / 100);
      const total = round2(taxable + vatAmount);
      if (total <= 0) throw ApiError.badRequest('Invoice total must be positive');

      // ---- SALES voucher (the revenue recognition) ----
      const salesLedgerId = await findLedgerId(conn, companyId, salesLedgerName(booking.booking_type));
      const entries = [
        { ledgerId: customerLedgerId, type: 'DR' as const, amount: total, note: `Booking ${booking.booking_no}` },
        { ledgerId: salesLedgerId, type: 'CR' as const, amount: taxable, note: `${booking.booking_type} sale` }
      ];
      if (vatAmount > 0) {
        const vatLedgerId = await findLedgerId(conn, companyId, SYSTEM_LEDGERS.VAT_PAYABLE);
        entries.push({ ledgerId: vatLedgerId, type: 'CR' as const, amount: vatAmount, note: `VAT ${vatPercent}%` });
      }
      const today = new Date().toISOString().slice(0, 10);
      const sales = await postVoucherTx(conn, companyId, userId, {
        type: 'SALES', date: today, reference: booking.booking_no,
        narration: `Sale of ${booking.booking_type.toLowerCase()} booking ${booking.booking_no}`,
        entries
      });

      // ---- auto invoice ----
      const invoiceNo = await nextDocNo(conn, 'invoices', companyId, 'INV');
      const [invRes] = await conn.query<WriteResult>(
        `INSERT INTO invoices (company_id, invoice_no, customer_id, booking_id, invoice_date, due_date,
                               subtotal, discount, vat_percent, vat_amount, total, voucher_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [companyId, invoiceNo, booking.customer_id, bookingId, today, input.dueDate ?? null,
         subtotal, discount, vatPercent, vatAmount, total, sales.voucherId]);
      const invoiceId = invRes.insertId;
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES (?,?,?,?,?)`,
        [invoiceId, invoiceLine(booking), 1, subtotal, subtotal]);

      // ---- supplier cost side (creates the payable we owe the airline/hotel) ----
      let purchaseVoucherNo: string | null = null;
      const cost = round2(Number(booking.cost_price));
      if (cost > 0 && booking.supplier_id) {
        const supplierLedgerId = await supplierLedger(conn, companyId, booking.supplier_id);
        const costLedgerId = await findLedgerId(conn, companyId, SYSTEM_LEDGERS.COST_OF_SERVICES);
        const purchase = await postVoucherTx(conn, companyId, userId, {
          type: 'PURCHASE', date: today, reference: booking.booking_no,
          narration: `Supplier cost for booking ${booking.booking_no}`,
          entries: [
            { ledgerId: costLedgerId, type: 'DR', amount: cost, note: 'Cost of services' },
            { ledgerId: supplierLedgerId, type: 'CR', amount: cost, note: 'Payable to supplier' }
          ]
        });
        purchaseVoucherNo = purchase.voucherNo;
      }

      await conn.query(
        `UPDATE bookings SET status = 'CONFIRMED', invoice_id = ? WHERE id = ?`, [invoiceId, bookingId]);

      return {
        bookingId, status: 'CONFIRMED',
        invoice: { id: invoiceId, invoiceNo, subtotal, discount, vatPercent, vatAmount, total },
        salesVoucherNo: sales.voucherNo, purchaseVoucherNo
      };
    });
  },

  /**
   * CANCEL. A PENDING booking just flips status. A CONFIRMED booking must also
   * unwind the books: the invoice is VOIDed and a CREDIT_NOTE reverses the
   * original SALES voucher (Dr Sales+VAT / Cr Customer).
   */
  async cancel(companyId: number, userId: number, bookingId: number, reason?: string) {
    return withTransaction(async (conn) => {
      const booking = await lockBooking(conn, companyId, bookingId);
      if (booking.status === 'CANCELLED') throw ApiError.conflict('Booking is already cancelled');

      let creditNoteNo: string | null = null;
      if (booking.status === 'CONFIRMED' && booking.invoice_id) {
        const [invRows] = await conn.query<Row[]>(
          `SELECT * FROM invoices WHERE id = ? AND company_id = ? FOR UPDATE`,
          [booking.invoice_id, companyId]);
        const inv = invRows[0];
        if (inv && inv.status !== 'VOID') {
          if (Number(inv.paid_amount) > 0)
            throw ApiError.conflict('Invoice has payments against it — refund the payment first, then cancel');
          const customerLedgerId = await customerLedger(conn, companyId, booking.customer_id);
          const salesLedgerId = await findLedgerId(conn, companyId, salesLedgerName(booking.booking_type));
          const taxable = round2(Number(inv.subtotal) - Number(inv.discount));
          const entries = [
            { ledgerId: salesLedgerId, type: 'DR' as const, amount: taxable, note: 'Sale reversed' },
            { ledgerId: customerLedgerId, type: 'CR' as const, amount: Number(inv.total), note: `Cancel ${booking.booking_no}` }
          ];
          if (Number(inv.vat_amount) > 0) {
            const vatLedgerId = await findLedgerId(conn, companyId, SYSTEM_LEDGERS.VAT_PAYABLE);
            entries.splice(1, 0, { ledgerId: vatLedgerId, type: 'DR' as const, amount: Number(inv.vat_amount), note: 'VAT reversed' });
          }
          const cn = await postVoucherTx(conn, companyId, userId, {
            type: 'CREDIT_NOTE', date: new Date().toISOString().slice(0, 10),
            reference: inv.invoice_no,
            narration: `Cancellation of booking ${booking.booking_no}${reason ? ` — ${reason}` : ''}`,
            entries
          });
          creditNoteNo = cn.voucherNo;
          await conn.query(`UPDATE invoices SET status = 'VOID' WHERE id = ?`, [inv.id]);
        }
      }
      await conn.query(`UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`, [bookingId]);
      return { bookingId, status: 'CANCELLED', creditNoteNo };
    });
  }
};

// ------------------------------- helpers ------------------------------------

function invoiceLine(b: Row): string {
  const d = typeof b.details === 'string' ? safeJson(b.details) : (b.details ?? {});
  const extra = [d.pnr && `PNR ${d.pnr}`, d.route, d.hotel, d.package, b.travel_date && `Travel ${b.travel_date}`]
    .filter(Boolean).join(', ');
  const label = { FLIGHT: 'Air Ticket', HOTEL: 'Hotel Booking', TOUR: 'Tour Package' }[b.booking_type as string] ?? 'Travel Service';
  return `${label} — ${b.booking_no}${extra ? ` (${extra})` : ''}`;
}

function safeJson(s: string): Record<string, any> {
  try { return JSON.parse(s); } catch { return {}; }
}

async function lockBooking(conn: PoolConnection, companyId: number, id: number): Promise<Row> {
  const [rows] = await conn.query<Row[]>(
    `SELECT * FROM bookings WHERE company_id = ? AND id = ? FOR UPDATE`, [companyId, id]);
  if (!rows.length) throw ApiError.notFound('Booking not found');
  return rows[0];
}

async function assertCustomer(conn: PoolConnection, companyId: number, customerId: number): Promise<void> {
  const [rows] = await conn.query<Row[]>(
    `SELECT id FROM customers WHERE company_id = ? AND id = ?`, [companyId, customerId]);
  if (!rows.length) throw ApiError.badRequest('Customer does not exist');
}

async function customerLedger(conn: PoolConnection, companyId: number, customerId: number): Promise<number> {
  const [rows] = await conn.query<Row[]>(
    `SELECT ledger_id FROM customers WHERE company_id = ? AND id = ?`, [companyId, customerId]);
  if (!rows.length) throw ApiError.badRequest('Customer does not exist');
  return rows[0].ledger_id as number;
}

async function supplierLedger(conn: PoolConnection, companyId: number, supplierId: number): Promise<number> {
  const [rows] = await conn.query<Row[]>(
    `SELECT ledger_id FROM suppliers WHERE company_id = ? AND id = ?`, [companyId, supplierId]);
  if (!rows.length) throw ApiError.badRequest('Supplier does not exist');
  return rows[0].ledger_id as number;
}
