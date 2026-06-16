import { Router } from 'express';
import * as c from './reports.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.use(authenticate, allow('ACCOUNTANT', 'MANAGER'));
router.get('/trial-balance', c.trialBalance);
router.get('/profit-loss', c.profitLoss);
router.get('/balance-sheet', c.balanceSheet);
router.get('/cash-book', c.cashBook);
router.get('/bank-book', c.bankBook);
router.get('/day-book', c.dayBook);
router.get('/daily-sales', c.dailySales);
router.get('/customer-outstanding', c.customerOutstanding);
export default router;
