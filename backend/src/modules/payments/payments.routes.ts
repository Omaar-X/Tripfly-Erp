import { Router } from 'express';
import * as c from './payments.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);
router.get('/', allow('ACCOUNTANT', 'MANAGER', 'SALES'), c.list);
router.post('/', allow('ACCOUNTANT', 'MANAGER'), c.record);
export default router;
