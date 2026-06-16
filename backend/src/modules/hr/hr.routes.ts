import { Router } from 'express';
import * as c from './hr.controller';
import { authenticate } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);
router.get('/employees', allow('MANAGER', 'ACCOUNTANT'), c.listEmployees);
router.post('/employees', allow('MANAGER'), c.createEmployee);
router.patch('/employees/:id', allow('MANAGER'), c.updateEmployee);
router.get('/attendance', allow('MANAGER', 'ACCOUNTANT'), c.attendanceSheet);
router.post('/attendance', allow('MANAGER'), c.markAttendance);
router.get('/payroll', allow('MANAGER', 'ACCOUNTANT'), c.listRuns);
router.get('/payroll/:id', allow('MANAGER', 'ACCOUNTANT'), c.runDetail);
router.post('/payroll/generate', allow('MANAGER', 'ACCOUNTANT'), c.generateRun);
router.post('/payroll/:id/approve', allow('MANAGER', 'ACCOUNTANT'), c.approveRun);
router.post('/payroll/:id/pay', allow('ACCOUNTANT'), c.payRun);
router.get('/payslips/:id/pdf', allow('MANAGER', 'ACCOUNTANT'), c.payslipPdf);
export default router;
