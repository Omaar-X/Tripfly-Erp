import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { reportsService } from './reports.service';

const range = (req: Request) => {
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return {
    from: (req.query.from as string) || yearStart,
    to: (req.query.to as string) || today
  };
};

/** GET /api/reports/trial-balance?from=&to= */
export const trialBalance = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  res.json({ success: true, data: await reportsService.trialBalance(req.user!.companyId, from, to) });
});

/**
 * GET /api/reports/profit-loss?from=&to=
 * Response: { income[], expenses[], totalIncome, totalExpense, netProfit }
 */
export const profitLoss = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  res.json({ success: true, data: await reportsService.profitAndLoss(req.user!.companyId, from, to) });
});

/** GET /api/reports/balance-sheet?asOn=YYYY-MM-DD */
export const balanceSheet = asyncHandler(async (req: Request, res: Response) => {
  const asOn = (req.query.asOn as string) || new Date().toISOString().slice(0, 10);
  res.json({ success: true, data: await reportsService.balanceSheet(req.user!.companyId, asOn) });
});

/** GET /api/reports/cash-book?from=&to=  |  /api/reports/bank-book */
export const cashBook = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  res.json({ success: true, data: await reportsService.cashBankBook(req.user!.companyId, 'cash', from, to) });
});
export const bankBook = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  res.json({ success: true, data: await reportsService.cashBankBook(req.user!.companyId, 'bank', from, to) });
});

/** GET /api/reports/day-book?from=&to= */
export const dayBook = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  res.json({ success: true, data: await reportsService.dayBook(req.user!.companyId, from, to) });
});

/** GET /api/reports/daily-sales?from=&to= */
export const dailySales = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = range(req);
  res.json({ success: true, data: await reportsService.dailySales(req.user!.companyId, from, to) });
});

/** GET /api/reports/customer-outstanding */
export const customerOutstanding = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await reportsService.customerOutstanding(req.user!.companyId) });
});
