import { withAuth, readJson, ok } from '@/features/leetcode-automation/lib/http';
import {
  connectSession,
  disconnectSession,
  getSessionStatus,
} from '@/features/leetcode-automation/services/sessionService';

/** GET /api/session → non-sensitive session status (never the payload). */
export const GET = withAuth(
  async ({ user }) => ok({ session: await getSessionStatus(user.username) }),
  { route: 'session:get', limit: 60 }
);

/**
 * POST /api/session → connect / reconnect. Body: { storageState, userAgent?,
 * accountHint?, expiresAt? }. Encrypted before storage; passwords rejected.
 */
export const POST = withAuth(
  async ({ req, user }) => {
    const body = await readJson(req);
    const session = await connectSession(user.username, body);
    return ok({ session });
  },
  { route: 'session:post', limit: 20 }
);

/** DELETE /api/session → disconnect and wipe the encrypted payload. */
export const DELETE = withAuth(
  async ({ user }) => {
    const session = await disconnectSession(user.username);
    return ok({ session });
  },
  { route: 'session:delete', limit: 20 }
);
