import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { audit } from '../../middleware/audit';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const registerSchema = z.object({
  name: z.string().min(2), email: z.string().email(), password: z.string().min(6),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'SALES', 'MANAGER'])
});

/**
 * POST /api/auth/login
 * Request : { "email": "admin@tripflybd.com", "password": "admin123" }
 * Response: { success, data: { accessToken, refreshToken, user } }
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);
  const data = await authService.login(body.email, body.password);
  await audit(req, 'LOGIN', 'users', data.user.id);
  res.json({ success: true, data });
});

/**
 * POST /api/auth/register  (ADMIN only)
 * Request : { "name": "New User", "email": "x@y.com", "password": "secret1", "role": "SALES" }
 * Response: { success, data: { id, name, email, role } }
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body);
  const data = await authService.register(req.user!.companyId, body);
  await audit(req, 'USER_CREATE', 'users', data.id, { email: data.email, role: data.role });
  res.status(201).json({ success: true, data });
});

/** POST /api/auth/refresh — { "refreshToken": "..." } → new token pair (rotation) */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
  res.json({ success: true, data: await authService.refresh(refreshToken) });
});

/** POST /api/auth/logout — revokes the refresh token */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
  await authService.logout(refreshToken);
  res.json({ success: true, message: 'Logged out' });
});

/** GET /api/auth/users (ADMIN) — list company users */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await authService.listUsers(req.user!.companyId) });
});

/** GET /api/auth/me */
export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: req.user });
});
