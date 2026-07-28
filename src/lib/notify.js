import Notification from './models/Notification.js';
import User from './models/User.js';

/** Notify the other partner (tej ↔ hafsa). */
export async function notifyPartner(actor, { type, title, body, linkTab = 'live' }) {
  const others = await User.find({ username: { $ne: actor.username } })
    .select('username')
    .lean();

  if (!others.length) return;

  await Notification.insertMany(
    others.map((u) => ({
      toUsername: u.username,
      fromUsername: actor.username,
      fromDisplayName: actor.displayName,
      type,
      title,
      body,
      linkTab,
      read: false,
    }))
  );
}
