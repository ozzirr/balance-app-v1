import { getPreference, setPreference } from "@/repositories/preferencesRepo";

const LAST_LAUNCH_KEY = "news.lastRadarLaunchDay";

export function createRadarLaunchGate() {
  let shownThisSession = false;

  return async function shouldShowRadarLaunch(isActive: () => boolean, now = new Date()) {
    if (shownThisSession) return false;
    const localDay = [now.getFullYear(), now.getMonth() + 1, now.getDate()].join("-");
    const lastLaunch = await getPreference(LAST_LAUNCH_KEY).catch(() => null);
    if (shownThisSession || !isActive() || lastLaunch?.value === localDay) return false;

    shownThisSession = true;
    void setPreference(LAST_LAUNCH_KEY, localDay).catch(() => {});
    return true;
  };
}

export const shouldShowRadarLaunch = createRadarLaunchGate();
