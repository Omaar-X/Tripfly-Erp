import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { accountingService } from './accounting.service';
import { audit } from '../../middleware/audit';

const entrySchema = z.object({
  ledgerId: z.number().int().positive(),
  type: z.enum(['DR', 'CR']),
  amount: z.number().positive(),
  note: z.string().max(255).optional()
});
const voucherSchema = z.object({
  type: z.enum(['JOURNAL','PAYMENT','RECEIPT','SALES','PURCHASE','CONTRA','DEBIT_NOTE','CREDIT_NOTE']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  narration: z.string().max(500).optional(),
  reference: z.string().max(120).optional(),
  entries: z.array(entrySchema).min(2)
});
const ledgerSchema = z.object({
  groupId: z.number().int().positive(),
  name: z.string().min(2).max(120),
  openingBalance: z.number().min(0).default(0),
  openingType: z.enum(['DR', 'CR']).default('DR')
});

/** GET /api/ledger-groups */
export const listGroups = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await accountingService.listGroups(req.user!.companyId) });
});

/**
 * GET /api/ledgers — every ledger with totals and closing balance.
 * Response item: { id, name, group_name, nature, total_debit, total_credit, ... }
 */
export const listLedgers = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await accountingService.listLedgers(req.user!.companyId) });
});

/** POST /api/ledgers — { groupId, name, openingBalance, openingType } */
export const createLedger = asyncHandler(async (req: Request, res: Response) => {
  const body = ledgerSchema.parse(req.body);
  const id = await accountingService.createLedger(req.user!.companyId, body);
  await audit(req, 'LEDGER_CREATE', 'ledgers', id, { name: body.name });
  res.status(201).json({ success: true, data: { id, ...body } });
});

/** GET /api/ledgers/:id/statement?from=&to= — ledger statement with running balance */
export const ledgerStatement = asyncHandler(async (req: Request, res: Response) => {
  const { from = '1900-01-01', to = '2999-12-31' } = req.query as Record<string, string>;
  const data = await accountingService.ledgerStatement(
    req.user!.companyId, Number(req.params.id), from, to);
  res.json({ success: true, data });
});

/**
 * POST /api/vouchers — the double-entry posting endpoint.
 * Request:
 * { "type": "JOURNAL", "date": "2026-06-10", "narration": "Office rent for June",
 *   "entries": [ { "ledgerId": 10, "type": "DR", "amount": 30000 },
 *                { "ledgerId": 1,  "type": "CR", "amount": 30000 } ] }
 * Response: { success, data: { voucherId, voucherNo, total } }
 * 400 if SUM(DR) != SUM(CR).
 */
export const createVoucher = asyncHandler(async (req: Request, res: Response) => {
  const body = voucherSchema.parse(req.body);
  const data = await accountingService.postVoucher(req.user!.companyId, req.user!.sub, body);
  await audit(req, 'VOUCHER_CREATE', 'vouchers', data.voucherId,
    { voucherNo: data.voucherNo, type: body.type, total: data.total });
  res.status(201).json({ success: true, data });
});

/** GET /api/vouchers?type=&from=&to=&page=&pageSize= */
export const listVouchers = asyncHandler(async (req: Request, res: Response) => {
  const { type, from, to } = req.query as Record<string, string>;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize) || 25);
  const data = await accountingService.listVouchers(req.user!.companyId,
    { type, from, to, limit: pageSize, offset: (page - 1) * pageSize });
  res.json({ success: true, data, page, pageSize });
});

/** GET /api/vouchers/:id — header + Dr/Cr lines */
export const getVoucher = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true,
    data: await accountingService.getVoucher(req.user!.companyId, Number(req.params.id)) });
});
