import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { audit } from '../../middleware/audit';
import { bookingsService } from './bookings.service';

const createSchema = z.object({
  customerId: z.number().int().positive(),
  bookingType: z.enum(['FLIGHT', 'HOTEL', 'TOUR']),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  details: z.record(z.any()).optional(),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  supplierId: z.number().int().positive().optional(),
  agentId: z.number().int().positive().optional()
});

const confirmSchema = z.object({
  vatPercent: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

/**
 * GET /api/bookings?status=PENDING&type=FLIGHT&q=tanvir
 * Response 200:
 * { "success": true, "data": [ { "id": 7, "booking_no": "BK-2026-00007",
 *     "booking_type": "FLIGHT", "status": "CONFIRMED",
 *     "customer_name": "Tanvir Ahmed", "sale_price": 56500, "margin": 6500,
 *     "invoice_no": "INV-2026-00005" } ] }
 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await bookingsService.list(req.user!.companyId, {
    status: req.query.status as string | undefined,
    type: req.query.type as string | undefined,
    customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
    q: req.query.q as string | undefined
  }) });
});

/** GET /api/bookings/:id */
export const get = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await bookingsService.get(req.user!.companyId, Number(req.params.id)) });
});

/** GET /api/bookings/history/:customerId — customer travel history */
export const history = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true,
    data: await bookingsService.travelHistory(req.user!.companyId, Number(req.params.customerId)) });
});

/**
 * POST /api/bookings
 * Request:
 * { "customerId": 1, "bookingType": "FLIGHT", "travelDate": "2026-07-15",
 *   "details": { "pnr": "AB12CD", "route": "DAC-DXB-DAC", "airline": "Biman", "pax": 2 },
 *   "costPrice": 50000, "salePrice": 56500, "supplierId": 1, "agentId": 1 }
 * Response 201:
 * { "success": true, "data": { "id": 8, "bookingNo": "BK-2026-00008", "status": "PENDING" } }
 */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createSchema.parse(req.body);
  const data = await bookingsService.create(req.user!.companyId, req.user!.sub, input);
  await audit(req, 'BOOKING_CREATE', 'bookings', data.id, { bookingNo: data.bookingNo, type: input.bookingType });
  res.status(201).json({ success: true, data });
});

/**
 * POST /api/bookings/:id/confirm — generates the invoice + posts SALES voucher
 * Request: { "vatPercent": 5, "discount": 500, "dueDate": "2026-07-01" }
 * Response 200:
 * { "success": true, "data": { "bookingId": 8, "status": "CONFIRMED",
 *   "invoice": { "invoiceNo": "INV-2026-00006", "subtotal": 56500, "discount": 500,
 *                "vatPercent": 5, "vatAmount": 2800, "total": 58800 },
 *   "salesVoucherNo": "SV-2026-00014", "purchaseVoucherNo": "PUR-2026-00003" } }
 */
export const confirm = asyncHandler(async (req: Request, res: Response) => {
  const input = confirmSchema.parse(req.body ?? {});
  const data = await bookingsService.confirm(req.user!.companyId, req.user!.sub, Number(req.params.id), input);
  await audit(req, 'BOOKING_CONFIRM', 'bookings', data.bookingId, { invoice: data.invoice.invoiceNo });
  res.json({ success: true, data });
});

/**
 * POST /api/bookings/:id/cancel
 * Request: { "reason": "Customer changed plans" }
 * Response 200:
 * { "success": true, "data": { "bookingId": 8, "status": "CANCELLED", "creditNoteNo": "CN-2026-00001" } }
 */
export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const data = await bookingsService.cancel(
    req.user!.companyId, req.user!.sub, Number(req.params.id), req.body?.reason);
  await audit(req, 'BOOKING_CANCEL', 'bookings', data.bookingId, { reason: req.body?.reason });
  res.json({ success: true, data });
});
