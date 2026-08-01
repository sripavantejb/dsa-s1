import { withAuth, ok } from '@/features/leetcode-automation/lib/http';
import { clearLogs, listLogs } from '@/features/leetcode-automation/services/logService';

/** GET /api/logs?result=&page=&pageSize= → paginated submission logs. */
export const GET = withAuth(
  async ({ req, user }) => {
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    return ok(await listLogs(user.username, query));
  },
  { route: 'logs:get', limit: 120 }
);

/** DELETE /api/logs → clear all logs for the user. */
export const DELETE = withAuth(
  async ({ user }) => {
    const deleted = await clearLogs(user.username);
    return ok({ ok: true, deleted });
  },
  { route: 'logs:delete', limit: 10 }
);
