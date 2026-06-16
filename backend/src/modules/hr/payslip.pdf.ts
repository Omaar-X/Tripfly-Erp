import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Row, query } from '../../config/db';

const TEAL = '#0f766e';
const INK = '#111827';
const MUTED = '#6b7280';

const bdt = (n: number) =>
  'BDT ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

/** Streams a one-page A5-landscape payslip PDF. */
export async function renderPayslipPdf(res: Response, slip: Row): Promise<void> {
  const companyRows = await query<Row[]>('SELECT * FROM companies WHERE id = ?', [slip.company_id]);
  const company = companyRows[0] ?? { name: 'Trip Fly BD' };
  const period = `${MONTHS[Number(slip.period_month) - 1]} ${slip.period_year}`;

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="payslip-${slip.emp_code}-${slip.period_year}-${slip.period_month}.pdf"`);
  doc.pipe(res);

  const X = 48, W = doc.page.width - 96;

  doc.rect(0, 0, doc.page.width, 96).fill(TEAL);
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(20).text(company.name ?? 'Trip Fly BD', X, 30);
  doc.font('Helvetica').fontSize(9).fillColor('#ccfbf1').text(`Payslip — ${period}`, X, 56);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#ffffff')
    .text(String(slip.emp_code), X, 38, { width: W, align: 'right' });

  let y = 124;
  const info: [string, string][] = [
    ['Employee', String(slip.name)],
    ['Designation', String(slip.designation ?? '—')],
    ['Department', String(slip.department ?? '—')],
    ['Working days', String(slip.working_days)],
    ['Days credited', String(slip.present_days)]
  ];
  for (const [k, v] of info) {
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(k, X, y, { width: W / 3 });
    doc.font('Helvetica-Bold').fillColor(INK).text(v, X + W / 3, y);
    y += 17;
  }

  y += 14;
  const earnings: [string, number][] = [
    ['Basic salary', Number(slip.basic)],
    ['Allowances (house + medical + conveyance)', Number(slip.allowances)],
    ['Sales commission', Number(slip.commission)]
  ];
  const deductions: [string, number][] = [
    ['Absence deduction', Number(slip.absence_deduction)],
    ['Other deductions', Number(slip.other_deduction)]
  ];

  doc.rect(X, y, W, 20).fill('#f0fdfa');
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TEAL)
    .text('EARNINGS', X + 8, y + 6).text('AMOUNT', X, y + 6, { width: W - 8, align: 'right' });
  y += 20;
  for (const [k, v] of earnings) {
    doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(k, X + 8, y + 5);
    doc.text(bdt(v), X, y + 5, { width: W - 8, align: 'right' });
    y += 19;
  }
  y += 8;
  doc.rect(X, y, W, 20).fill('#fef2f2');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#b91c1c')
    .text('DEDUCTIONS', X + 8, y + 6).text('AMOUNT', X, y + 6, { width: W - 8, align: 'right' });
  y += 20;
  for (const [k, v] of deductions) {
    doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(k, X + 8, y + 5);
    doc.text('− ' + bdt(v), X, y + 5, { width: W - 8, align: 'right' });
    y += 19;
  }

  y += 16;
  doc.rect(X, y, W, 34).fill(TEAL);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text('NET PAY', X + 10, y + 10);
  doc.text(bdt(Number(slip.net_pay)), X, y + 10, { width: W - 10, align: 'right' });

  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text('Computer-generated payslip — no signature required.', X, y + 60, { width: W, align: 'center' });
  doc.end();
}
