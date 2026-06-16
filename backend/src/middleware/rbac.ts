import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export type RoleName = 'ADMIN' | 'ACCOUNTANT' | 'SALES' | 'MANAGER';

/**
 * Role-based access control. ADMIN always passes.
 * Usage: router.post('/vouchers', authenticate, allow('ACCOUNTANT'), handler)
 */
export const allow = (...roles: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.user?.role as RoleName | undefined;
    if (!role) return next(ApiError.unauthorized());
    if (role === 'ADMIN' || roles.includes(role)) return next();
    next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
  };
