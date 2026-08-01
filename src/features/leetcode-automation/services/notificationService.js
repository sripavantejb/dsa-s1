import Notification from '@/lib/models/Notification.js';
import { AUTOMATION_TAB } from '../constants.js';

/**
 * Fan-out notifications for automation events. Writes an in-app alert (reusing
 * the existing Notification collection so it appears in the Alerts panel) and
 * dispatches any enabled external channels. All channel sends are best-effort:
 * a failing webhook never breaks a run.
 *
 * @param {{ username: string, displayName?: string }} user
 * @param {object} settings serialized AutomationSettings
 * @param {{ event: string, title: string, body: string }} payload
 */
export async function notifyAutomation(user, settings, { event, title, body }) {
  const events = settings?.notifications?.events || {};
  // If the event is toggled off, skip everything.
  if (event in events && events[event] === false) return;

  await writeInApp(user, title, body);
  await dispatchChannels(settings, { title, body });
}

async function writeInApp(user, title, body) {
  try {
    await Notification.create({
      toUsername: user.username,
      fromUsername: user.username,
      fromDisplayName: user.displayName || user.username,
      type: 'automation',
      title,
      body,
      linkTab: AUTOMATION_TAB,
      read: false,
    });
  } catch (err) {
    console.error('[leetcode-automation] in-app notify failed', err);
  }
}

async function dispatchChannels(settings, { title, body }) {
  const n = settings?.notifications || {};
  const jobs = [];

  if (n.discord?.enabled && n.discord.target) jobs.push(sendDiscord(n.discord.target, title, body));
  if (n.slack?.enabled && n.slack.target) jobs.push(sendSlack(n.slack.target, title, body));
  if (n.telegram?.enabled && n.telegram.target) jobs.push(sendTelegram(n.telegram.target, title, body));
  if (n.webhook?.enabled && n.webhook.target) jobs.push(sendWebhook(n.webhook.target, title, body));
  if (n.email?.enabled && n.email.target) jobs.push(sendEmail(n.email.target, title, body));

  await Promise.allSettled(jobs);
}

async function post(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function sendDiscord(webhookUrl, title, body) {
  return post(webhookUrl, { content: `**${title}**\n${body}` }).catch((e) =>
    console.error('[notify:discord]', e)
  );
}

function sendSlack(webhookUrl, title, body) {
  return post(webhookUrl, { text: `*${title}*\n${body}` }).catch((e) =>
    console.error('[notify:slack]', e)
  );
}

/** target format: "<botToken>:<chatId>" */
function sendTelegram(target, title, body) {
  const [token, chatId] = String(target).split(':chat:');
  if (!token || !chatId) {
    // Fall back to "token|chatId" style.
    const [t2, c2] = String(target).split('|');
    if (!t2 || !c2) return Promise.resolve();
    return post(`https://api.telegram.org/bot${t2}/sendMessage`, {
      chat_id: c2,
      text: `${title}\n${body}`,
    }).catch((e) => console.error('[notify:telegram]', e));
  }
  return post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text: `${title}\n${body}`,
  }).catch((e) => console.error('[notify:telegram]', e));
}

function sendWebhook(url, title, body) {
  return post(url, { title, body, source: 'leetcode-automation', at: new Date().toISOString() }).catch(
    (e) => console.error('[notify:webhook]', e)
  );
}

/** Uses Resend's HTTP API when RESEND_API_KEY is set; otherwise no-ops. */
function sendEmail(to, title, body) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTOMATION_EMAIL_FROM || 'onboarding@resend.dev';
  if (!key) return Promise.resolve();
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to, subject: title, text: body }),
  }).catch((e) => console.error('[notify:email]', e));
}
