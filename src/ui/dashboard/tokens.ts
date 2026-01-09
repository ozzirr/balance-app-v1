export type DashboardTokens = {
  colors: {
    bg: string;
    surface: string;
    surface2: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    green: string;
    red: string;
    yellow: string;
    blue: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  typography: {
    title: number;
    kpi: number;
    body: number;
    label: number;
  };
};

const baseTokens = {
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 16,
    md: 20,
    lg: 24,
  },
  typography: {
    title: 18,
    kpi: 24,
    body: 13,
    label: 12,
  },
};

export function createDashboardTokens(isDark: boolean): DashboardTokens {
  return {
    colors: isDark
      ? {
          bg: "#0A0C11",
          surface: "#141923",
          surface2: "#1A2230",
          border: "rgba(255,255,255,0.1)",
          text: "#EAF0F9",
          muted: "#9BA6B5",
          accent: "#A97CFF",
          green: "#66D19E",
          red: "#F08C7A",
          yellow: "#F6C177",
          blue: "#6BA3FF",
        }
      : {
          bg: "#F5F7FB",
          surface: "#FFFFFF",
          surface2: "#EEF2F7",
          border: "rgba(16,24,40,0.08)",
          text: "#101522",
          muted: "#5E6B7A",
          accent: "#2A7DE1",
          green: "#1E9D66",
          red: "#E15A4F",
          yellow: "#E0A12F",
          blue: "#2A7DE1",
        },
    ...baseTokens,
  };
}

export const dashboardShadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};
