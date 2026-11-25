export const tutorialGroups = [
  { id: "overview", lessons: [
    { id: "dashboard", icon: "view-dashboard-outline", source: require("../../../assets/tutorials/dashboard.mp4") },
    { id: "snapshot", icon: "calendar-check-outline", source: require("../../../assets/tutorials/snapshot.mp4") },
  ] },
  { id: "transactions", lessons: [
    { id: "income", icon: "arrow-bottom-left", source: require("../../../assets/tutorials/income.mp4") },
    { id: "expense", icon: "arrow-top-right", source: require("../../../assets/tutorials/expense.mp4") },
    { id: "wallet", icon: "wallet-outline", source: require("../../../assets/tutorials/wallet.mp4") },
  ] },
  { id: "radar", lessons: [
    { id: "radar", icon: "newspaper-variant-outline", source: require("../../../assets/tutorials/radar.mp4") },
  ] },
  { id: "account", lessons: [
    { id: "general", icon: "tune-variant", source: require("../../../assets/tutorials/general.mp4") },
    { id: "notifications", icon: "bell-outline", source: require("../../../assets/tutorials/notifications.mp4") },
    { id: "security", icon: "shield-lock-outline", source: require("../../../assets/tutorials/security.mp4") },
    { id: "data", icon: "database-outline", source: require("../../../assets/tutorials/data.mp4") },
  ] },
] as const;

export type TutorialLesson = typeof tutorialGroups[number]["lessons"][number];
