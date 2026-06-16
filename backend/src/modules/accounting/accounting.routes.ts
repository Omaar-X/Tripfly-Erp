import { Router } from 'express';
import * as c from './accounting.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);
router.get('/ledger-groups', c.listGroups);
router.get('/ledgers', c.listLedgers);
router.post('/ledgers', allow('ACCOUNTANT'), c.createLedger);
router.get('/ledgers/:id/statement', allow('ACCOUNTANT', 'MANAGER'), c.ledgerStatement);
router.get('/vouchers', allow('ACCOUNTANT', 'MANAGER'), c.listVouchers);
router.get('/vouchers/:id', allow('ACCOUNTANT', 'MANAGER'), c.getVoucher);
router.post('/vouchers', allow('ACCOUNTANT'), c.createVoucher);
export default router;
