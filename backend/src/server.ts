import { app } from './app';
import { env } from './config/env';
import { pool } from './config/db';

async function main() {
  await pool.query('SELECT 1');

  app.listen(env.port, () => {
    console.log(`Trip Fly BD ERP API listening on port ${env.port}`);
  });
}

main().catch((error: any) => {
  console.error('Fatal: could not start server', error);
  console.error('Code:', error?.code);
  console.error('Message:', error?.message);
  console.error('Stack:', error?.stack);
  console.error('Database config:', {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    database: env.db.database,
  });
  process.exit(1);
});
