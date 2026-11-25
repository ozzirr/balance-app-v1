import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  routeName: string;
  onOpenDashboard: () => void;
  onOpenNews: () => void;
  onOpenSettings: () => void;
  embedded?: boolean;
};

export default function AppHeader({
  routeName,
  onOpenDashboard,
  onOpenNews,
  onOpenSettings,
  embedded = false,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const newsActive = routeName === "News";
  const settingsActive = routeName === "Impostazioni";

  return (
    <View
      style={[
        styles.container,
        embedded
          ? styles.embedded
          : { paddingTop: insets.top + 8, backgroundColor: tokens.colors.bg },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Balance"
        disabled={routeName === "Dashboard"}
        onPress={onOpenDashboard}
        style={({ pressed }) => [styles.brand, pressed && routeName !== "Dashboard" ? styles.pressed : null]}
      >
        <Image accessible={false} source={require("../../../assets/icon.png")} style={styles.logo} />
        <Text style={[styles.title, { color: tokens.colors.text }]}>Balance</Text>
      </Pressable>

      <View style={styles.actions}>
        <HeaderButton
          icon="creation"
          color="#C6A4FF"
          active={newsActive}
          label={t(newsActive ? "navigation.closeRadar" : "news.briefing")}
          onPress={newsActive ? onOpenDashboard : onOpenNews}
        />
        <HeaderButton
          icon="account-outline"
          color={tokens.colors.text}
          active={settingsActive}
          label={t(settingsActive ? "navigation.closeSettings" : "settings.title")}
          onPress={settingsActive ? onOpenDashboard : onOpenSettings}
        />
      </View>
    </View>
  );
}

function HeaderButton({
  icon,
  color,
  active,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  color: string;
  active: boolean;
  label: string;
  onPress: () => void;
}): JSX.Element {
  const { tokens } = useDashboardTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: active ? `${tokens.colors.accent}24` : tokens.colors.glassBg,
          borderColor: active ? `${tokens.colors.accent}55` : tokens.colors.glassBorder,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={23} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 74,
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  embedded: { minHeight: 54, paddingHorizontal: 0, paddingBottom: 0 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 42, height: 42, borderRadius: 12 },
  title: { fontSize: 29, fontWeight: "800", letterSpacing: -1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  action: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
});
