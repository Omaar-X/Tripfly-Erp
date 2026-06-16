import { PoolConnection } from 'mysql2/promise';
import { query, exec, withTransaction, Row, WriteResult } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { round2 } from '../../utils/money';
import { findLedgerId, moneyLedgerName, SYSTEM_LEDGERS } from '../../utils/systemLedgers';
import { postVoucherTx } from '../accounting/accounting.service';

export interface EmployeeInput {
  empCode: string; name: string; designation?: string; department?: string;
  phone?: string; email?: string; joiningDate?: string;
  basicSalary: number; houseRent?: number; medicalAllow?: number; conveyance?: number;
  commissionRate?: number;
}

export interface AttendanceMark {
  employeeId: number;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';
  checkIn?: string;   // HH:MM
  checkOut?: string;
}

/**
 * ============================ SALARY ENGINE ==================================
 * For period (year, month) and each active employee:
 *
 *   workingDays  = Mon–Sat days in the month (Friday is the weekly holiday in BD)
 *   presentDays  = PRESENT(1.0) + LEAVE(1.0, paid) + HALF_DAY(0.5); ABSENT = 0
 *   gross        = basic + houseRent + medicalAllow + conveyance
 *   perDay       = gross / workingDays
 *   absenceDed   = perDay × (workingDays − presentDays)
 *   commission   = commissionRate% × Σ(salePrice − costPrice) over CONFIRMED
 *                  bookings where agent_id = employee, created in the period
 *   netPay       = gross − absenceDed + commission
 *
 * Approving the run posts ONE balanced JOURNAL voucher:
 *   Dr Salary Expense       Σ netPay
 *   Cr Salaries Payable     Σ netPay
 * Marking PAID posts a PAYMENT voucher:
 *   Dr Salaries Payable     Σ netPay
 *   Cr Cash/Bank            Σ netPay
 * ============================================================================
 */
export const hrService = {
  // ------------------------------ employees ---------------------------------
  async listEmployees(companyId: number) {
    return query<Row[]>(
      `SELECT e.*, (e.basic_salary + e.house_rent + e.medical_allow + e.conveyance) AS gross_salary
         FROM employees e WHERE e.company_id = ? ORDER BY e.emp_code`, [companyId]);
  },

  async createEmployee(companyId: number, input: EmployeeInput) {
    const dup = await query<Row[]>(
      `SELECT id FROM employees WHERE company_id = ? AND emp_code = ?`, [companyId, input.empCode]);
    if (dup.length) throw ApiError.conflict(`Employee code ${input.empCode} already exists`);
    const res = await exec(
      `INSERT INTO employees (company_id, emp_code, name, designation, department, phone, email,
                              joining_date, basic_salary, house_rent, medical_allow, conveyance, commission_rate)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [companyId, input.empCode, input.name, input.designation ?? null, input.department ?? null,
       input.phone ?? null, input.email ?? null, input.joiningDate ?? null,
       round2(input.basicSalary), round2(input.houseRent ?? 0), round2(input.medicalAllow ?? 0),
       round2(input.conveyance ?? 0), round2(input.commissionRate ?? 0)]);
    return res.insertId;
  },

  async updateEmployee(companyId: number, id: number, input: Partial<EmployeeInput> & { isActive?: boolean }) {
    const fields: string[] = []; const params: unknown[] = [];
    const map: [keyof typeof input, string][] = [
      ['name', 'name'], ['designation', 'designation'], ['department', 'department'],
      ['phone', 'phone'], ['email', 'email'], ['joiningDate', 'joining_date'],
      ['basicSalary', 'basic_salary'], ['houseRent', 'house_rent'], ['medicalAllow', 'medical_allow'],
      ['conveyance', 'conveyance'], ['commissionRate', 'commission_rate'], ['isActive', 'is_active']
    ];
    for (const [k, col] of map) {
      if (input[k] !== undefined) { fields.push(`${col} = ?`); params.push(input[k]); }
    }
    if (!fields.length) throw ApiError.badRequest('Nothing to update');
    params.push(companyId, id);
    const res = await exec(
      `UPDATE employees SET ${fields.join(', ')} WHERE company_id = ? AND id = ?`, params);
    if (!res.affectedRows) throw ApiError.notFound('Employee not found');
  },

  // ------------------------------ attendance --------------------------------
  /** Bulk upsert one day's attendance sheet. */
  async markAttendance(companyId: number, date: string, marks: AttendanceMark[]) {
    if (!marks.length) throw ApiError.badRequest('No attendance rows supplied');
    return withTransaction(async (conn) => {
      const ids = marks.map(m => m.employeeId);
      const [emps] = await conn.query<Row[]>(
        `SELECT id FROM employees WHERE company_id = ? AND id IN (?)`, [companyId, ids]);
      if (emps.length !== new Set(ids).size)
        throw ApiError.badRequest('One or more employees do not belong to this company');
      const values = marks.map(m => [m.employeeId, date, m.status, m.checkIn ?? null, m.checkOut ?? null]);
      await conn.query(
        `INSERT INTO attendance (employee_id, att_date, status, check_in, check_out) VALUES ?
         ON DUPLICATE KEY UPDATE status = VALUES(status),
                                 check_in = VALUES(check_in), check_out = VALUES(check_out)`,
        [values]);
      return { date, saved: marks.length };
    });
  },

  async attendanceSheet(companyId: number, year: number, month: number) {
    const { from, to } = monthRange(year, month);
    const rows = await query<Row[]>(
      `SELECT a.employee_id, e.emp_code, e.name, a.att_date, a.status
         FROM attendance a JOIN employees e ON e.id = a.employee_id
        WHERE e.company_id = ? AND a.att_date BETWEEN ? AND ?
        ORDER BY e.emp_code, a.att_date`, [companyId, from, to]);
    return { from, to, workingDays: workingDaysInMonth(year, month), rows };
  },

  // ------------------------------ payroll -----------------------------------
  async listRuns(companyId: number) {
    return query<Row[]>(
      `SELECT pr.*, v.voucher_no,
              (SELECT COUNT(*) FROM payslips ps WHERE ps.payroll_run_id = pr.id) AS employees
         FROM payroll_runs pr LEFT JOIN vouchers v ON v.id = pr.voucher_id
        WHERE pr.company_id = ? ORDER BY pr.period_year DESC, pr.period_month DESC`, [companyId]);
  },

  async runDetail(companyId: number, runId: number) {
    const runs = await query<Row[]>(
      `SELECT pr.*, v.voucher_no FROM payroll_runs pr
         LEFT JOIN vouchers v ON v.id = pr.voucher_id
        WHERE pr.company_id = ? AND pr.id = ?`, [companyId, runId]);
    if (!runs.length) throw ApiError.notFound('Payroll run not found');
    const slips = await query<Row[]>(
      `SELECT ps.*, e.emp_code, e.name, e.designation
         FROM payslips ps JOIN employees e ON e.id = ps.employee_id
        WHERE ps.payroll_run_id = ? ORDER BY e.emp_code`, [runId]);
    return { ...runs[0], payslips: slips };
  },

  /** Generate (or regenerate while DRAFT) the salary run for a month. */
  async generateRun(companyId: number, year: number, month: number) {
    return withTransaction(async (conn) => {
      const [existing] = await conn.query<Row[]>(
        `SELECT * FROM payroll_runs WHERE company_id = ? AND period_year = ? AND period_month = ? FOR UPDATE`,
        [companyId, year, month]);
      let runId: number;
      if (existing.length) {
        if (existing[0].status !== 'DRAFT')
          throw ApiError.conflict(`Payroll for ${year}-${month} is already ${existing[0].status}`);
        runId = existing[0].id;
        await conn.query(`DELETE FROM payslips WHERE payroll_run_id = ?`, [runId]);
      } else {
        const [res] = await conn.query<WriteResult>(
          `INSERT INTO payroll_runs (company_id, period_year, period_month) VALUES (?,?,?)`,
          [companyId, year, month]);
        runId = res.insertId;
      }

      const { from, to } = monthRange(year, month);
      const workingDays = workingDaysInMonth(year, month);

      const [employees] = await conn.query<Row[]>(
        `SELECT * FROM employees WHERE company_id = ? AND is_active = 1`, [companyId]);
      if (!employees.length) throw ApiError.badRequest('No active employees');

      // attendance aggregated once for the whole company
      const [att] = await conn.query<Row[]>(
        `SELECT employee_id,
                SUM(CASE status WHEN 'PRESENT' THEN 1 WHEN 'LEAVE' THEN 1
                                WHEN 'HALF_DAY' THEN 0.5 ELSE 0 END) AS credited
           FROM attendance
          WHERE att_date BETWEEN ? AND ?
            AND employee_id IN (SELECT id FROM employees WHERE company_id = ?)
          GROUP BY employee_id`, [from, to, companyId]);
      const credited = new Map<number, number>(att.map(r => [r.employee_id as number, Number(r.credited)]));

      // agent commissions: % of margin on CONFIRMED bookings created this period
      const [comm] = await conn.query<Row[]>(
        `SELECT agent_id, SUM(sale_price - cost_price) AS margin
           FROM bookings
          WHERE company_id = ? AND status = 'CONFIRMED' AND agent_id IS NOT NULL
            AND DATE(created_at) BETWEEN ? AND ?
          GROUP BY agent_id`, [companyId, from, to]);
      const margins = new Map<number, number>(comm.map(r => [r.agent_id as number, Number(r.margin)]));

      let totalNet = 0;
      const values: unknown[][] = [];
      for (const e of employees) {
        const gross = round2(Number(e.basic_salary) + Number(e.house_rent)
                           + Number(e.medical_allow) + Number(e.conveyance));
        const allowances = round2(gross - Number(e.basic_salary));
        // No attendance marked at all → assume full presence (sheet not maintained yet)
        const presentDays = credited.has(e.id) ? Math.min(credited.get(e.id)!, workingDays) : workingDays;
        const perDay = gross / workingDays;
        const absenceDeduction = round2(perDay * (workingDays - presentDays));
        const commission = round2((margins.get(e.id) ?? 0) * Number(e.commission_rate) / 100);
        const netPay = round2(gross - absenceDeduction + commission);
        totalNet = round2(totalNet + netPay);
        values.push([runId, e.id, workingDays, presentDays, Number(e.basic_salary),
                     allowances, commission, absenceDeduction, 0, netPay]);
      }
      await conn.query(
        `INSERT INTO payslips (payroll_run_id, employee_id, working_days, present_days, basic,
                               allowances, commission, absence_deduction, other_deduction, net_pay)
         VALUES ?`, [values]);
      await conn.query(`UPDATE payroll_runs SET total_net = ? WHERE id = ?`, [totalNet, runId]);
      return { runId, year, month, workingDays, employees: employees.length, totalNet };
    });
  },

  /** DRAFT → APPROVED. Books the salary liability. */
  async approveRun(companyId: number, userId: number, runId: number) {
    return withTransaction(async (conn) => {
      const run = await lockRun(conn, companyId, runId);
      if (run.status !== 'DRAFT') throw ApiError.conflict(`Run is already ${run.status}`);
      const total = round2(Number(run.total_net));
      if (!(total > 0)) throw ApiError.badRequest('Run total is zero — generate payslips first');

      const expenseId = await findLedgerId(conn, companyId, SYSTEM_LEDGERS.SALARY_EXPENSE);
      const payableId = await findLedgerId(conn, companyId, SYSTEM_LEDGERS.SALARIES_PAYABLE);
      const voucher = await postVoucherTx(conn, companyId, userId, {
        type: 'JOURNAL', date: new Date().toISOString().slice(0, 10),
        narration: `Salary for ${run.period_year}-${String(run.period_month).padStart(2, '0')}`,
        entries: [
          { ledgerId: expenseId, type: 'DR', amount: total, note: 'Monthly salary expense' },
          { ledgerId: payableId, type: 'CR', amount: total, note: 'Salaries payable' }
        ]
      });
      await conn.query(`UPDATE payroll_runs SET status = 'APPROVED', voucher_id = ? WHERE id = ?`,
        [voucher.voucherId, runId]);
      return { runId, status: 'APPROVED', voucherNo: voucher.voucherNo, total };
    });
  },

  /** APPROVED → PAID. Releases the cash. */
  async payRun(companyId: number, userId: number, runId: number,
               method: 'CASH' | 'BANK' | 'BKASH' | 'NAGAD' | 'CARD' = 'BANK') {
    return withTransaction(async (conn) => {
      const run = await lockRun(conn, companyId, runId);
      if (run.status !== 'APPROVED') throw ApiError.conflict('Only APPROVED runs can be paid');
      const total = round2(Number(run.total_net));
      const payableId = await findLedgerId(conn, companyId, SYSTEM_LEDGERS.SALARIES_PAYABLE);
      const moneyId = await findLedgerId(conn, companyId, moneyLedgerName(method));
      const voucher = await postVoucherTx(conn, companyId, userId, {
        type: 'PAYMENT', date: new Date().toISOString().slice(0, 10),
        narration: `Salary disbursement ${run.period_year}-${String(run.period_month).padStart(2, '0')} via ${method}`,
        entries: [
          { ledgerId: payableId, type: 'DR', amount: total, note: 'Clear salaries payable' },
          { ledgerId: moneyId, type: 'CR', amount: total, note: method }
        ]
      });
      await conn.query(`UPDATE payroll_runs SET status = 'PAID' WHERE id = ?`, [runId]);
      return { runId, status: 'PAID', voucherNo: voucher.voucherNo, total };
    });
  },

  async payslip(companyId: number, slipId: number) {
    const rows = await query<Row[]>(
      `SELECT ps.*, e.emp_code, e.name, e.designation, e.department,
              pr.period_year, pr.period_month, pr.status AS run_status, pr.company_id
         FROM payslips ps
         JOIN employees e ON e.id = ps.employee_id
         JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
        WHERE pr.company_id = ? AND ps.id = ?`, [companyId, slipId]);
    if (!rows.length) throw ApiError.notFound('Payslip not found');
    return rows[0];
  }
};

// ------------------------------- helpers ------------------------------------

async function lockRun(conn: PoolConnection, companyId: number, runId: number): Promise<Row> {
  const [rows] = await conn.query<Row[]>(
    `SELECT * FROM payroll_runs WHERE company_id = ? AND id = ? FOR UPDATE`, [companyId, runId]);
  if (!rows.length) throw ApiError.notFound('Payroll run not found');
  return rows[0];
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

/** Mon–Sat are working days; Friday is the weekly holiday in Bangladesh. */
export function workingDaysInMonth(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() !== 5) n++; // 5 = Friday
  }
  return n;
}
