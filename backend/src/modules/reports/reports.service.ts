import { query, Row } from '../../config/db';
import { round2 } from '../../utils/money';

/**
 * All financial reports derive from one aggregate query over voucher_entries
 * joined to ledgers and ledger_groups — opening balances folded in as Dr/Cr.
 */
interface LedgerTotals extends Row {
  id: number; name: string; group_name: string;
  nature: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  opening_dr: number; opening_cr: number; period_dr: number; period_cr: number;
}

async function ledgerTotals(companyId: number, from: string, to: string): Promise<LedgerTotals[]> {
  return query<LedgerTotals[]>(
    `SELECT l.id, l.name, g.name AS group_name, g.nature,
            CASE WHEN l.opening_type = 'DR' THEN l.opening_balance ELSE 0 END AS opening_dr,
            CASE WHEN l.opening_type = 'CR' THEN l.opening_balance ELSE 0 END AS opening_cr,
            COALESCE(SUM(CASE WHEN ve.entry_type='DR' AND v.voucher_date BETWEEN ? AND ? THEN ve.amount END),0) AS period_dr,
            COALESCE(SUM(CASE WHEN ve.entry_type='CR' AND v.voucher_date BETWEEN ? AND ? THEN ve.amount END),0) AS period_cr
       FROM ledgers l
       JOIN ledger_groups g ON g.id = l.group_id
       LEFT JOIN voucher_entries ve ON ve.ledger_id = l.id
       LEFT JOIN vouchers v ON v.id = ve.voucher_id AND v.company_id = l.company_id
      WHERE l.company_id = ?
      GROUP BY l.id, l.name, g.name, g.nature, opening_dr, opening_cr
      ORDER BY g.nature, l.name`,
    [from, to, from, to, companyId]);
}

export const reportsService = {
  /** Trial Balance: per-ledger Dr/Cr totals; grand totals must be equal. */
  async trialBalance(companyId: number, from: string, to: string) {
    const rows = await ledgerTotals(companyId, from, to);
    const lines = rows
      .map(r => {
        const dr = Number(r.opening_dr) + Number(r.period_dr);
        const cr = Number(r.opening_cr) + Number(r.period_cr);
        const net = dr - cr;
        return {
          ledger_id: r.id, ledger: r.name, group: r.group_name, nature: r.nature,
          debit: net > 0 ? round2(net) : 0, credit: net < 0 ? round2(-net) : 0
        };
      })
      .filter(l => l.debit !== 0 || l.credit !== 0);
    const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
    return { from, to, lines, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
  },

  /** Profit & Loss: INCOME (Cr-Dr) vs EXPENSE (Dr-Cr) over the period. */
  async profitAndLoss(companyId: number, from: string, to: string) {
    const rows = await ledgerTotals(companyId, from, to);
    const income = rows.filter(r => r.nature === 'INCOME')
      .map(r => ({ ledger: r.name, amount: round2(Number(r.period_cr) - Number(r.period_dr)) }))
      .filter(r => r.amount !== 0);
    const expenses = rows.filter(r => r.nature === 'EXPENSE')
      .map(r => ({ ledger: r.name, amount: round2(Number(r.period_dr) - Number(r.period_cr)) }))
      .filter(r => r.amount !== 0);
    const totalIncome = round2(income.reduce((s, r) => s + r.amount, 0));
    const totalExpense = round2(expenses.reduce((s, r) => s + r.amount, 0));
    return { from, to, income, expenses, totalIncome, totalExpense,
             netProfit: round2(totalIncome - totalExpense) };
  },

  /** Balance Sheet as on a date. Assets = Liabilities + Equity + retained P&L. */
  async balanceSheet(companyId: number, asOn: string) {
    const rows = await ledgerTotals(companyId, '1900-01-01', asOn);
    const closing = (r: LedgerTotals) =>
      round2(Number(r.opening_dr) + Number(r.period_dr) - Number(r.opening_cr) - Number(r.period_cr));

    const assets = rows.filter(r => r.nature === 'ASSET')
      .map(r => ({ ledger: r.name, group: r.group_name, amount: closing(r) }))
      .filter(r => r.amount !== 0);
    const liabilities = rows.filter(r => r.nature === 'LIABILITY')
      .map(r => ({ ledger: r.name, group: r.group_name, amount: round2(-closing(r)) }))
      .filter(r => r.amount !== 0);
    const equity = rows.filter(r => r.nature === 'EQUITY')
      .map(r => ({ ledger: r.name, group: r.group_name, amount: round2(-closing(r)) }))
      .filter(r => r.amount !== 0);

    // retained earnings = lifetime income - lifetime expense up to asOn
    const pl = await this.profitAndLoss(companyId, '1900-01-01', asOn);
    const totalAssets = round2(assets.reduce((s, r) => s + r.amount, 0));
    const totalLiabilities = round2(liabilities.reduce((s, r) => s + r.amount, 0));
    const totalEquity = round2(equity.reduce((s, r) => s + r.amount, 0) + pl.netProfit);
    return {
      asOn, assets, liabilities, equity, retainedEarnings: pl.netProfit,
      totalAssets, totalLiabilities, totalEquity,
      totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
      balanced: totalAssets === round2(totalLiabilities + totalEquity)
    };
  },

  /** Cash Book / Bank Book: vouchers touching ledgers in the given group nature. */
  async cashBankBook(companyId: number, book: 'cash' | 'bank', from: string, to: string) {
    const groupName = book === 'cash' ? 'Cash-in-Hand' : 'Bank Accounts';
    return query<Row[]>(
      `SELECT v.voucher_date, v.voucher_no, v.voucher_type, v.narration,
              l.name AS ledger, ve.entry_type, ve.amount
         FROM voucher_entries ve
         JOIN vouchers v ON v.id = ve.voucher_id
         JOIN ledgers l ON l.id = ve.ledger_id
         JOIN ledger_groups g ON g.id = l.group_id
        WHERE v.company_id = ? AND g.name = ? AND v.voucher_date BETWEEN ? AND ?
        ORDER BY v.voucher_date, v.id`,
      [companyId, groupName, from, to]);
  },

  /** Day Book: every voucher of a day/range in posting order. */
  dayBook(companyId: number, from: string, to: string) {
    return query<Row[]>(
      `SELECT v.id, v.voucher_date, v.voucher_no, v.voucher_type, v.narration,
              v.total_amount, u.name AS created_by
         FROM vouchers v JOIN users u ON u.id = v.created_by
        WHERE v.company_id = ? AND v.voucher_date BETWEEN ? AND ?
        ORDER BY v.voucher_date, v.id`, [companyId, from, to]);
  },

  /** Daily sales: confirmed invoice totals grouped by date (for reports/charts). */
  dailySales(companyId: number, from: string, to: string) {
    return query<Row[]>(
      `SELECT invoice_date AS date, COUNT(*) AS invoices, SUM(total) AS total
         FROM invoices
        WHERE company_id = ? AND status <> 'VOID' AND invoice_date BETWEEN ? AND ?
        GROUP BY invoice_date ORDER BY invoice_date`, [companyId, from, to]);
  },

  /** Customer outstanding: receivable ledger balance per customer. */
  customerOutstanding(companyId: number) {
    return query<Row[]>(
      `SELECT c.id, c.name, c.phone, c.credit_limit,
              ROUND(CASE WHEN l.opening_type='DR' THEN l.opening_balance ELSE -l.opening_balance END
              + COALESCE(SUM(CASE WHEN ve.entry_type='DR' THEN ve.amount ELSE -ve.amount END),0), 2) AS outstanding
         FROM customers c
         JOIN ledgers l ON l.id = c.ledger_id
         LEFT JOIN voucher_entries ve ON ve.ledger_id = l.id
        WHERE c.company_id = ?
        GROUP BY c.id, c.name, c.phone, c.credit_limit, l.opening_balance, l.opening_type
        HAVING outstanding <> 0
        ORDER BY outstanding DESC`, [companyId]);
  }
};
