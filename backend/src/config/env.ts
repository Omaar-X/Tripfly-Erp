import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const isProduction = process.env.NODE_ENV === 'production';

const required = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${key}`);
  return v;
};

const requiredInProduction = (key: string, fallback?: string): string =>
  required(key, isProduction ? undefined : fallback);

const first = (...values: Array<string | undefined>): string | undefined =>
  values.find((value) => value !== undefined && value !== '');

const databaseUrl = first(process.env.DATABASE_URL, process.env.MYSQL_URL);
const databaseUrlConfig = databaseUrl ? new URL(databaseUrl) : undefined;

const fromDatabaseUrl = (field: 'host' | 'port' | 'user' | 'password' | 'database'): string | undefined => {
  if (!databaseUrlConfig) return undefined;
  if (field === 'host') return databaseUrlConfig.hostname;
  if (field === 'port') return databaseUrlConfig.port;
  if (field === 'user') return decodeURIComponent(databaseUrlConfig.username);
  if (field === 'password') return decodeURIComponent(databaseUrlConfig.password);
  return databaseUrlConfig.pathname.replace(/^\//, '') || undefined;
};

const dbConfig = (
  keys: string[],
  value: string | undefined,
  developmentFallback?: string
): string => {
  const resolved = value ?? (isProduction ? undefined : developmentFallback);
  if (resolved === undefined) {
    throw new Error(`Missing DB config: set ${keys.join(' or ')}`);
  }
  return resolved;
};

export const env = {
  port: Number(required('PORT', '4000')),
  nodeEnv: required('NODE_ENV', 'development'),
  corsOrigins: requiredInProduction('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    host: dbConfig(['DB_HOST', 'MYSQLHOST', 'DATABASE_URL', 'MYSQL_URL'], first(process.env.DB_HOST, process.env.MYSQLHOST, fromDatabaseUrl('host')), 'localhost'),
    port: Number(first(process.env.DB_PORT, process.env.MYSQLPORT, fromDatabaseUrl('port')) ?? '3306'),
    user: dbConfig(['DB_USER', 'MYSQLUSER', 'DATABASE_URL', 'MYSQL_URL'], first(process.env.DB_USER, process.env.MYSQLUSER, fromDatabaseUrl('user')), 'root'),
    password: dbConfig(['DB_PASSWORD', 'MYSQLPASSWORD', 'DATABASE_URL', 'MYSQL_URL'], first(process.env.DB_PASSWORD, process.env.MYSQLPASSWORD, fromDatabaseUrl('password')), ''),
    database: dbConfig(['DB_NAME', 'MYSQLDATABASE', 'MYSQL_DATABASE', 'DATABASE_URL', 'MYSQL_URL'], first(process.env.DB_NAME, process.env.MYSQLDATABASE, process.env.MYSQL_DATABASE, fromDatabaseUrl('database')), 'tripfly_erp'),
  },
  jwt: {
    accessSecret: requiredInProduction('JWT_ACCESS_SECRET', 'dev_access_secret_change_in_production_!!'),
    refreshSecret: requiredInProduction('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_in_production_!'),
    accessTtl: required('ACCESS_TOKEN_TTL', '15m'),
    refreshTtlDays: Number(required('REFRESH_TOKEN_TTL_DAYS', '7')),
  },
};
