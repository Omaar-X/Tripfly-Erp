import { Router } from 'express';
import * as c from './crm.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);
router.get('/customers', c.listCustomers);
router.post('/customers', allow('SALES', 'ACCOUNTANT'), c.createCustomer);
router.get('/customers/:id', c.customerProfile);
router.get('/suppliers', c.listSuppliers);
router.post('/suppliers', allow('ACCOUNTANT', 'MANAGER'), c.createSupplier);
export default router;
