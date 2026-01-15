import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ICONS: Record<string, string> = {
  Dashboard: "view-grid",
  Snapshot: "calendar-month-outline",
  "Entrate/Uscite": "swap-vertical",
  Impostazioni: "cog-outline",
};

export default function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps): JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.dark;
  const blurTint = isDark ? "dark" : "light";
  const blurIntensity = isDark ? 40 : 60;
  const barBg = isDark ? "rgba(10, 11, 18, 0.92)" : "rgba(255, 255, 255, 0.92)";
  const borderColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(30, 40, 60, 0.12)";
  const inactiveColor = isDark ? theme.colors.onSurface : "#1E2430";
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <BlurView
        intensity={blurIntensity}
        tint={blurTint}
        style={[
          styles.bar,
          {
            borderColor,
            backgroundColor: barBg,
            paddingBottom: Math.max(12, insets.bottom + 6),
          },
        ]}
      >
        <View style={styles.row}>
          {state.routes
            .filter((route) => route.name !== "Profilo")
            .map((route) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? options.title ?? route.name;
            const isFocused = state.index === state.routes.findIndex((r) => r.key === route.key);
            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const icon = ICONS[route.name] ?? "circle-outline";

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={[styles.item, isFocused && styles.itemActive]}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={isFocused ? 24 : 22}
                  color={isFocused ? theme.colors.primary : inactiveColor}
                />
                <Text
                  variant="labelSmall"
                  style={{ color: isFocused ? theme.colors.primary : inactiveColor }}
                >
                  {String(label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  bar: {
    borderRadius: 40,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    width: "92%",
    maxWidth: 520,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    minWidth: 70,
  },
  itemActive: {
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
});
