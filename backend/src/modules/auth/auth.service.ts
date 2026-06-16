import bcrypt from 'bcryptjs';
import { query, exec, Row } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../../utils/jwt';

interface UserRow extends Row {
  id: number; company_id: number; name: string; email: string;
  password_hash: string; is_active: number; role: string;
}

const findByEmail = async (email: string): Promise<UserRow | undefined> => {
  const rows = await query<UserRow[]>(
    `SELECT u.id, u.company_id, u.name, u.email, u.password_hash, u.is_active, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?`, [email]);
  return rows[0];
};

const issueTokens = async (user: UserRow) => {
  const accessToken = signAccessToken({
    sub: user.id, companyId: user.company_id, role: user.role, name: user.name
  });
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();
  await exec('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)',
    [user.id, hash, expiresAt]);
  return {
    accessToken, refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.company_id }
  };
};

export const authService = {
  async login(email: string, password: string) {
    const user = await findByEmail(email);
    if (!user || !user.is_active) throw ApiError.unauthorized('Invalid email or password');
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw ApiError.unauthorized('Invalid email or password');
    return issueTokens(user);
  },

  /** ADMIN-only user creation. */
  async register(companyId: number, input: { name: string; email: string; password: string; role: string }) {
    const existing = await findByEmail(input.email);
    if (existing) throw ApiError.conflict('Email already registered');
    const roleRows = await query<Row[]>('SELECT id FROM roles WHERE name = ?', [input.role]);
    if (!roleRows[0]) throw ApiError.badRequest(`Unknown role: ${input.role}`);
    const hash = await bcrypt.hash(input.password, 10);
    const result = await exec(
      'INSERT INTO users (company_id, role_id, name, email, password_hash) VALUES (?,?,?,?,?)',
      [companyId, roleRows[0].id, input.name, input.email, hash]);
    return { id: result.insertId, name: input.name, email: input.email, role: input.role };
  },

  /** Refresh-token rotation: old token is revoked, a new pair is issued. */
  async refresh(refreshToken: string) {
    const hash = hashRefreshToken(refreshToken);
    const rows = await query<Row[]>(
      `SELECT rt.id, rt.user_id FROM refresh_tokens rt
        WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`, [hash]);
    const stored = rows[0];
    if (!stored) throw ApiError.unauthorized('Refresh token invalid or expired');
    await exec('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [stored.id]);
    const userRows = await query<UserRow[]>(
      `SELECT u.id, u.company_id, u.name, u.email, u.password_hash, u.is_active, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, [stored.user_id]);
    if (!userRows[0] || !userRows[0].is_active) throw ApiError.unauthorized('User disabled');
    return issueTokens(userRows[0]);
  },

  async logout(refreshToken: string) {
    await exec('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?',
      [hashRefreshToken(refreshToken)]);
  },

  async listUsers(companyId: number) {
    return query<Row[]>(
      `SELECT u.id, u.name, u.email, u.is_active, r.name AS role, u.created_at
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.company_id = ? ORDER BY u.id`, [companyId]);
  }
};
