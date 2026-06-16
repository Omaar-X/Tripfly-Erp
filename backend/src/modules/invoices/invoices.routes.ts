import { Router } from 'express';
import * as c from './invoices.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);
router.get('/', c.list);
router.get('/:id', c.get);
router.get('/:id/pdf', c.pdf);
router.post('/', allow('ACCOUNTANT', 'SALES', 'MANAGER'), c.createManual);
export default router;
