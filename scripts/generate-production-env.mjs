import crypto from 'node:crypto';

const secret = () => crypto.randomBytes(48).toString('base64url');

console.log(`NODE_ENV=production
CORS_ORIGIN=https://erp.tripflybd.com,https://<frontend-service>.up.railway.app
JWT_ACCESS_SECRET=${secret()}
JWT_REFRESH_SECRET=${secret()}
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
VITE_API_URL=https://<backend-service>.up.railway.app`);
