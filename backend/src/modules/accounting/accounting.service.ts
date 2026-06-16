import { PoolConnection } from 'mysql2/promise';
import { withTransaction } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { sumCents, fromCents } from '../../utils/money';
import { nextVoucherNo } from '../../utils/numbering';
import { accountingRepo, VoucherEntryInput } from './accounting.repository';

export interface PostVoucherInput {
  type: 'JOURNAL' | 'PAYMENT' | 'RECEIPT' | 'SALES' | 'PURCHASE' | 'CONTRA' | 'DEBIT_NOTE' | 'CREDIT_NOTE';
  date: string;                 // YYYY-MM-DD
  narration?: string;
  reference?: string;
  entries: VoucherEntryInput[];
}

/**
 * ============================ DOUBLE-ENTRY ENGINE ============================
 * Single choke-point for writing to the books. Every business module
 * (payments, bookings, invoices, payroll) posts through postVoucherTx so the
 * invariant SUM(debits) === SUM(credits) is enforced in exactly one place,
 * in integer cents, inside the caller's SQL transaction.
 * ============================================================================
 */
export async function postVoucherTx(
  conn: PoolConnection, companyId: number, userId: number, input: PostVoucherInput
): Promise<{ voucherId: number; voucherNo: string; total: number }> {
  const { entries } = input;

  if (!entries || entries.length < 2)
    throw ApiError.badRequest('A voucher needs at least one debit and one credit line');
  if (entries.some(e => !(Number(e.amount) > 0)))
    throw ApiError.badRequest('Every voucher line amount must be greater than zero');

  const debitCents = sumCents(entries.filter(e => e.type === 'DR').map(e => e.amount));
  const creditCents = sumCents(entries.filter(e => e.type === 'CR').map(e => e.amount));

  if (debitCents === 0 || creditCents === 0)
    throw ApiError.badRequest('Voucher must contain both debit and credit entries');

  // ★ THE RULE: debit_total must equal credit_total — strictly enforced.
  if (debitCents !== creditCents)
    throw ApiError.badRequest(
      `Voucher does not balance: Dr ${fromCents(debitCents).toFixed(2)} != Cr ${fromCents(creditCents).toFixed(2)}`,
      { debit: fromCents(debitCents), credit: fromCents(creditCents) }
    );

  const voucherNo = await nextVoucherNo(conn, companyId, input.type);
  const total = fromCents(debitCents);
  const voucherId = await accountingRepo.insertVoucher(conn, {
    companyId, voucherNo, type: input.type, date: input.date,
    narration: input.narration, reference: input.reference, total, createdBy: userId
  });
  await accountingRepo.insertEntries(conn, voucherId, entries);
  return { voucherId, voucherNo, total };
}

export const accountingService = {
  postVoucher: (companyId: number, userId: number, input: PostVoucherInput) =>
    withTransaction(conn => postVoucherTx(conn, companyId, userId, input)),

  createLedger: (companyId: number,
    input: { groupId: number; name: string; openingBalance: number; openingType: 'DR' | 'CR' }) =>
    withTransaction(conn => accountingRepo.createLedger(conn, companyId, input)),

  listGroups: accountingRepo.listGroups,
  listLedgers: accountingRepo.listLedgers,

  async ledgerStatement(companyId: number, ledgerId: number, from: string, to: string) {
    const ledger = await accountingRepo.getLedger(companyId, ledgerId);
    if (!ledger) throw ApiError.notFound('Ledger not found');
    const lines = await accountingRepo.ledgerStatement(companyId, ledgerId, from, to);
    // running balance: debit-nature ledgers grow with DR, credit-nature with CR
    const debitNature = ledger.nature === 'ASSET' || ledger.nature === 'EXPENSE';
    let balance = Number(ledger.opening_balance) * (ledger.opening_type === (debitNature ? 'DR' : 'CR') ? 1 : -1);
    const opening = balance;
    const rows = lines.map(l => {
      const signed = Number(l.amount) * ((l.entry_type === 'DR') === debitNature ? 1 : -1);
      balance += signed;
      return { ...l, running_balance: Math.round(balance * 100) / 100 };
    });
    return { ledger: { id: ledger.id, name: ledger.name, nature: ledger.nature, group: ledger.group_name },
             opening_balance: opening, closing_balance: Math.round(balance * 100) / 100, lines: rows };
  },

  listVouchers: accountingRepo.listVouchers,

  async getVoucher(companyId: number, id: number) {
    const v = await accountingRepo.getVoucher(companyId, id);
    if (!v) throw ApiError.notFound('Voucher not found');
    return v;
  }
};
