# TRIP FLY BD — Travel Agency ERP

A full-stack, production-grade ERP for a travel agency, built around a **Tally-style double-entry accounting core**. Every business action — confirming a booking, receiving a payment, paying salaries — posts balanced vouchers into one ledger of truth.

| Layer | Stack |
|---|---|
| Backend | Node.js · Express · TypeScript (Clean Architecture: routes → controllers → services → repositories) |
| Frontend | React 18 · TypeScript · TailwindCSS · Recharts (Zoho Books × Tally hybrid UI, dark/light, fully responsive) |
| Database | MySQL 8 (InnoDB, FK-enforced) |
| Auth | JWT access + rotating refresh tokens · RBAC (`ADMIN`, `ACCOUNTANT`, `SALES`, `MANAGER`) · audit logging |
| PDFs | pdfkit — print-ready tax invoices & payslips |

## Modules

- **Accounting** — chart of accounts, all 8 voucher types (Journal, Payment, Receipt, Sales, Purchase, Contra, Debit/Credit Note), strict `debit == credit` validation to the paisa, ledger statements with running balances.
- **Reports** — Trial Balance, Profit & Loss, Balance Sheet, Cash Book, Bank Book, Day Book, daily sales, customer outstanding — all computed live from vouchers.
- **Travel Bookings** — flight / hotel / tour. Confirming a booking posts the sales voucher, raises the VAT invoice, and books supplier cost in a single transaction. Cancelling a confirmed booking posts a credit-note reversal.
- **Invoicing** — auto (from bookings) and manual invoices, discounts, Bangladesh VAT, partial payments, status tracking, branded PDF.
- **Payments** — customer receipts and supplier payments via Cash / Bank / bKash / Nagad / Card, with optional invoice settlement (overpayment rejected).
- **Inventory** — items, warehouses, IN/OUT movements with negative-stock protection, valuation under **FIFO and weighted average side by side**.
- **CRM** — customers and suppliers each get an auto-created sub-ledger; live receivable/payable balances; customer 360° profile (bookings, invoices, payments).
- **HR & Payroll** — employees, attendance (BD calendar: Friday off), salary engine (gross − absence deduction + commission on confirmed-booking margins), DRAFT → APPROVED → PAID workflow that accrues and disburses through the ledger, payslip PDFs.
- **Dashboard** — YTD revenue/expense/profit straight from the ledger, 12-month trend, revenue by service, cash & bank position, activity feed.

## Prerequisites

- Node.js **18+**
- MySQL **8.x**

## 1 — Database

```bash
mysql -u root -p < database/schema.sql   # creates database `tripfly_erp` + tables
mysql -u root -p < database/seed.sql     # company, users, ledgers, sample data
```

## 2 — Backend (port 4000)

```bash
cd backend
cp .env.example .env       # set DB_USER / DB_PASSWORD for your MySQL
npm install
npm run dev                # http://localhost:4000  (health: GET /api/health)
```

## 3 — Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173  (dev proxy → :4000)
```

## Login credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@tripflybd.com` | `admin123` |
| Accountant | `accountant@tripflybd.com` | `user123` |
| Sales | `sales@tripflybd.com` | `user123` |
| Manager | `manager@tripflybd.com` | `user123` |

## API at a glance

All endpoints are under `/api`, return `{ "success": true, "data": … }`, and (except auth) require `Authorization: Bearer <accessToken>`.

```http
POST /api/auth/login              { "email": "admin@tripflybd.com", "password": "admin123" }
POST /api/auth/refresh            { "refreshToken": "…" }            # rotating refresh
GET  /api/ledgers                                                    # chart of accounts + balances
POST /api/vouchers                { "type": "JOURNAL", "date": "2026-06-10",
                                    "entries": [ { "ledgerId": 1, "type": "DR", "amount": 5000 },
                                                 { "ledgerId": 4, "type": "CR", "amount": 5000 } ] }
GET  /api/reports/profit-loss?from=2026-01-01&to=2026-06-30
GET  /api/reports/trial-balance?from=2026-01-01&to=2026-06-30
POST /api/bookings                { "customerId": 1, "bookingType": "FLIGHT",
                                    "costPrice": 50000, "salePrice": 56500, "supplierId": 1 }
POST /api/bookings/:id/confirm    { "vatPercent": 5, "discount": 0, "dueDate": "2026-06-30" }
POST /api/payments                { "direction": "IN", "customerId": 1, "invoiceId": 3,
                                    "method": "BKASH", "amount": 20000, "paymentDate": "2026-06-10" }
GET  /api/invoices/:id/pdf                                           # branded tax invoice PDF
POST /api/hr/payroll/generate     { "year": 2026, "month": 6 }
GET  /api/hr/payslips/:id/pdf                                        # payslip PDF
```

Every controller carries JSDoc request/response examples — see `backend/src/modules/*/​*.controller.ts`.

## Production build

```bash
cd backend  && npm run build && npm start        # compiles to dist/, serves :4000
cd frontend && npm run build && npm start        # serves static dist/ on $PORT
```

Before going live: set strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` and a real `CORS_ORIGIN` in `backend/.env`, point `VITE_API_URL` (frontend `.env`) at your API origin, and run MySQL with regular backups.

## Railway deployment

Create two Railway services from this repository:

| Service | Root directory | Build command | Start command |
|---|---|---|---|
| Backend API | `backend` | `npm run build` | `npm start` |
| Frontend | `frontend` | `npm ci && npm run build` | `npm start` |

The service-level `railway.json` files in `backend/` and `frontend/` define the same commands plus health checks.

Backend environment variables:

```bash
NODE_ENV=production
CORS_ORIGIN=https://erp.tripflybd.com,https://<frontend-service>.up.railway.app
JWT_ACCESS_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<different-strong-random-secret>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
```

Connect the Railway MySQL database to the backend service. The API accepts Railway's native `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLDATABASE` variables, plus `DATABASE_URL` / `MYSQL_URL` when available. Manual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` still work for non-Railway deployments.

Frontend environment variables:

```bash
VITE_API_URL=https://<backend-service>.up.railway.app
```

Database import order for a new/empty Railway MySQL database:

```bash
mysql "$MYSQL_URL" < database/schema.sql
mysql "$MYSQL_URL" < database/seed.sql
```

The schema script drops and recreates application tables, so run it only on an empty database or during an intentional reset. Add `erp.tripflybd.com` as the frontend service custom domain, then point the DNS record to the Railway target shown in the domain setup screen.

## Repository layout

```
tripfly-erp/
├── database/          schema.sql · seed.sql
├── backend/
│   └── src/
│       ├── config/        env, MySQL pool, transactions
│       ├── middleware/    auth (JWT), rbac, audit, error handler
│       ├── utils/         money (integer-cent math), numbering, system ledgers
│       └── modules/       auth · accounting · reports · inventory · crm
│                          bookings · payments · invoices · hr · dashboard
└── frontend/
    └── src/
        ├── api/           axios client (token refresh, PDF opener)
        ├── components/    UI kit · AppShell (sidebar, topbar, dark mode)
        └── pages/         Dashboard · Accounting · Reports · Inventory · CRM
                           Bookings · Invoices · Payments · HR · Settings
```
