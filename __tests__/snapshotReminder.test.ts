import {
  buildSnapshotReminderScheduleSpec,
  coerceSnapshotReminderFrequency,
  DEFAULT_SNAPSHOT_REMINDER_FREQUENCY,
} from "@/domain/snapshotReminder";

describe("snapshot reminder scheduling", () => {
  test("falls back to the default frequency for unknown values", () => {
    expect(coerceSnapshotReminderFrequency("yearly")).toBe(DEFAULT_SNAPSHOT_REMINDER_FREQUENCY);
    expect(coerceSnapshotReminderFrequency(null)).toBe(DEFAULT_SNAPSHOT_REMINDER_FREQUENCY);
  });

  test("builds a daily schedule at the default reminder time", () => {
    expect(buildSnapshotReminderScheduleSpec(new Date("2026-04-14T09:30:00"), "daily")).toEqual({
      type: "daily",
      hour: 20,
      minute: 0,
    });
  });

  test("builds a weekly schedule anchored to the current weekday", () => {
    expect(buildSnapshotReminderScheduleSpec(new Date("2026-04-14T09:30:00"), "weekly")).toEqual({
      type: "weekly",
      weekday: 3,
      hour: 20,
      minute: 0,
    });
  });

  test("caps the monthly schedule day to 28 to avoid skipped months", () => {
    expect(buildSnapshotReminderScheduleSpec(new Date("2026-01-31T09:30:00"), "monthly")).toEqual({
      type: "monthly",
      day: 28,
      hour: 20,
      minute: 0,
    });
  });
});
