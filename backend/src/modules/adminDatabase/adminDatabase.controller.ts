import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { adminDatabaseService } from './adminDatabase.service';

const filenameDate = () => new Date().toISOString().replace(/[:.]/g, '-');

/** GET /api/admin/database/tables */
export const tables = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await adminDatabaseService.tables() });
});

/** GET /api/admin/database/tables/:table?limit=&offset= */
export const tableData = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 100);
  const offset = Number(req.query.offset ?? 0);
  res.json({
    success: true,
    data: await adminDatabaseService.tableData(req.params.table, limit, offset)
  });
});

/** GET /api/admin/database/tables/:table/export.csv */
export const tableCsv = asyncHandler(async (req: Request, res: Response) => {
  const csv = await adminDatabaseService.tableCsv(req.params.table);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.table}-${filenameDate()}.csv"`);
  res.send(csv);
});

/** GET /api/admin/database/export.json */
export const fullBackup = asyncHandler(async (_req: Request, res: Response) => {
  const backup = await adminDatabaseService.fullBackup();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tripfly_erp-backup-${filenameDate()}.json"`);
  res.send(JSON.stringify(backup, null, 2));
});
