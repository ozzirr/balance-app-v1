import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const hidden = state.routes[state.index].name === "News";
  const [showBar, setShowBar] = useState(!hidden);
  const visibility = useRef(new Animated.Value(hidden ? 0 : 1)).current;
  useLayoutEffect(() => {
    visibility.stopAnimation();
    if (reduceMotion) {
      visibility.setValue(hidden ? 0 : 1);
      setShowBar(!hidden);
      return;
    }
    if (!hidden) setShowBar(true);
    const animation = Animated.timing(visibility, {
      toValue: hidden ? 0 : 1, duration: hidden ? 180 : 240,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished && hidden) setShowBar(false); });
    return () => animation.stop();
  }, [hidden, reduceMotion, visibility]);
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
  const barBg = Platform.OS === "android"
    ? tokens.colors.surface
    : isDark
      ? "rgba(15, 18, 30, 0.55)"
      : "rgba(169, 124, 255, 0.32)";
  const borderColor =
    Platform.OS === "android" ? tokens.colors.border : isDark ? "rgba(255,255,255,0.14)" : "rgba(55,40,80,0.12)";
  const inactiveColor = tokens.colors.muted;
  const tabRoutes = state.routes.filter((route) => route.name !== "Impostazioni" && route.name !== "News");
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
      {showBar ? <Animated.View
        style={[styles.container, {
          bottom: Math.max(12, insets.bottom),
          opacity: visibility,
          transform: [{ translateY: visibility.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
        }]}
        pointerEvents={hidden ? "none" : "box-none"}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      >
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
              {barWidth > 0 && focusedIndex >= 0 ? <Animated.View pointerEvents="none" style={[styles.movingIndicator, { width: barWidth / tabRoutes.length, transform: [{ translateX: indicatorPosition }] }]}><View style={[styles.indicatorPill, { backgroundColor: isDark ? "rgba(185,152,255,0.18)" : "rgba(118,80,214,0.14)", borderColor: isDark ? "rgba(211,194,255,0.12)" : "rgba(118,80,214,0.12)" }]} /></Animated.View> : null}
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
      </Animated.View> : null}
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
    paddingHorizontal: 8,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
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
  indicatorPill: { width: "92%", maxWidth: 120, height: 60, borderRadius: 18, borderWidth: 1 },
  label: {
    marginTop: 2,
  },
});
