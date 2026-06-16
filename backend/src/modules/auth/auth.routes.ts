import { Router } from 'express';
import * as c from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.post('/login', c.login);
router.post('/refresh', c.refresh);
router.post('/logout', c.logout);
router.get('/me', authenticate, c.me);
router.post('/register', authenticate, allow(), c.register);   // ADMIN only
router.get('/users', authenticate, allow('MANAGER'), c.listUsers);
export default router;
