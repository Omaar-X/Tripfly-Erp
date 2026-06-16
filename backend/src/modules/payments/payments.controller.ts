import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { audit } from '../../middleware/audit';
import { paymentsService } from './payments.service';

const recordSchema = z.object({
  direction: z.enum(['IN', 'OUT']),
  customerId: z.number().int().positive().optional(),
  supplierId: z.number().int().positive().optional(),
  invoiceId: z.number().int().positive().optional(),
  method: z.enum(['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD']),
  amount: z.number().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(255).optional()
});

/**
 * GET /api/payments?direction=IN&from=2026-06-01&to=2026-06-30
 * Response 200:
 * { "success": true, "data": [ { "payment_no": "PMT-2026-00011", "direction": "IN",
 *     "method": "BKASH", "amount": 20000, "customer_name": "Tanvir Ahmed",
 *     "invoice_no": "INV-2026-00006", "voucher_no": "RV-2026-00009" } ] }
 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await paymentsService.list(req.user!.companyId, {
    direction: req.query.direction as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    q: req.query.q as string | undefined
  }) });
});

/**
 * POST /api/payments
 * Request (customer receipt settling an invoice):
 * { "direction": "IN", "customerId": 1, "invoiceId": 6, "method": "BKASH",
 *   "amount": 20000, "paymentDate": "2026-06-10", "notes": "Advance" }
 * Response 201:
 * { "success": true, "data": { "id": 12, "paymentNo": "PMT-2026-00012",
 *     "voucherNo": "RV-2026-00010",
 *     "invoice": { "invoiceNo": "INV-2026-00006", "paid": 20000, "status": "PARTIAL" } } }
 *
 * Request (supplier payment):
 * { "direction": "OUT", "supplierId": 1, "method": "BANK",
 *   "amount": 50000, "paymentDate": "2026-06-10" }
 */
export const record = asyncHandler(async (req: Request, res: Response) => {
  const input = recordSchema.parse(req.body);
  const data = await paymentsService.record(req.user!.companyId, req.user!.sub, input);
  await audit(req, 'PAYMENT_RECORD', 'payments', data.id,
    { paymentNo: data.paymentNo, direction: input.direction, amount: input.amount });
  res.status(201).json({ success: true, data });
});
