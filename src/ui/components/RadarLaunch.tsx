import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";

const TAKEOFF_MS = 2100;
const MAX_INTRO_MS = 3100;
const highlights = [
  { label: "sources", icon: "newspaper-variant-outline", appearAt: 0.06 },
  { label: "interests", icon: "bullseye-arrow", appearAt: 0.20 },
  { label: "market", icon: "chart-timeline-variant", appearAt: 0.34 },
] as const;

export default function RadarLaunch({ busy, reduceMotion, headerHeight, onDone }: {
  busy: boolean;
  reduceMotion: boolean;
  headerHeight: number;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { tokens: { colors } } = useDashboardTheme();
  const { height } = useWindowDimensions();
  const [takeoffFinished, setTakeoffFinished] = useState(false);
  const [deadlineReached, setDeadlineReached] = useState(false);
  const flight = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const minimum = setTimeout(() => setTakeoffFinished(true), TAKEOFF_MS);
    const deadline = setTimeout(() => setDeadlineReached(true), MAX_INTRO_MS);
    return () => {
      clearTimeout(minimum);
      clearTimeout(deadline);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const launch = Animated.timing(flight, {
      toValue: 1,
      duration: TAKEOFF_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    launch.start();
    return () => launch.stop();
  }, [flight, reduceMotion]);

  useEffect(() => {
    if (!deadlineReached && (busy || !takeoffFinished)) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    const reveal = Animated.timing(opacity, {
      toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    reveal.start(({ finished }) => { if (finished) onDone(); });
    return () => reveal.stop();
  }, [busy, deadlineReached, onDone, opacity, reduceMotion, takeoffFinished]);

  const compact = height < 580;
  const artSize = compact ? 126 : 210;
  const stages = [0, 0.40, 0.54, 0.86, 1];
  const rocket = {
    opacity: flight.interpolate({ inputRange: [0, 0.78, 0.97, 1], outputRange: [1, 1, 0, 0] }),
    transform: [
      { translateX: flight.interpolate({ inputRange: stages, outputRange: [0, -2, 0, 70, 113] }) },
      { translateY: flight.interpolate({ inputRange: stages, outputRange: [8, 11, 4, -66, -103] }) },
      { scale: flight.interpolate({ inputRange: stages, outputRange: [1, 0.95, 1.05, 0.8, 0.55] }) },
    ],
  };

  return (
    <Animated.View style={[styles.overlay, { top: headerHeight, backgroundColor: colors.bg, opacity }]}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("news.launch.title")}
        accessibilityHint={t("news.launch.status")}
        accessibilityState={{ busy: true }}
        style={styles.content}
      >
        <View style={[styles.art, { width: artSize, height: artSize }]} accessible={false}>
          <Svg style={StyleSheet.absoluteFill} width={artSize} height={artSize} viewBox="0 0 226 226">
            <Defs>
              <RadialGradient id="radarGlow">
                <Stop offset="0" stopColor={colors.accent} stopOpacity={0.29} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="113" cy="113" r="113" fill="url(#radarGlow)" />
            {[37, 63, 89].map((r) => (
              <Circle key={r} cx="113" cy="113" r={r} fill="none" stroke={colors.accent} strokeOpacity={0.29}
                strokeDasharray={r === 89 ? "2 6" : undefined} />
            ))}
            <Line x1="113" y1="24" x2="113" y2="202" stroke={colors.accent} strokeOpacity={0.16} />
            <Line x1="24" y1="113" x2="202" y2="113" stroke={colors.accent} strokeOpacity={0.16} />
            <Path d="M 41 166 L 70 149 L 86 154 L 110 122 L 141 126 L 166 93 L 185 82"
              fill="none" stroke={colors.accent} strokeOpacity={0.42} strokeWidth="1.5" strokeLinejoin="round" />
            <Circle cx="47" cy="71" r="2.5" fill={colors.accent} fillOpacity={0.68} />
            <Circle cx="175" cy="158" r="3" fill={colors.income} fillOpacity={0.84} />
            <Circle cx="185" cy="82" r="3" fill={colors.accent} />
          </Svg>
          {!reduceMotion ? (
            <Animated.View pointerEvents="none" style={[styles.ring, {
              borderColor: colors.accent,
              opacity: flight.interpolate({ inputRange: [0, 0.40, 0.54, 0.9, 1], outputRange: [0, 0, 0.65, 0, 0] }),
              transform: [{ scale: flight.interpolate({ inputRange: [0, 0.40, 0.9, 1], outputRange: [1, 1, 3.1, 3.1] }) }],
            }]} />
          ) : null}
          <Animated.View pointerEvents="none" style={[
            styles.rocket,
            { backgroundColor: colors.surface, borderColor: `${colors.accent}66`, shadowColor: colors.accent },
            !reduceMotion && rocket,
          ]}>
            <MaterialCommunityIcons name="rocket-launch" size={35} color={colors.accent} />
          </Animated.View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t("news.launch.title")}</Text>
        <View style={[styles.highlights, { borderColor: colors.glassBorder, backgroundColor: colors.surface }]}>
          {highlights.map(({ label, icon, appearAt }, index) => {
            const fade = flight.interpolate({
              inputRange: [appearAt, appearAt + 0.15],
              outputRange: [0, 1],
              extrapolate: "clamp",
            });
            return (
              <Animated.View key={label} style={[
                styles.highlight,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassBorder },
                !reduceMotion && { opacity: fade },
              ]}>
                <MaterialCommunityIcons name={icon} size={17} color={colors.accent} />
                <Text style={[styles.highlightText, { color: colors.text }]}>{t(`news.launch.${label}`)}</Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingBottom: 16 },
  content: { width: "100%", maxWidth: 380, alignItems: "center", gap: 8 },
  art: { alignItems: "center", justifyContent: "center", marginBottom: 7 },
  ring: { position: "absolute", width: 66, height: 66, borderRadius: 33, borderWidth: 1 },
  rocket: {
    width: 66, height: 66, borderRadius: 27, borderWidth: 1, justifyContent: "center", alignItems: "center",
    shadowOpacity: 0.36, shadowRadius: 18, shadowOffset: { width: 0, height: 4 },
  },
  title: { fontSize: 29, lineHeight: 35, fontWeight: "800", textAlign: "center", letterSpacing: -0.6 },
  highlights: {
    marginTop: 6, width: "100%", maxWidth: 300, borderWidth: 1,
    borderRadius: 18, paddingHorizontal: 13,
  },
  highlight: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  highlightText: { flex: 1, fontSize: 13, fontWeight: "600" },
});
