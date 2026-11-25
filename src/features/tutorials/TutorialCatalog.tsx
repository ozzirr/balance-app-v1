import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { tutorialGroups, type TutorialLesson } from "./catalog";

function TutorialVideo({ source }: { source: number }) {
  const { useVideoPlayer, VideoView } = require("expo-video") as typeof import("expo-video");
  const player = useVideoPlayer(source, (instance) => instance.play());
  const { height } = useWindowDimensions();
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      accessibilityLabel="Video"
      style={[styles.video, { height: Math.min(height * 0.67, 620) }]}
    />
  );
}

export default function TutorialCatalog() {
  const { t } = useTranslation();
  const { tokens: { colors } } = useDashboardTheme();
  const [lesson, setLesson] = useState<TutorialLesson | null>(null);
  const close = () => setLesson(null);
  return (
    <>
      {tutorialGroups.map(({ id, lessons }) => (
        <View key={id} style={styles.group}>
          <Text accessibilityRole="header" variant="titleMedium" style={{ color: colors.text }}>{t(`tutorials.groups.${id}`)}</Text>
          {lessons.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={t(`tutorials.lessons.${item.id}.title`)}
              onPress={() => setLesson(item)}
              style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.glassBorder, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.icon, { backgroundColor: colors.accent + "18" }]}>
                <MaterialCommunityIcons name={item.icon} size={21} color={colors.accent} />
              </View>
              <Text variant="titleSmall" style={[styles.rowTitle, { color: colors.text }]}>{t(`tutorials.lessons.${item.id}.title`)}</Text>
              <MaterialCommunityIcons name="play-circle-outline" size={24} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      ))}
      {lesson && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
          <SafeAreaView style={[styles.sheet, { backgroundColor: colors.bg }]}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" variant="titleLarge" style={[styles.rowTitle, { color: colors.text }]}>
                {t(`tutorials.lessons.${lesson.id}.title`)}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={close} style={styles.close}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.lesson}>
              <TutorialVideo key={lesson.id} source={lesson.source} />
              <Text variant="bodyMedium" style={{ color: colors.text }}>
                {t(`tutorials.lessons.${lesson.id}.body`)}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.muted }}>
                {t("tutorials.demoLanguage")}
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, borderRadius: 16, minHeight: 56 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowTitle: { flex: 1 },
  sheet: { flex: 1 },
  heading: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  lesson: { padding: 16, gap: 12 },
  video: { width: "100%", borderRadius: 18, backgroundColor: "#08090F" },
});
