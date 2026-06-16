import dotenv from 'dotenv';
dotenv.config();

const required = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${key}`);
  return v;
};

export const env = {
  port: Number(required('PORT', '4000')),
  nodeEnv: required('NODE_ENV', 'development'),
  corsOrigin: required('CORS_ORIGIN', 'http://localhost:5173'),
  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(required('DB_PORT', '3306')),
    user: required('DB_USER', 'root'),
    password: required('DB_PASSWORD', ''),
    database: required('DB_NAME', 'tripfly_erp')
  },
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_in_production_!!'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_in_production_!'),
    accessTtl: required('ACCESS_TOKEN_TTL', '15m'),
    refreshTtlDays: Number(required('REFRESH_TOKEN_TTL_DAYS', '7'))
  }
};
