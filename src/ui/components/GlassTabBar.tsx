import React from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listWallets } from "@/repositories/walletsRepo";
import { useTranslation } from "react-i18next";

const ICONS: Record<string, string> = {
  Dashboard: "view-grid",
  Snapshot: "calendar-month-outline",
  Balance: "swap-vertical",
  Wallet: "wallet-outline",
};

const BAR_HEIGHT = 72;

export default function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps): JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isDark = theme.dark;
  const blurTint = isDark ? "dark" : "light";
  const blurIntensity = 35;
  const barBg = isDark ? "rgba(15, 18, 30, 0.55)" : "rgba(169, 124, 255, 0.32)";
  const borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(169, 124, 255, 0.5)";
  const inactiveColor = isDark ? theme.colors.onSurface : "#4B4B60";

  const tabRoutes = state.routes.filter((route) => route.name !== "Impostazioni");

  return (
    <View style={styles.container} pointerEvents="box-none">
      <BlurView
        intensity={blurIntensity}
        tint={blurTint}
        style={[
          styles.blur,
          {
            backgroundColor: barBg,
            borderColor,
            paddingBottom: insets.bottom + 8,
            minHeight: BAR_HEIGHT + insets.bottom,
          },
        ]}
      >
        <View style={styles.inner}>
          {tabRoutes.map((route) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? options.title ?? route.name;
            const isFocused = state.index === state.routes.findIndex((r) => r.key === route.key);
            const onPress = async () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;

              if (!isFocused && (route.name === "Snapshot" || route.name === "Balance")) {
                try {
                  const wallets = await listWallets();
                  if (wallets.length === 0) {
                    Alert.alert(
                      t("navigation.blockedNoWalletTitle", { defaultValue: "Nessun wallet" }),
                      t("navigation.blockedNoWalletBody", {
                        defaultValue: "Crea prima il tuo primo wallet per iniziare.",
                      }),
                      [
                        { text: t("common.cancel", { defaultValue: "Annulla" }), style: "cancel" },
                        {
                          text: t("navigation.blockedNoWalletCta", { defaultValue: "Vai ai wallet" }),
                          onPress: () => navigation.navigate("Wallet"),
                        },
                      ]
                    );
                    return;
                  }
                } catch {
                  // If check fails, allow navigation to avoid blocking the user.
                }
              }

              if (!isFocused) {
                navigation.navigate(route.name);
              }
            };
            const icon = ICONS[route.name] ?? "circle-outline";

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.tabItem}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={isFocused ? 28 : 24}
                  color={isFocused ? theme.colors.primary : inactiveColor}
                />
                <Text
                  variant="labelSmall"
                  style={[
                    styles.label,
                    { color: isFocused ? theme.colors.primary : inactiveColor },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
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
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  blur: {
    width: "100%",
    minHeight: BAR_HEIGHT,
    overflow: "hidden",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderTopWidth: 1,
  },
  inner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: BAR_HEIGHT,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  label: {
    marginTop: 2,
  },
});
