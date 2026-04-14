import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Localization from "expo-localization";
import {
  buildSnapshotReminderScheduleSpec,
  coerceSnapshotReminderFrequency,
  DEFAULT_SNAPSHOT_REMINDER_FREQUENCY,
  SNAPSHOT_REMINDER_HOUR,
  SNAPSHOT_REMINDER_MINUTE,
  type SnapshotReminderFrequency,
} from "@/domain/snapshotReminder";
import { resolveSupportedLanguage } from "@/i18n";
import { getPreference } from "@/repositories/preferencesRepo";

export const SNAPSHOT_REMINDER_ENABLED_KEY = "snapshot_reminder_enabled";
export const SNAPSHOT_REMINDER_FREQUENCY_KEY = "snapshot_reminder_frequency";

const SNAPSHOT_REMINDER_CHANNEL_ID = "snapshot-reminders";
const SNAPSHOT_REMINDER_KIND = "snapshot-reminder";
const REMINDER_COPY = {
  it: {
    title: "Promemoria snapshot",
    body: "Aggiungi lo snapshot di oggi per tenere aggiornata la dashboard.",
  },
  en: {
    title: "Snapshot reminder",
    body: "Add today's snapshot to keep your dashboard up to date.",
  },
  pt: {
    title: "Lembrete de snapshot",
    body: "Adiciona o snapshot de hoje para manter o dashboard atualizado.",
  },
} as const;

type SnapshotReminderSettings = {
  enabled: boolean;
  frequency: SnapshotReminderFrequency;
};

export async function getSnapshotReminderSettings(): Promise<SnapshotReminderSettings> {
  const [enabledPref, frequencyPref] = await Promise.all([
    getPreference(SNAPSHOT_REMINDER_ENABLED_KEY),
    getPreference(SNAPSHOT_REMINDER_FREQUENCY_KEY),
  ]);

  return {
    enabled: enabledPref?.value === "true",
    frequency: coerceSnapshotReminderFrequency(frequencyPref?.value),
  };
}

export async function requestSnapshotReminderPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
  await ensureSnapshotReminderChannel();
  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
}

export async function syncSnapshotReminderSchedule(
  overrides?: Partial<SnapshotReminderSettings>
): Promise<void> {
  const current = await getSnapshotReminderSettings();
  const settings: SnapshotReminderSettings = {
    enabled: overrides?.enabled ?? current.enabled,
    frequency: overrides?.frequency ?? current.frequency ?? DEFAULT_SNAPSHOT_REMINDER_FREQUENCY,
  };

  await ensureSnapshotReminderChannel();
  await cancelSnapshotReminderSchedule();

  if (!settings.enabled) {
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    return;
  }

  const schedule = buildSnapshotReminderScheduleSpec(new Date(), settings.frequency);
  const trigger =
    schedule.type === "daily"
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: schedule.hour,
          minute: schedule.minute,
          channelId: SNAPSHOT_REMINDER_CHANNEL_ID,
        }
      : schedule.type === "weekly"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: schedule.weekday,
            hour: schedule.hour,
            minute: schedule.minute,
            channelId: SNAPSHOT_REMINDER_CHANNEL_ID,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
            day: schedule.day,
            hour: schedule.hour,
            minute: schedule.minute,
            channelId: SNAPSHOT_REMINDER_CHANNEL_ID,
          };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: getReminderCopy().title,
      body: getReminderCopy().body,
      sound: true,
      data: {
        kind: SNAPSHOT_REMINDER_KIND,
        frequency: settings.frequency,
      },
    },
    trigger,
  });
}

export async function cancelSnapshotReminderSchedule(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const matches = scheduled.filter(
    (notification) => notification.content.data?.kind === SNAPSHOT_REMINDER_KIND
  );

  await Promise.all(
    matches.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
  );
}

export function getSnapshotReminderSummary(frequency: SnapshotReminderFrequency): string {
  if (frequency === "daily") {
    return `Every day at ${formatReminderTime()}`;
  }
  if (frequency === "weekly") {
    return `Every week at ${formatReminderTime()}`;
  }
  return `Every month at ${formatReminderTime()}`;
}

async function ensureSnapshotReminderChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(SNAPSHOT_REMINDER_CHANNEL_ID, {
    name: "Snapshot reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

function formatReminderTime(): string {
  return `${String(SNAPSHOT_REMINDER_HOUR).padStart(2, "0")}:${String(SNAPSHOT_REMINDER_MINUTE).padStart(2, "0")}`;
}

function getReminderCopy() {
  const locale = resolveSupportedLanguage(Localization.getLocales()[0]?.languageTag);
  return REMINDER_COPY[locale];
}
