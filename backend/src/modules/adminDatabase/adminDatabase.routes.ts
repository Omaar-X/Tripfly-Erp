import { Router } from 'express';
import * as c from './adminDatabase.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();

router.use(authenticate, allow('ADMIN'));
router.get('/tables', c.tables);
router.get('/tables/:table', c.tableData);
router.get('/tables/:table/export.csv', c.tableCsv);
router.get('/export.json', c.fullBackup);

export default router;
