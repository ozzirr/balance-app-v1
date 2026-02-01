import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { GlassCardContainer, SmallOutlinePillButton } from "@/ui/components/EntriesUI";

type Props = {
  title?: string;
  lines: string[];
  lineNumberOfLines?: number;
  ctaLabel?: string;
  onPress?: () => void;
  ctaColor?: string;
  leadingIcon?: React.ReactNode;
  actions?: React.ReactNode;
};

export default function CoachTipCard({
  title,
  lines,
  lineNumberOfLines,
  ctaLabel,
  onPress,
  ctaColor,
  leadingIcon,
  actions,
}: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const showDefaultCta = !actions && ctaLabel && onPress;
  return (
    <GlassCardContainer contentStyle={styles.card}>
      <View style={styles.headerRow}>
        {leadingIcon ? <View style={styles.iconWrap}>{leadingIcon}</View> : null}
        <View style={styles.textBlock}>
          {title ? (
            <Text style={[styles.title, { color: tokens.colors.text }]}>{title}</Text>
          ) : null}
          <View style={styles.body}>
            {lines.map((line, index) => (
              <Text
                key={`${index}-${line}`}
                numberOfLines={lineNumberOfLines}
                style={[styles.bodyText, { color: tokens.colors.muted }]}
              >
                {line}
              </Text>
            ))}
          </View>
        </View>
      </View>
      {actions ? <View style={styles.actionsRow}>{actions}</View> : null}
      {showDefaultCta ? (
        <View style={styles.ctaRow}>
          <SmallOutlinePillButton
            label={ctaLabel}
            onPress={onPress}
            color={ctaColor ?? tokens.colors.accent}
          />
        </View>
      ) : null}
    </GlassCardContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconWrap: {
    paddingTop: 2,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  body: {
    gap: 2,
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  ctaRow: {
    alignItems: "flex-start",
    marginTop: 4,
  },
  actionsRow: {
    marginTop: 6,
  },
});
