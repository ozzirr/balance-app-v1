import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import type { SlideData } from "@/onboarding/types";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  slide: SlideData;
  isActive: boolean;
  availableHeight: number;
};

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function OnboardingSlide({ slide, isActive, availableHeight }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const textAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(isActive ? 0 : 16)).current;
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.98)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [floatAnim]);

  useEffect(() => {
    if (isActive) {
      textAnim.setValue(0);
      translateY.setValue(16);
      scale.setValue(0.98);

      Animated.parallel([
        Animated.timing(textAnim, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 360,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isActive, scale, textAnim, translateY]);

  const animatedStyle = {
    transform: [
      { translateY },
      { scale },
    ],
  };

  const animatedTextStyle = {
    opacity: textAnim,
    transform: [
      {
        translateY: textAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  const imageMaxHeight = Math.min(Math.max(availableHeight * 0.42, 180), 280);

  return (
    <Animated.View style={[styles.animatedContainer, animatedStyle]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { minHeight: availableHeight }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          <Animated.View style={[styles.contentBlock, animatedTextStyle]}>
            <Text style={[styles.title, { color: tokens.colors.text }]}>{slide.title}</Text>
            <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>{slide.subtitle}</Text>
            {slide.bullets.length > 0 && (
              <View style={styles.bullets}>
                {slide.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={[styles.bulletIcon, { backgroundColor: tokens.colors.accent }]} />
                    <Text style={[styles.bulletText, { color: tokens.colors.muted }]} numberOfLines={1}>
                      {bullet}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.imageWrapper}>
              <AnimatedImage
                source={slide.image}
                style={[styles.image, { maxHeight: imageMaxHeight, transform: [{ translateY: floatAnim }] }]}
              />
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: {
    flex: 1,
    width: "100%",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 16,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
  contentBlock: {
    width: "100%",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "left",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "left",
    marginBottom: 12,
  },
  bullets: {
    width: "100%",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  bulletIcon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.85,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "left",
  },
  imageWrapper: {
    width: "100%",
    alignItems: "center",
    marginTop: 18,
  },
  image: {
    width: "100%",
    resizeMode: "contain",
  },
});
