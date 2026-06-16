import { Request } from 'express';
import { exec } from '../config/db';

/** Fire-and-forget audit trail writer. Never blocks or fails a request. */
export async function audit(
  req: Request, action: string, entity: string, entityId?: number | null, details?: unknown
): Promise<void> {
  try {
    await exec(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address) VALUES (?,?,?,?,?,?)',
      [req.user?.sub ?? null, action, entity, entityId ?? null,
       details ? JSON.stringify(details) : null, req.ip ?? null]
    );
  } catch (err) {
    console.error('audit log failed:', err);
  }
}
