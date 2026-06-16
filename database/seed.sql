-- ============================================================================
--  TRIP FLY BD ERP  ·  Seed data  (run after schema.sql)
--
--  Default login accounts
--  ──────────────────────
--  admin@tripflybd.com      / admin123   (ADMIN)
--  accountant@tripflybd.com / user123    (ACCOUNTANT)
--  sales@tripflybd.com      / user123    (SALES)
--  manager@tripflybd.com    / user123    (MANAGER)
-- ============================================================================
USE tripfly_erp;

-- ─── Company ─────────────────────────────────────────────────────────────────
INSERT INTO companies (id, name, address, phone, email, vat_reg_no, currency) VALUES
  (1, 'Trip Fly BD',
   'House 12, Road 5, Banani, Dhaka 1213, Bangladesh',
   '+880 1700-000000', 'info@tripflybd.com', 'BIN-004512367-0101', 'BDT');

-- ─── Roles ───────────────────────────────────────────────────────────────────
INSERT INTO roles (id, name, label, description) VALUES
  (1, 'ADMIN',      'Administrator',   'Full access to every module and setting'),
  (2, 'ACCOUNTANT', 'Accountant',      'Accounting, vouchers, payments, reports'),
  (3, 'SALES',      'Sales Executive', 'Bookings, customers, invoices'),
  (4, 'MANAGER',    'Manager',         'Read-all, approve payroll and reports');

-- ─── Users (passwords: admin123 / user123) ───────────────────────────────────
INSERT INTO users (id, company_id, role_id, name, email, password_hash) VALUES
  (1, 1, 1, 'System Admin',  'admin@tripflybd.com',      '$2b$10$wmAVLrhPOKVfxp1wTvjp/.G0iQlyThvEeL7LC8iLjYdEM6pVFKjZW'),
  (2, 1, 2, 'Rahim Uddin',   'accountant@tripflybd.com', '$2b$10$1QKvFJ9H8KIcJIYbjhpI..bJ0YMb6PWk2/zNenqc77fyLPP.qZiSO'),
  (3, 1, 3, 'Nusrat Jahan',  'sales@tripflybd.com',      '$2b$10$1QKvFJ9H8KIcJIYbjhpI..bJ0YMb6PWk2/zNenqc77fyLPP.qZiSO'),
  (4, 1, 4, 'Kamal Hossain', 'manager@tripflybd.com',    '$2b$10$1QKvFJ9H8KIcJIYbjhpI..bJ0YMb6PWk2/zNenqc77fyLPP.qZiSO');


-- ============================================================================
--  CHART OF ACCOUNTS
-- ============================================================================

-- Ledger groups (Tally-style tree) ───────────────────────────────────────────
INSERT INTO ledger_groups (id, company_id, parent_id, name, nature, sort_order) VALUES
  -- Assets
  (1,  1, NULL, 'Assets',                 'ASSET',     1),
  (2,  1, 1,    'Current Assets',         'ASSET',     1),
  (3,  1, 2,    'Cash-in-Hand',           'ASSET',     1),
  (4,  1, 2,    'Bank Accounts',          'ASSET',     2),
  (5,  1, 2,    'Sundry Debtors',         'ASSET',     3),
  (6,  1, 2,    'Stock-in-Hand',          'ASSET',     4),
  -- Liabilities
  (7,  1, NULL, 'Liabilities',            'LIABILITY', 2),
  (8,  1, 7,    'Sundry Creditors',       'LIABILITY', 1),
  (9,  1, 7,    'Duties & Taxes',         'LIABILITY', 2),
  (10, 1, 7,    'Salaries Payable',       'LIABILITY', 3),
  -- Equity
  (11, 1, NULL, 'Capital Account',        'EQUITY',    3),
  -- Income
  (12, 1, NULL, 'Income',                 'INCOME',    4),
  (13, 1, 12,   'Travel Sales',           'INCOME',    1),
  -- Expenses
  (14, 1, NULL, 'Expenses',               'EXPENSE',   5),
  (15, 1, 14,   'Direct Expenses',        'EXPENSE',   1),
  (16, 1, 14,   'Indirect Expenses',      'EXPENSE',   2);

-- System ledgers ─────────────────────────────────────────────────────────────
INSERT INTO ledgers (id, company_id, group_id, name, opening_balance, opening_type, is_system) VALUES
  (1,  1, 3,  'Cash in Hand',            250000.00, 'DR', 1),
  (2,  1, 4,  'City Bank — A/C 110245',  800000.00, 'DR', 1),
  (3,  1, 4,  'bKash Merchant Wallet',    50000.00, 'DR', 1),
  (4,  1, 11, 'Owner''s Capital',       1100000.00, 'CR', 1),
  (5,  1, 13, 'Sales — Air Tickets',          0.00, 'DR', 1),
  (6,  1, 13, 'Sales — Hotel Bookings',       0.00, 'DR', 1),
  (7,  1, 13, 'Sales — Tour Packages',        0.00, 'DR', 1),
  (8,  1, 9,  'VAT Payable',                  0.00, 'CR', 1),
  (9,  1, 15, 'Cost of Services',             0.00, 'DR', 1),
  (10, 1, 16, 'Office Rent',                  0.00, 'DR', 0),
  (11, 1, 16, 'Salary Expense',               0.00, 'DR', 1),
  (12, 1, 16, 'Utilities',                    0.00, 'DR', 0),
  (13, 1, 10, 'Salaries Payable',             0.00, 'CR', 1),
  (14, 1, 16, 'Marketing & Ads',              0.00, 'DR', 0);

-- Customer / supplier sub-ledgers ────────────────────────────────────────────
INSERT INTO ledgers (id, company_id, group_id, name, opening_balance, opening_type) VALUES
  (20, 1, 5, 'Customer — Tanvir Ahmed',        0.00, 'DR'),
  (21, 1, 5, 'Customer — GreenTex Apparels',   0.00, 'DR'),
  (22, 1, 5, 'Customer — Maliha Begum',        0.00, 'DR'),
  (23, 1, 8, 'Supplier — Biman Bangladesh',    0.00, 'CR'),
  (24, 1, 8, 'Supplier — Sea Pearl Resort',    0.00, 'CR');


-- ============================================================================
--  CRM
-- ============================================================================

INSERT INTO customers (id, company_id, ledger_id, name, email, phone, address, passport_no, credit_limit) VALUES
  (1, 1, 20, 'Tanvir Ahmed',       'tanvir@example.com',   '+880 1711-111111', 'Dhanmondi, Dhaka',  'BP0123456', 200000.00),
  (2, 1, 21, 'GreenTex Apparels',  'travel@greentex.com',  '+880 1822-222222', 'Uttara, Dhaka',     NULL,        500000.00),
  (3, 1, 22, 'Maliha Begum',       'maliha@example.com',   '+880 1933-333333', 'Gulshan, Dhaka',    'AB9876543', 100000.00);

INSERT INTO suppliers (id, company_id, ledger_id, name, email, phone, address) VALUES
  (1, 1, 23, 'Biman Bangladesh Airlines', 'sales@biman.com',      '+880 2-890000',      'Kurmitola, Dhaka'),
  (2, 1, 24, 'Sea Pearl Beach Resort',    'rsv@seapearl.com',     '+880 1955-555555',   'Inani, Cox''s Bazar');


-- ============================================================================
--  INVENTORY
-- ============================================================================

INSERT INTO warehouses (id, company_id, name, location) VALUES
  (1, 1, 'Head Office Store', 'Banani, Dhaka'),
  (2, 1, 'Airport Counter',   'Hazrat Shahjalal Airport, Dhaka');

INSERT INTO items (id, company_id, sku, name, description, category, unit, purchase_price, sale_price, reorder_level) VALUES
  (1, 1, 'SIM-TOUR', 'Tourist SIM Card',    'Roaming SIM for international travellers',   'Travel Accessories', 'pcs',  250.00,  450.00, 20),
  (2, 1, 'LUG-TAG',  'Branded Luggage Tag', 'Trip Fly BD co-branded hard luggage tag',    'Travel Accessories', 'pcs',   60.00,  150.00, 50),
  (3, 1, 'TRV-PLW',  'Neck Travel Pillow',  'Memory-foam inflatable neck pillow',          'Travel Accessories', 'pcs',  480.00,  900.00, 10),
  (4, 1, 'TRV-BCK',  'Travel Backpack',     '30L waterproof carry-on travel backpack',    'Bags',               'pcs', 1800.00, 3500.00,  5),
  (5, 1, 'DOC-WLT',  'Document Wallet',     'RFID-blocking travel document organiser',    'Accessories',        'pcs',  180.00,  400.00, 15);

INSERT INTO stock_entries (company_id, item_id, warehouse_id, entry_type, quantity, rate, entry_date, note) VALUES
  (1, 1, 1, 'IN',  100, 250.00, '2026-04-01', 'Opening stock — April batch'),
  (1, 2, 1, 'IN',  200,  60.00, '2026-04-01', 'Opening stock — April batch'),
  (1, 3, 1, 'IN',   30, 480.00, '2026-04-05', 'Opening stock'),
  (1, 4, 1, 'IN',   20, 1800.00,'2026-04-10', 'New SKU — initial purchase'),
  (1, 5, 1, 'IN',   50, 180.00, '2026-04-10', 'New SKU — initial purchase'),
  (1, 1, 1, 'IN',   50, 270.00, '2026-05-01', 'May restock at new rate'),
  (1, 2, 1, 'IN',  100,  65.00, '2026-05-01', 'May restock'),
  (1, 1, 1, 'OUT',  40, 450.00, '2026-05-15', 'Counter sales'),
  (1, 2, 1, 'OUT',  30, 150.00, '2026-05-20', 'Counter sales'),
  (1, 3, 1, 'OUT',   5, 900.00, '2026-05-22', 'Counter sales'),
  (1, 1, 2, 'IN',   30, 270.00, '2026-06-01', 'Airport counter stock transfer'),
  (1, 4, 2, 'IN',   10, 1800.00,'2026-06-01', 'Airport counter stock'),
  (1, 1, 1, 'OUT',  20, 450.00, '2026-06-05', 'Online order fulfilment');


-- ============================================================================
--  EMPLOYEES
-- ============================================================================

INSERT INTO employees (id, company_id, emp_code, name, designation, department, phone, email,
  joining_date, basic_salary, house_rent, medical_allow, conveyance, commission_rate) VALUES
  (1, 1, 'EMP-001', 'Nusrat Jahan',   'Sales Executive',  'Sales',    '+880 1733-333333', 'nusrat@tripflybd.com', '2024-03-01', 25000.00, 10000.00, 3000.00, 2000.00, 5.00),
  (2, 1, 'EMP-002', 'Rahim Uddin',    'Accountant',       'Accounts', '+880 1744-444444', 'rahim@tripflybd.com',  '2023-07-15', 35000.00, 14000.00, 3000.00, 2000.00, 0.00),
  (3, 1, 'EMP-003', 'Sajib Karim',    'Ticketing Agent',  'Sales',    '+880 1755-555555', 'sajib@tripflybd.com',  '2025-01-10', 22000.00,  9000.00, 2500.00, 2000.00, 4.00),
  (4, 1, 'EMP-004', 'Rokeya Khanam',  'Tour Coordinator', 'Sales',    '+880 1766-666666', 'rokeya@tripflybd.com', '2025-06-01', 28000.00, 11000.00, 3000.00, 2000.00, 3.50),
  (5, 1, 'EMP-005', 'Tanvir Hasan',   'Office Assistant', 'Admin',    '+880 1777-777777', 'tanjir@tripflybd.com', '2026-01-15', 18000.00,  7200.00, 2000.00, 2000.00, 0.00);

-- Attendance sample — May 2026 (working days 1–31) ───────────────────────────
INSERT INTO attendance (employee_id, att_date, status, check_in, check_out) VALUES
  -- Nusrat Jahan (EMP-001)
  (1, '2026-05-04', 'PRESENT', '09:05:00', '18:10:00'),
  (1, '2026-05-05', 'PRESENT', '09:00:00', '18:00:00'),
  (1, '2026-05-06', 'PRESENT', '09:15:00', '18:05:00'),
  (1, '2026-05-07', 'LEAVE',   NULL,        NULL),
  (1, '2026-05-08', 'PRESENT', '09:00:00', '18:00:00'),
  (1, '2026-05-11', 'PRESENT', '09:10:00', '18:15:00'),
  (1, '2026-05-12', 'PRESENT', '09:00:00', '18:00:00'),
  (1, '2026-05-13', 'HALF_DAY','09:00:00', '13:00:00'),
  (1, '2026-05-14', 'PRESENT', '09:00:00', '18:00:00'),
  (1, '2026-05-15', 'PRESENT', '08:55:00', '18:00:00'),
  -- Rahim Uddin (EMP-002)
  (2, '2026-05-04', 'PRESENT', '09:00:00', '18:00:00'),
  (2, '2026-05-05', 'PRESENT', '09:00:00', '18:00:00'),
  (2, '2026-05-06', 'ABSENT',  NULL,        NULL),
  (2, '2026-05-07', 'PRESENT', '09:00:00', '18:00:00'),
  (2, '2026-05-08', 'PRESENT', '09:00:00', '18:00:00'),
  (2, '2026-05-11', 'PRESENT', '08:50:00', '18:00:00'),
  (2, '2026-05-12', 'PRESENT', '09:00:00', '18:10:00'),
  (2, '2026-05-13', 'PRESENT', '09:00:00', '18:00:00'),
  (2, '2026-05-14', 'PRESENT', '09:00:00', '18:00:00'),
  (2, '2026-05-15', 'PRESENT', '09:00:00', '18:00:00');


-- ============================================================================
--  ACCOUNTING VOUCHERS  (5 sample transactions)
-- ============================================================================

-- V001 · JOURNAL · Office rent payment (May 2026) ─────────────────────────────
INSERT INTO vouchers (id, company_id, voucher_no, voucher_type, voucher_date,
  narration, total_amount, created_by) VALUES
  (1, 1, 'JV-2026-0001', 'JOURNAL', '2026-05-01',
   'Office rent payment — May 2026', 30000.00, 2);

INSERT INTO voucher_entries (voucher_id, ledger_id, entry_type, amount, line_note) VALUES
  (1, 10, 'DR', 30000.00, 'Office rent May 2026'),
  (1,  1, 'CR', 30000.00, 'Paid from cash in hand');

-- V002 · JOURNAL · Marketing expense ─────────────────────────────────────────
INSERT INTO vouchers (id, company_id, voucher_no, voucher_type, voucher_date,
  narration, total_amount, created_by) VALUES
  (2, 1, 'JV-2026-0002', 'JOURNAL', '2026-05-10',
   'Facebook & Google Ads — May 2026', 15000.00, 2);

INSERT INTO voucher_entries (voucher_id, ledger_id, entry_type, amount, line_note) VALUES
  (2, 14, 'DR', 15000.00, 'Digital marketing May 2026'),
  (2,  2, 'CR', 15000.00, 'City Bank transfer');

-- V003 · SALES · Air ticket booking for Tanvir Ahmed ─────────────────────────
INSERT INTO vouchers (id, company_id, voucher_no, voucher_type, voucher_date,
  narration, reference, total_amount, created_by) VALUES
  (3, 1, 'SV-2026-0001', 'SALES', '2026-05-18',
   'Air ticket — Dhaka to Bangkok (return)', 'BK-2026-0001', 85000.00, 3);

INSERT INTO voucher_entries (voucher_id, ledger_id, entry_type, amount, line_note) VALUES
  (3, 20, 'DR', 85000.00, 'Tanvir Ahmed receivable'),
  (3,  5, 'CR', 85000.00, 'Sales — Air Tickets');

-- V004 · RECEIPT · Partial payment from Tanvir Ahmed ─────────────────────────
INSERT INTO vouchers (id, company_id, voucher_no, voucher_type, voucher_date,
  narration, reference, total_amount, created_by) VALUES
  (4, 1, 'RV-2026-0001', 'RECEIPT', '2026-05-20',
   'Advance received from Tanvir Ahmed', 'BK-2026-0001', 50000.00, 3);

INSERT INTO voucher_entries (voucher_id, ledger_id, entry_type, amount, line_note) VALUES
  (4,  2, 'DR', 50000.00, 'City Bank deposit'),
  (4, 20, 'CR', 50000.00, 'Tanvir Ahmed advance');

-- V005 · SALES · Hotel booking for GreenTex Apparels ─────────────────────────
INSERT INTO vouchers (id, company_id, voucher_no, voucher_type, voucher_date,
  narration, reference, total_amount, created_by) VALUES
  (5, 1, 'SV-2026-0002', 'SALES', '2026-06-03',
   'Sea Pearl Beach Resort — 3 nights for 4 pax', 'BK-2026-0002', 120000.00, 3);

INSERT INTO voucher_entries (voucher_id, ledger_id, entry_type, amount, line_note) VALUES
  (5, 21, 'DR', 120000.00, 'GreenTex Apparels receivable'),
  (5,  6, 'CR', 120000.00, 'Sales — Hotel Bookings');


-- ============================================================================
--  INVOICES
-- ============================================================================

INSERT INTO invoices (id, company_id, invoice_no, customer_id, invoice_date, due_date,
  subtotal, discount, vat_percent, vat_amount, total, paid_amount, status, voucher_id) VALUES
  (1, 1, 'INV-2026-0001', 1, '2026-05-18', '2026-06-18',
   85000.00, 0.00, 0.00, 0.00, 85000.00, 50000.00, 'PARTIAL', 3),
  (2, 1, 'INV-2026-0002', 2, '2026-06-03', '2026-07-03',
   120000.00, 5000.00, 5.00, 5750.00, 120750.00, 0.00, 'UNPAID', 5);

INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES
  (1, 'Dhaka → Bangkok → Dhaka (return) — Economy class, 2 pax', 2, 42500.00,  85000.00),
  (2, 'Sea Pearl Beach Resort — Deluxe Sea View Room',             3,  40000.00, 120000.00);


-- ============================================================================
--  BOOKINGS
-- ============================================================================

INSERT INTO bookings (id, company_id, booking_no, customer_id, booking_type, status,
  travel_date, return_date, details, cost_price, sale_price,
  supplier_id, agent_id, invoice_id, created_by) VALUES
  (1, 1, 'BK-2026-0001', 1, 'FLIGHT', 'CONFIRMED',
   '2026-06-15', '2026-06-22',
   '{"airline":"Biman Bangladesh","pnr":"BG4521","route":"DAC-BKK-DAC","class":"Economy","pax":2}',
   60000.00, 85000.00, 1, 1, 1, 3),
  (2, 1, 'BK-2026-0002', 2, 'HOTEL', 'CONFIRMED',
   '2026-07-01', '2026-07-04',
   '{"hotel":"Sea Pearl Beach Resort","nights":3,"pax":4,"room_type":"Deluxe Sea View"}',
   80000.00, 120000.00, 2, 3, 2, 3),
  (3, 1, 'BK-2026-0003', 3, 'TOUR', 'PENDING',
   '2026-08-10', '2026-08-17',
   '{"package":"Maldives 7N/8D","pax":2,"inclusions":"flights,hotel,breakfast,snorkelling"}',
   95000.00, 145000.00, NULL, 4, NULL, 3),
  (4, 1, 'BK-2026-0004', 1, 'FLIGHT', 'PENDING',
   '2026-09-05', '2026-09-10',
   '{"airline":"IndiGo","pnr":null,"route":"DAC-DEL-DAC","class":"Economy","pax":1}',
   18000.00, 28000.00, NULL, 1, NULL, 3);


-- ============================================================================
--  PAYMENTS
-- ============================================================================

INSERT INTO payments (id, company_id, payment_no, direction, customer_id, invoice_id,
  method, amount, payment_date, voucher_id, notes, created_by) VALUES
  (1, 1, 'PMT-2026-0001', 'IN', 1, 1,
   'BANK', 50000.00, '2026-05-20', 4,
   'Advance against INV-2026-0001 (Dhaka-Bangkok flights)', 3);
