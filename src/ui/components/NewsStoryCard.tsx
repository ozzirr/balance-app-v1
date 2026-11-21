import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import type { NewsItem } from "@/features/news/types";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import NewsArtwork from "@/ui/components/NewsArtwork";

type Props = {
  item: NewsItem;
  topic?: string;
  source: string;
  onOpenSource: () => void;
  bookmark: React.ReactNode;
  heading?: React.ReactNode;
  children?: React.ReactNode;
  showSourceAction?: boolean;
  onCollapse?: () => void;
};

export default function NewsStoryCard({
  item, topic, source, onOpenSource, bookmark, heading, children, showSourceAction = false, onCollapse,
}: Props) {
  const { tokens: { colors } } = useDashboardTheme();
  const { t } = useTranslation();
  const summary = item.summary.trim();
  const openLabel = t("news.openSource");

  return (
    <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
      {heading}
      {topic ? <Text style={[styles.topic, { color: colors.accent }]}>{topic}</Text> : null}
      {onCollapse ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: true }}
          accessibilityHint={t("news.article.collapseHint")}
          onPress={onCollapse}
          style={styles.headlineRow}
        >
          <Text style={[styles.headline, styles.headlineCopy, { color: colors.text }]}>{item.title}</Text>
          <MaterialCommunityIcons name="chevron-up" size={22} color={colors.accent} />
        </Pressable>
      ) : (
        <Text style={[styles.headline, { color: colors.text }]}>{item.title}</Text>
      )}
      {summary && summary !== item.title.trim() ? (
        <Text style={[styles.summary, { color: colors.text }]}>{summary}</Text>
      ) : showSourceAction ? (
        <Text style={[styles.summary, { color: colors.muted }]}>{t("news.article.noSummary")}</Text>
      ) : null}
      {children}
      <NewsArtwork item={item} variant={showSourceAction ? "detail" : "hero"} />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={showSourceAction ? `${openLabel}, ${source}` : undefined}
          accessibilityHint={showSourceAction ? undefined : openLabel}
          onPress={onOpenSource}
          style={styles.source}
        >
          <View style={styles.sourceText}>
            {showSourceAction ? <Text style={[styles.topic, { color: colors.muted }]}>{source}</Text> : null}
            <Text style={[styles.topic, { color: colors.accent }]}>{showSourceAction ? openLabel : source}</Text>
          </View>
          <MaterialCommunityIcons name="open-in-new" size={16} color={colors.accent} />
        </Pressable>
        {bookmark}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderWidth: 1, borderRadius: 22, padding: 16, paddingBottom: 6, gap: 8 },
  topic: { fontSize: 12, fontWeight: "700" },
  headline: { fontSize: 25, lineHeight: 30, letterSpacing: -0.4, fontWeight: "800" },
  headlineRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  headlineCopy: { flex: 1 },
  summary: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: "row", alignItems: "center" },
  source: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 5 },
  sourceText: { flexShrink: 1, gap: 3 },
});
