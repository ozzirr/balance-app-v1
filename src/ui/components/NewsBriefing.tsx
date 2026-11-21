import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { selectNewsBriefing } from "@/features/news/newsBriefing";
import type { NewsItem, NewsTopicId } from "@/features/news/types";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import NewsStoryCard from "@/ui/components/NewsStoryCard";
import NewsArtwork from "@/ui/components/NewsArtwork";

type Props = {
  entries: ReturnType<typeof selectNewsBriefing>;
  topicLabel: (topic: NewsTopicId) => string;
  formatDate: (value: string) => string;
  onOpen: (item: NewsItem) => void;
  renderBookmark: (item: NewsItem) => React.ReactNode;
};

export default function NewsBriefing({ entries, topicLabel, formatDate, onOpen, renderBookmark }: Props) {
  const { tokens: { colors } } = useDashboardTheme();
  const { t } = useTranslation();
  const [lead, secondary] = entries;
  if (!lead) return null;

  const { item, topic } = lead;
  const sourceLine = (story: NewsItem) =>
    [story.source.name, story.publishedAt && formatDate(story.publishedAt)].filter(Boolean).join(" · ");

  return (
    <View style={styles.briefing}>
      <NewsStoryCard
        item={item}
        topic={topicLabel(topic)}
        source={sourceLine(item)}
        onOpenSource={() => onOpen(item)}
        bookmark={renderBookmark(item)}
        heading={(
          <View style={styles.heading}>
            <MaterialCommunityIcons name="lightbulb-outline" size={20} color={colors.accent} />
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t("news.impact.title")}</Text>
          </View>
        )}
      >
        <View style={[styles.context, { borderLeftColor: colors.accent }]}>
          <Text style={[styles.body, { color: colors.text }]}>{t(`news.impact.context.${topic}`)}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            {t("news.impact.watch")} · {t(`news.impact.watchFor.${topic}`)}
          </Text>
        </View>
      </NewsStoryCard>

      {secondary ? (
        <View style={[styles.secondary, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
          <Pressable
            accessibilityRole="link"
            accessibilityHint={t("news.openSource")}
            onPress={() => onOpen(secondary.item)}
            style={styles.secondaryLink}
          >
            <NewsArtwork item={secondary.item} variant="thumbnail" />
            <View style={styles.secondaryCopy}>
              <Text style={[styles.topic, { color: colors.accent }]}>{topicLabel(secondary.topic)}</Text>
              <Text style={[styles.story, { color: colors.text }]}>{secondary.item.title}</Text>
              <Text numberOfLines={2} style={[styles.body, { color: colors.muted }]}>{secondary.item.summary.trim()}</Text>
              <Text style={[styles.topic, { color: colors.muted }]}>{sourceLine(secondary.item)}</Text>
            </View>
          </Pressable>
          {renderBookmark(secondary.item)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  briefing: { gap: 8, marginTop: 4, marginBottom: 20 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: "800", flexShrink: 1 },
  topic: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  context: { borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 3, gap: 5 },
  body: { fontSize: 13, lineHeight: 18 },
  secondary: { flexDirection: "row", alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingLeft: 12 },
  secondaryLink: { flex: 1, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  secondaryCopy: { flex: 1, gap: 3 },
  story: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
});
