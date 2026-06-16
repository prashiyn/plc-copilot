export interface ProfileSettings {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  jobTitle: string;
  bio: string;
  location: string;
  timezone: string;
  website: string;
  avatarUrl: string;
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  defaultPlatform: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  autoSave: boolean;
  codeHighlighting: boolean;
  lineNumbers: boolean;
}

export interface NotificationChannelPrefs {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export type NotificationSettings = Record<string, NotificationChannelPrefs>;

export interface UserSettingsDocument {
  profile?: Partial<ProfileSettings>;
  app?: Partial<AppPreferences>;
  notifications?: NotificationSettings;
}

export const DEFAULT_PROFILE: ProfileSettings = {
  firstName: '',
  lastName: '',
  phone: '',
  company: '',
  jobTitle: '',
  bio: '',
  location: '',
  timezone: 'America/New_York',
  website: '',
  avatarUrl: '',
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  theme: 'light',
  language: 'en',
  defaultPlatform: 'schneider',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  autoSave: true,
  codeHighlighting: true,
  lineNumbers: true,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  programGenerated: { email: true, push: true, sms: false },
  programFailed: { email: true, push: true, sms: true },
  teamInvite: { email: true, push: false, sms: false },
  billingIssue: { email: true, push: true, sms: true },
  usageAlert: { email: true, push: false, sms: false },
  weeklyReport: { email: true, push: false, sms: false },
  productUpdates: { email: true, push: false, sms: false },
  securityAlerts: { email: true, push: true, sms: true },
};

export function splitFullName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function mergeProfile(
  email: string,
  fullName: string | null | undefined,
  stored: UserSettingsDocument | null | undefined,
): ProfileSettings & { email: string } {
  const fromName = splitFullName(fullName);
  const profile = stored?.profile ?? {};
  return {
    email,
    firstName: profile.firstName ?? fromName.firstName,
    lastName: profile.lastName ?? fromName.lastName,
    phone: profile.phone ?? '',
    company: profile.company ?? '',
    jobTitle: profile.jobTitle ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    timezone: profile.timezone ?? DEFAULT_PROFILE.timezone,
    website: profile.website ?? '',
    avatarUrl: profile.avatarUrl ?? '',
  };
}

export function mergeAppPreferences(stored: UserSettingsDocument | null | undefined): AppPreferences {
  return { ...DEFAULT_APP_PREFERENCES, ...(stored?.app ?? {}) };
}

export function mergeNotificationSettings(stored: UserSettingsDocument | null | undefined): NotificationSettings {
  const merged: NotificationSettings = {};
  for (const [key, defaults] of Object.entries(DEFAULT_NOTIFICATION_SETTINGS)) {
    merged[key] = { ...defaults, ...(stored?.notifications?.[key] ?? {}) };
  }
  return merged;
}

export function parseUserSettings(raw: unknown): UserSettingsDocument {
  if (!raw || typeof raw !== 'object') return {};
  return raw as UserSettingsDocument;
}
