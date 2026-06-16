import { Router } from 'express';
import * as c from './inventory.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);
router.get('/items', c.listItems);
router.post('/items', allow('ACCOUNTANT', 'MANAGER'), c.createItem);
router.get('/warehouses', c.listWarehouses);
router.get('/movements', c.listMovements);
router.post('/movements', allow('ACCOUNTANT', 'SALES'), c.recordMovement);
router.get('/items/:id/valuation', c.valuation);
router.get('/stock-report', c.stockReport);
export default router;
