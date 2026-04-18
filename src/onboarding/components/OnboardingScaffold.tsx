import React, { useEffect, useRef } from "react";
import { Animated, Easing, ScrollView, StyleSheet, View } from "react-native";
import AppBackground from "@/ui/components/AppBackground";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSettings } from "@/settings/useSettings";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  children: React.ReactNode;
  step?: number;
  totalSteps?: number;
};

export const ONBOARDING_CARD_MIN_HEIGHT = 520;

export default function OnboardingScaffold({ children, step, totalSteps }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { scrollBounceEnabled } = useSettings();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animatedValue, step]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  const progress = step && totalSteps ? Math.min(step / totalSteps, 1) : 0;

  return (
    <AppBackground>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <ScrollView
          bounces={scrollBounceEnabled}
          alwaysBounceVertical={scrollBounceEnabled}
          overScrollMode={scrollBounceEnabled ? "always" : "never"}
          contentContainerStyle={[
            styles.content,
            { padding: tokens.spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {step && totalSteps ? (
            <View style={styles.progressBlock}>
              <View
                style={[
                  styles.stepBadge,
                  {
                    backgroundColor: tokens.colors.glassBg,
                    borderColor: tokens.colors.glassBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: tokens.colors.accent,
                    },
                  ]}
                />
                <Animated.Text style={[styles.stepLabel, { color: tokens.colors.text }]}>
                  {`Passo ${step} di ${totalSteps}`}
                </Animated.Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: tokens.colors.surface2 }]}>
                <View style={[styles.progressFill, { backgroundColor: tokens.colors.accent, width: `${progress * 100}%` }]} />
              </View>
            </View>
          ) : null}
          <Animated.View style={{ opacity: animatedValue, transform: [{ translateY }] }}>
            {children}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 16,
  },
  progressBlock: {
    gap: 10,
  },
  stepBadge: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
});
