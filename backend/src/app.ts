import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './modules/auth/auth.routes';
import accountingRoutes from './modules/accounting/accounting.routes';
import reportsRoutes from './modules/reports/reports.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import crmRoutes from './modules/crm/crm.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import hrRoutes from './modules/hr/hr.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import adminDatabaseRoutes from './modules/adminDatabase/adminDatabase.routes';

export const app = express();

// ------------------------------ security ------------------------------------
app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'tripfly-erp-api' }));

// ------------------------------- modules ------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api', accountingRoutes);            // /api/ledgers, /api/vouchers ...
app.use('/api/reports', reportsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin/database', adminDatabaseRoutes);

// ------------------------------ error pipe ----------------------------------
app.use(notFoundHandler);
app.use(errorHandler);
