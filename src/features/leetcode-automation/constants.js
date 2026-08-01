/**
 * Shared, dependency-free constants for the LeetCode Streak Automation module.
 * Safe to import from both server and client code.
 */

export const AUTOMATION_TAB = 'automation';

export const AUTOMATION_PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'scheduler', label: 'Scheduler' },
  { id: 'logs', label: 'Submission Logs' },
  { id: 'settings', label: 'Settings' },
];

export const ENGINES = {
  REMINDER: 'reminder',
  PLAYWRIGHT: 'playwright',
};

export const ROTATIONS = ['random', 'sequential', 'specific'];

export const RESULTS = ['success', 'failure', 'reminder', 'skipped'];

export const SESSION_STATUS = {
  CONNECTED: 'connected',
  EXPIRED: 'expired',
  DISCONNECTED: 'disconnected',
};

export const LANGUAGES = [
  'cpp',
  'java',
  'python',
  'python3',
  'javascript',
  'typescript',
  'c',
  'csharp',
  'go',
  'rust',
  'kotlin',
  'swift',
  'ruby',
  'scala',
  'php',
];

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'UNRATED'];

export const NOTIFICATION_CHANNELS = ['email', 'discord', 'telegram', 'slack', 'webhook'];

export const NOTIFICATION_EVENTS = ['success', 'failure', 'sessionExpired', 'automationDisabled'];

export const DEFAULT_PAGE_SIZE = 10;

/** Prominent, reused everywhere automation can be turned on. */
export const TOS_WARNING =
  'Automated submissions may violate LeetCode’s Terms of Service. Only use this with your own account and at your own risk. The safe default engine only sends reminders and never submits on your behalf.';
