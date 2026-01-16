import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import type { SlideData } from "@/onboarding/types";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  slide: SlideData;
  isActive: boolean;
  availableHeight?: number;
};

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function OnboardingSlide({ slide, isActive, availableHeight }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
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

  const h = typeof availableHeight === "number" && availableHeight > 0 ? availableHeight : 520;

  // Immagine non troppo alta, e wrapper con height fissa per evitare “stretch”
  const imageMaxHeight = Math.min(Math.max(h * 0.45, 220), 340);

  return (
    <View style={styles.root}>
      <View style={[styles.imageWrapper, { height: imageMaxHeight }]}>
        <AnimatedImage
          source={slide.image}
          style={[
            styles.image,
            {
              transform: [{ translateY: floatAnim }],
              opacity: isActive ? 1 : 0.95,
            },
          ]}
        />
      </View>

        <View style={styles.textGroup}>
          <Text style={[styles.title, styles.titleGlow]}>{slide.title}</Text>
          <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>{slide.subtitle}</Text>

          {slide.bullets.length > 0 && (
            <View style={styles.bullets}>
              {slide.bullets.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                <MaterialCommunityIcons
                  name={getBulletIconName(bullet)}
                  size={20}
                  color={tokens.colors.accent}
                  style={styles.icon}
                />
                  <Text style={[styles.bulletText, { color: tokens.colors.muted }]} numberOfLines={2}>
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 30,
    justifyContent: "flex-start",
    paddingBottom: 30,
  },

  imageWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    flexGrow: 0,
    flexShrink: 0,
  },

  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },

  textGroup: {
    width: "100%",
    gap: 8,
  },

  title: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800",
    textAlign: "center",
    color: "#C9D7FF",
  },

  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "500",
    textAlign: "center",
  },

  bullets: {
    marginTop: 10,
    width: "100%",
    gap: 8,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
  },

  icon: { marginRight: 4 },

  bulletText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    fontWeight: "600",
  },

  titleGlow: {
    textShadowColor: "rgba(167, 139, 250, 0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
});

function getBulletIconName(bullet: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const normalized = bullet.toLowerCase();
  if (normalized.includes("wallet") || normalized.includes("entrate") || normalized.includes("uscite")) return "wallet";
  if (normalized.includes("andamento") || normalized.includes("grafici") || normalized.includes("performance")) return "chart-line";
  if (normalized.includes("codice") || normalized.includes("source") || normalized.includes("open")) return "code-tags";
  if (normalized.includes("scatola") || normalized.includes("nascosto") || normalized.includes("black") || normalized.includes("nera")) return "eye-off";
  if (normalized.includes("cloud") || normalized.includes("tracciamento")) return "cloud-off-outline";
  if (normalized.includes("privacy") || normalized.includes("account")) return "shield-check";
  if (normalized.includes("categorie") || normalized.includes("spese")) return "format-list-bulleted";
  return "circle-medium";
}
