export type SnapshotReminderFrequency = "daily" | "weekly" | "monthly";

export type SnapshotReminderScheduleSpec =
  | {
      type: "daily";
      hour: number;
      minute: number;
    }
  | {
      type: "weekly";
      weekday: number;
      hour: number;
      minute: number;
    }
  | {
      type: "monthly";
      day: number;
      hour: number;
      minute: number;
    };

export const DEFAULT_SNAPSHOT_REMINDER_FREQUENCY: SnapshotReminderFrequency = "monthly";
export const SNAPSHOT_REMINDER_HOUR = 20;
export const SNAPSHOT_REMINDER_MINUTE = 0;

export function coerceSnapshotReminderFrequency(
  value: string | null | undefined
): SnapshotReminderFrequency {
  if (value === "daily" || value === "weekly" || value === "monthly") {
    return value;
  }
  return DEFAULT_SNAPSHOT_REMINDER_FREQUENCY;
}

export function buildSnapshotReminderScheduleSpec(
  now: Date,
  frequency: SnapshotReminderFrequency
): SnapshotReminderScheduleSpec {
  if (frequency === "daily") {
    return {
      type: "daily",
      hour: SNAPSHOT_REMINDER_HOUR,
      minute: SNAPSHOT_REMINDER_MINUTE,
    };
  }

  if (frequency === "weekly") {
    return {
      type: "weekly",
      weekday: now.getDay() + 1,
      hour: SNAPSHOT_REMINDER_HOUR,
      minute: SNAPSHOT_REMINDER_MINUTE,
    };
  }

  return {
    type: "monthly",
    day: Math.min(now.getDate(), 28),
    hour: SNAPSHOT_REMINDER_HOUR,
    minute: SNAPSHOT_REMINDER_MINUTE,
  };
}
