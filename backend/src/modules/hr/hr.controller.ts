import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { audit } from '../../middleware/audit';
import { hrService } from './hr.service';
import { renderPayslipPdf } from './payslip.pdf';

const employeeSchema = z.object({
  empCode: z.string().min(1).max(30),
  name: z.string().min(2).max(120),
  designation: z.string().max(80).optional(),
  department: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  basicSalary: z.number().min(0),
  houseRent: z.number().min(0).optional(),
  medicalAllow: z.number().min(0).optional(),
  conveyance: z.number().min(0).optional(),
  commissionRate: z.number().min(0).max(100).optional()
});

const attendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marks: z.array(z.object({
    employeeId: z.number().int().positive(),
    status: z.enum(['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY']),
    checkIn: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    checkOut: z.string().regex(/^\d{2}:\d{2}$/).optional()
  })).min(1)
});

const periodSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12)
});

/** GET /api/hr/employees */
export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await hrService.listEmployees(req.user!.companyId) });
});

/**
 * POST /api/hr/employees
 * Request: { "empCode": "EMP-004", "name": "Farzana Akter", "designation": "Tour Consultant",
 *   "department": "Sales", "basicSalary": 24000, "houseRent": 9500, "medicalAllow": 2500,
 *   "conveyance": 2000, "commissionRate": 4.5, "joiningDate": "2026-06-01" }
 * Response 201: { "success": true, "data": { "id": 4 } }
 */
export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const input = employeeSchema.parse(req.body);
  const id = await hrService.createEmployee(req.user!.companyId, input);
  await audit(req, 'EMPLOYEE_CREATE', 'employees', id, { empCode: input.empCode });
  res.status(201).json({ success: true, data: { id } });
});

/** PATCH /api/hr/employees/:id — partial update incl. { "isActive": false } */
export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const input = employeeSchema.partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
  await hrService.updateEmployee(req.user!.companyId, Number(req.params.id), input);
  await audit(req, 'EMPLOYEE_UPDATE', 'employees', Number(req.params.id), input);
  res.json({ success: true });
});

/**
 * POST /api/hr/attendance — bulk day sheet (upsert)
 * Request: { "date": "2026-06-10", "marks": [
 *   { "employeeId": 1, "status": "PRESENT", "checkIn": "09:05", "checkOut": "18:00" },
 *   { "employeeId": 3, "status": "HALF_DAY" } ] }
 * Response 200: { "success": true, "data": { "date": "2026-06-10", "saved": 2 } }
 */
export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  const input = attendanceSchema.parse(req.body);
  const data = await hrService.markAttendance(req.user!.companyId, input.date, input.marks);
  res.json({ success: true, data });
});

/** GET /api/hr/attendance?year=2026&month=6 — month sheet */
export const attendanceSheet = asyncHandler(async (req: Request, res: Response) => {
  const { year, month } = periodSchema.parse({ year: Number(req.query.year), month: Number(req.query.month) });
  res.json({ success: true, data: await hrService.attendanceSheet(req.user!.companyId, year, month) });
});

/** GET /api/hr/payroll — all runs */
export const listRuns = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await hrService.listRuns(req.user!.companyId) });
});

/** GET /api/hr/payroll/:id — run + payslips */
export const runDetail = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await hrService.runDetail(req.user!.companyId, Number(req.params.id)) });
});

/**
 * POST /api/hr/payroll/generate
 * Request: { "year": 2026, "month": 6 }
 * Response 200: { "success": true, "data": { "runId": 3, "workingDays": 26,
 *                 "employees": 3, "totalNet": 118450 } }
 */
export const generateRun = asyncHandler(async (req: Request, res: Response) => {
  const { year, month } = periodSchema.parse(req.body);
  const data = await hrService.generateRun(req.user!.companyId, year, month);
  await audit(req, 'PAYROLL_GENERATE', 'payroll_runs', data.runId, { year, month, totalNet: data.totalNet });
  res.json({ success: true, data });
});

/**
 * POST /api/hr/payroll/:id/approve — posts Dr Salary Expense / Cr Salaries Payable
 * Response 200: { "success": true, "data": { "runId": 3, "status": "APPROVED",
 *                 "voucherNo": "JV-2026-00021", "total": 118450 } }
 */
export const approveRun = asyncHandler(async (req: Request, res: Response) => {
  const data = await hrService.approveRun(req.user!.companyId, req.user!.sub, Number(req.params.id));
  await audit(req, 'PAYROLL_APPROVE', 'payroll_runs', data.runId, { voucherNo: data.voucherNo });
  res.json({ success: true, data });
});

/**
 * POST /api/hr/payroll/:id/pay — posts Dr Salaries Payable / Cr Cash-Bank
 * Request: { "method": "BANK" }
 */
export const payRun = asyncHandler(async (req: Request, res: Response) => {
  const method = z.enum(['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD']).optional().parse(req.body?.method) ?? 'BANK';
  const data = await hrService.payRun(req.user!.companyId, req.user!.sub, Number(req.params.id), method);
  await audit(req, 'PAYROLL_PAY', 'payroll_runs', data.runId, { method, total: data.total });
  res.json({ success: true, data });
});

/** GET /api/hr/payslips/:id/pdf — printable payslip */
export const payslipPdf = asyncHandler(async (req: Request, res: Response) => {
  const slip = await hrService.payslip(req.user!.companyId, Number(req.params.id));
  await renderPayslipPdf(res, slip);
});
