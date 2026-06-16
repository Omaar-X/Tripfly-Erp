import { Router } from 'express';
import * as c from './bookings.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);
router.get('/', c.list);
router.get('/history/:customerId', c.history);
router.get('/:id', c.get);
router.post('/', allow('SALES', 'MANAGER'), c.create);
router.post('/:id/confirm', allow('SALES', 'ACCOUNTANT', 'MANAGER'), c.confirm);
router.post('/:id/cancel', allow('SALES', 'ACCOUNTANT', 'MANAGER'), c.cancel);
export default router;
