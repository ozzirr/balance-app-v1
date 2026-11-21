import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { NEWS_TOPICS } from "@/features/news/catalog";
import type { NewsItem, NewsTopicId } from "@/features/news/types";

const colors: Record<NewsTopicId, [string, string, string]> = {
  markets: ["#151E42", "#385394", "#B7C8FF"],
  rates: ["#123238", "#236C77", "#A3E6E8"],
  investing: ["#25183E", "#623B87", "#E5CAF9"],
  "personal-finance": ["#13372D", "#286B50", "#B6EDC9"],
  pensions: ["#2B2647", "#514B83", "#D7CEFA"],
  crypto: ["#41281D", "#875322", "#FFD0A1"],
  "real-estate": ["#262E3A", "#425873", "#C9DFF8"],
  taxes: ["#3C2339", "#733C63", "#FFD0E5"],
};

export default function NewsArtwork({ item, variant }: { item: NewsItem; variant: "thumbnail" | "hero" | "detail" }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const canShowPhoto = item.imageStatus === "licensed" || (__DEV__ && item.imageStatus === "unverified");
  const url = canShowPhoto ? item.imageUrl : undefined;
  const topic = NEWS_TOPICS.find(({ id }) => id === item.topics[0]);
  const [base, gradient, accent] = colors[topic?.id ?? "markets"];
  const small = variant === "thumbnail";

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, styles[variant], { backgroundColor: base }]}
    >
      {url && failedUrl !== url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailedUrl(url)} />
      ) : (
        <>
          <Svg
            width="100%" height="100%" viewBox={small ? "0 0 100 100" : "0 0 320 150"}
            preserveAspectRatio="xMidYMid slice"
          >
            <Defs>
              <LinearGradient id="artwork" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={base} />
                <Stop offset="100%" stopColor={gradient} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#artwork)" />
            {small ? (
              <Circle cx="76" cy="26" r="49" fill={accent} opacity={0.15} />
            ) : (
              <>
                <Circle cx="246" cy="74" r="54" fill={accent} opacity={0.1} />
                <Circle cx="246" cy="74" r="84" stroke={accent} strokeWidth="1" opacity={0.25} fill="none" />
                <Path d="M0 106C42 106 66 64 108 70S159 112 202 87 247 29 320 31M0 119C45 119 69 77 110 83S161 125 204 100 249 42 320 44" stroke={accent} strokeWidth="1.5" opacity={0.35} fill="none" />
              </>
            )}
          </Svg>
          <View style={[styles.mark, !small && styles.heroMark]}>
            <MaterialCommunityIcons name={topic?.icon ?? "newspaper-variant-outline"} size={small ? 22 : 42} color={accent} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
  thumbnail: { width: 50, height: 50, borderRadius: 10 },
  hero: { height: 110, borderRadius: 12, marginTop: 3 },
  detail: { height: 170, borderRadius: 12, marginTop: 3 },
  mark: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  heroMark: { alignItems: "flex-start", paddingLeft: 26 },
});
