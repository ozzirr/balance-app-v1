import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import GlassSurface from "@/ui/components/GlassSurface";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listWallets } from "@/repositories/walletsRepo";
import LimitReachedModal from "@/ui/components/LimitReachedModal";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const ICONS: Record<string, IconName> = {
  Dashboard: "view-grid",
  Snapshot: "calendar-month-outline",
  Balance: "swap-vertical",
  Wallet: "wallet-outline",
  Impostazioni: "cog-outline",
};

const BAR_HEIGHT = 72;

export default function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps): JSX.Element {
  const theme = useTheme();
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [blockedModalVisible, setBlockedModalVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  const blockedTitle = t("navigation.blockedNoWalletTitle", { defaultValue: "Nessun wallet" });
  const blockedBody = t("navigation.blockedNoWalletBody", {
    defaultValue: "Crea prima il tuo primo wallet per iniziare.",
  });
  const blockedCta = t("navigation.blockedNoWalletCta", { defaultValue: "Vai ai wallet" });
  const handleCloseBlockedModal = useCallback(() => {
    setBlockedModalVisible(false);
  }, []);
  const handleUpgradeBlockedModal = useCallback(() => {
    setBlockedModalVisible(false);
    navigation.navigate("Wallet");
  }, [navigation]);
  const isDark = theme.dark;
  const blurTint = isDark ? "dark" : "light";
  const blurIntensity = 35;
  const barBg = isDark ? "rgba(28, 27, 43, 0.96)" : "rgba(255, 255, 255, 0.96)";
  const borderColor =
    Platform.OS === "android" ? tokens.colors.border : isDark ? "rgba(255,255,255,0.14)" : "rgba(55,40,80,0.12)";
  const inactiveColor = tokens.colors.muted;
  const tabRoutes = state.routes.filter((route) => route.name !== "Impostazioni");
  const focusedIndex = tabRoutes.findIndex((route) => route.key === state.routes[state.index].key);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const initializedIndicator = useRef(false);
  useEffect(() => {
    if (!barWidth || focusedIndex < 0) return;
    const destination = (barWidth / tabRoutes.length) * focusedIndex;
    indicatorPosition.stopAnimation();
    if (!initializedIndicator.current || reduceMotion) {
      indicatorPosition.setValue(destination);
      initializedIndicator.current = true;
      return;
    }
    const animation = Animated.timing(indicatorPosition, { toValue: destination, duration: 300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [barWidth, focusedIndex, indicatorPosition, reduceMotion, tabRoutes.length]);
  return (
    <>
      <View style={[styles.container, { bottom: Math.max(12, insets.bottom) }]} pointerEvents="box-none">
        <GlassSurface
          intensity={blurIntensity}
          tint={blurTint}
          backgroundColor={barBg}
          borderColor={borderColor}
          radius={24}
          style={[
            styles.blur,
            {
              minHeight: BAR_HEIGHT,
            },
          ]}
        >
          <View
            style={[
              styles.barContent,
              {
                minHeight: BAR_HEIGHT,
              },
            ]}
          >
            <View style={styles.inner} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
              {barWidth > 0 && focusedIndex >= 0 ? <Animated.View pointerEvents="none" style={[styles.movingIndicator, { width: barWidth / tabRoutes.length, transform: [{ translateX: indicatorPosition }] }]}><View style={[styles.indicatorPill, { backgroundColor: isDark ? "rgba(185,152,255,0.22)" : "rgba(118,80,214,0.16)" }]} /></Animated.View> : null}
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
                        setBlockedModalVisible(true);
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
                const icon: IconName = ICONS[route.name] ?? "circle-outline";

                return (
                  <Pressable
                    key={route.key}
                    onPress={onPress}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isFocused }}
                    accessibilityLabel={String(label)}
                    style={styles.tabItem}
                  >
                    <View style={styles.iconWrap}><MaterialCommunityIcons name={icon} size={23} color={isFocused ? tokens.colors.accent : inactiveColor} /></View>
                    <Text
                      variant="labelSmall"
                      style={[
                        styles.label,
                        { color: isFocused ? tokens.colors.accent : inactiveColor },
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
          </View>
        </GlassSurface>
      </View>
      <LimitReachedModal
        visible={blockedModalVisible}
        onClose={handleCloseBlockedModal}
        onUpgrade={handleUpgradeBlockedModal}
        title={blockedTitle}
        subtitle={blockedBody}
        ctaLabel={blockedCta}
        benefits={[]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
  },
  blur: {
    width: "100%",
    minHeight: BAR_HEIGHT,
    overflow: "hidden",
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  barContent: {
    justifyContent: "center",
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
  iconWrap: { width: 48, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  movingIndicator: { position: "absolute", top: 6, left: 0, alignItems: "center" },
  indicatorPill: { width: "92%", maxWidth: 120, height: 60, borderRadius: 18 },
  label: {
    marginTop: 2,
  },
});
