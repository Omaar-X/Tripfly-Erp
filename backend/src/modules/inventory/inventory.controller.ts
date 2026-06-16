import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { inventoryService } from './inventory.service';
import { audit } from '../../middleware/audit';

const itemSchema = z.object({
  sku: z.string().min(1).max(50), name: z.string().min(2).max(150),
  category: z.string().max(80).optional(), unit: z.string().max(20).default('pcs'),
  purchasePrice: z.number().min(0), salePrice: z.number().min(0),
  reorderLevel: z.number().min(0).default(0)
});
const movementSchema = z.object({
  itemId: z.number().int().positive(), warehouseId: z.number().int().positive(),
  type: z.enum(['IN', 'OUT']), quantity: z.number().positive(),
  rate: z.number().min(0), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(255).optional()
});

/** GET /api/inventory/items — items with live stock quantity */
export const listItems = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await inventoryService.listItems(req.user!.companyId) });
});

/** POST /api/inventory/items */
export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const body = itemSchema.parse(req.body);
  const id = await inventoryService.createItem(req.user!.companyId, body);
  await audit(req, 'ITEM_CREATE', 'items', id, { sku: body.sku });
  res.status(201).json({ success: true, data: { id, ...body } });
});

/** GET /api/inventory/warehouses */
export const listWarehouses = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await inventoryService.listWarehouses(req.user!.companyId) });
});

/**
 * POST /api/inventory/movements — stock IN / OUT
 * Request: { "itemId": 1, "warehouseId": 1, "type": "IN", "quantity": 50, "rate": 270, "date": "2026-06-10" }
 * OUT is rejected when it would drive stock negative.
 */
export const recordMovement = asyncHandler(async (req: Request, res: Response) => {
  const body = movementSchema.parse(req.body);
  const id = await inventoryService.recordMovement(req.user!.companyId, body);
  await audit(req, 'STOCK_MOVE', 'stock_entries', id, body);
  res.status(201).json({ success: true, data: { id } });
});

/** GET /api/inventory/movements?itemId= */
export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
  res.json({ success: true, data: await inventoryService.movements(req.user!.companyId, itemId) });
});

/** GET /api/inventory/items/:id/valuation — FIFO layers + weighted average */
export const valuation = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true,
    data: await inventoryService.valuation(req.user!.companyId, Number(req.params.id)) });
});

/** GET /api/inventory/stock-report */
export const stockReport = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await inventoryService.stockReport(req.user!.companyId) });
});
