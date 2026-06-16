import { app } from './app';
import { env } from './config/env';
import { pool } from './config/db';

async function main() {
  // Fail fast if the database is unreachable.
  await pool.query('SELECT 1');
  app.listen(env.port, () => {
    console.log(`✈  Trip Fly BD ERP API listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal: could not start server —', err.message);
  process.exit(1);
});
