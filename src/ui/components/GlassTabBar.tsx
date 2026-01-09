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
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={35} tint="dark" style={[styles.bar, { borderColor: theme.colors.outline, paddingBottom: Math.max(8, insets.bottom) }]}>
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
                  color={isFocused ? theme.colors.primary : theme.colors.onSurface}
                />
                <Text
                  variant="labelSmall"
                  style={{ color: isFocused ? theme.colors.primary : theme.colors.onSurface }}
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
    bottom: 0,
    alignItems: "center",
  },
  bar: {
    borderRadius: 0,
    borderWidth: 0,
    paddingTop: 8,
    paddingHorizontal: 16,
    width: "100%",
    overflow: "hidden",
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
