import { PoolConnection } from 'mysql2/promise';
import { Row } from '../config/db';
import { ApiError } from './ApiError';

/**
 * The posting modules (bookings, payments, payroll) need well-known system
 * ledgers — "Cash in Hand", "VAT Payable", "Salary Expense"… We resolve them
 * BY NAME (not by hard-coded id) so the system keeps working even if the
 * chart of accounts is re-seeded with different ids.
 */
export const SYSTEM_LEDGERS = {
  CASH: 'Cash in Hand',
  BANK: 'City Bank — A/C 110245',
  BKASH: 'bKash Merchant Wallet',
  SALES_FLIGHT: 'Sales — Air Tickets',
  SALES_HOTEL: 'Sales — Hotel Bookings',
  SALES_TOUR: 'Sales — Tour Packages',
  VAT_PAYABLE: 'VAT Payable',
  COST_OF_SERVICES: 'Cost of Services',
  SALARY_EXPENSE: 'Salary Expense',
  SALARIES_PAYABLE: 'Salaries Payable'
} as const;

export async function findLedgerId(conn: PoolConnection, companyId: number, name: string): Promise<number> {
  const [rows] = await conn.query<Row[]>(
    'SELECT id FROM ledgers WHERE company_id = ? AND name = ? LIMIT 1', [companyId, name]
  );
  if (!rows.length) {
    throw ApiError.badRequest(
      `Required system ledger "${name}" not found. Did you run database/seed.sql?`
    );
  }
  return rows[0].id as number;
}

/** Maps a payment method to the money ledger that receives / releases cash. */
export function moneyLedgerName(method: 'CASH' | 'BANK' | 'BKASH' | 'NAGAD' | 'CARD'): string {
  switch (method) {
    case 'CASH': return SYSTEM_LEDGERS.CASH;
    case 'BKASH':
    case 'NAGAD': return SYSTEM_LEDGERS.BKASH;   // mobile wallets settle into the wallet ledger
    default: return SYSTEM_LEDGERS.BANK;          // BANK / CARD settle into the bank account
  }
}

/** Maps a booking type to its income ledger. */
export function salesLedgerName(type: 'FLIGHT' | 'HOTEL' | 'TOUR'): string {
  switch (type) {
    case 'FLIGHT': return SYSTEM_LEDGERS.SALES_FLIGHT;
    case 'HOTEL': return SYSTEM_LEDGERS.SALES_HOTEL;
    case 'TOUR': return SYSTEM_LEDGERS.SALES_TOUR;
  }
}
