export const SWIPEABLE_TAB_ROUTES = [
  "Impostazioni",
  "Dashboard",
  "Snapshot",
  "Balance",
  "Wallet",
  "News",
] as const;

export type TabRoute = (typeof SWIPEABLE_TAB_ROUTES)[number];
export type SwipeDirection = "left" | "right";

export function getAdjacentTabRoute(
  currentRoute: TabRoute,
  direction: SwipeDirection
): TabRoute | null {
  if (currentRoute === "News") return null;
  const currentIndex = SWIPEABLE_TAB_ROUTES.indexOf(currentRoute);
  const nextIndex = direction === "left" ? currentIndex + 1 : currentIndex - 1;
  return SWIPEABLE_TAB_ROUTES[nextIndex] ?? null;
}
