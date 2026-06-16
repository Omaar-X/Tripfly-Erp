import { app } from './app';
import { env } from './config/env';
import { pool } from './config/db';

async function main() {
  await pool.query('SELECT 1').catch((err: any) => {
    console.error('Database connection failed');
    console.error('Code:', err.code);
    console.error('Message:', err.message);
    console.error('Host:', process.env.DB_HOST);
    console.error('Port:', process.env.DB_PORT);
    console.error('User:', process.env.DB_USER);
    console.error('Database:', process.env.DB_NAME);
    process.exit(1);
  });

  app.listen(env.port, () => {
    console.log(`Trip Fly BD ERP API listening on port ${env.port}`);
  });
}

main().catch((err: any) => {
  console.error('Fatal: could not start server');
  console.error('Code:', err.code);
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});