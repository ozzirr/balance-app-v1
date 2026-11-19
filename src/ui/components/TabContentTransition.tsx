import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useDashboardTheme } from "@/ui/dashboard/theme";

const PreviousTabContext = createContext<React.MutableRefObject<number | null> | null>(null);

export function TabTransitionProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const previousTab = useRef<number | null>(null);
  return <PreviousTabContext.Provider value={previousTab}>{children}</PreviousTabContext.Provider>;
}

export default function TabContentTransition({ children, index }: { children: React.ReactNode; index: number }): JSX.Element {
  const focused = useIsFocused();
  const previousTab = useContext(PreviousTabContext);
  const { tokens } = useDashboardTheme();
  const progress = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [hasLayout, setHasLayout] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useLayoutEffect(() => {
    progress.stopAnimation();
    translateX.stopAnimation();
    if (!focused) {
      progress.setValue(1);
      translateX.setValue(0);
      return;
    }
    const previousIndex = previousTab?.current ?? null;
    if (previousTab) previousTab.current = index;
    if (reduceMotion || !hasLayout || previousIndex === null || previousIndex === index) {
      progress.setValue(1);
      translateX.setValue(0);
      return;
    }
    progress.setValue(0);
    translateX.setValue(index > previousIndex ? -18 : 18);
    const config = { duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true };
    const animation = Animated.parallel([
      Animated.timing(progress, { ...config, toValue: 1 }),
      Animated.timing(translateX, { ...config, toValue: 0 }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [focused, hasLayout, index, previousTab, progress, reduceMotion, translateX]);

  return (
    <View onLayout={() => setHasLayout(true)} style={[styles.screen, { backgroundColor: tokens.colors.bg }]}>
      <Animated.View style={[styles.screen, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }), transform: [{ translateX }] }]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
