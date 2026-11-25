import { createRadarLaunchGate } from "@/features/news/radarLaunch";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";

jest.mock("@/repositories/preferencesRepo", () => ({
  getPreference: jest.fn(),
  setPreference: jest.fn(),
}));

it("plays once across a session and skips later sessions on the same local day", async () => {
  let value: string | undefined;
  jest.mocked(getPreference).mockImplementation(async (key) => value ? { key, value } : null);
  jest.mocked(setPreference).mockImplementation(async (_key, day) => { value = day; });
  const today = new Date(2026, 10, 21, 23, 45);
  const tomorrow = new Date(2026, 10, 22, 0, 15);
  const firstSession = createRadarLaunchGate();

  expect(await firstSession(() => false, today)).toBe(false);
  expect(value).toBeUndefined();
  expect(await Promise.all([firstSession(() => true, today), firstSession(() => true, today)])).toEqual([true, false]);
  expect(await createRadarLaunchGate()(() => true, today)).toBe(false);
  expect(await firstSession(() => true, tomorrow)).toBe(false);
  expect(await createRadarLaunchGate()(() => true, tomorrow)).toBe(true);
});
