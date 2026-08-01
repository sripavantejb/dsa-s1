import { withAuth, readJson, ok } from '@/features/leetcode-automation/lib/http';
import {
  getSettingsDoc,
  serializeSettings,
  updateSettings,
} from '@/features/leetcode-automation/services/settingsService';

/** GET /api/scheduler → current automation settings. */
export const GET = withAuth(
  async ({ user }) => {
    const doc = await getSettingsDoc(user.username);
    return ok({ settings: serializeSettings(doc) });
  },
  { route: 'scheduler:get', limit: 60 }
);

/** PUT /api/scheduler → validate and persist a settings patch. */
export const PUT = withAuth(
  async ({ req, user }) => {
    const body = await readJson(req);
    const doc = await updateSettings(user.username, body);
    return ok({ settings: serializeSettings(doc) });
  },
  { route: 'scheduler:put', limit: 40 }
);
