import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text } from "react-native-paper";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import GlassBlur from "@/ui/components/GlassBlur";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  visible: boolean;
  onContinue: () => void;
  loading?: boolean;
};

export default function ProWelcomeModal({
  visible,
  onContinue,
  loading = false,
}: Props): React.ReactElement {
  const { tokens, shadows, isDark } = useDashboardTheme();
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  const benefits = useMemo(
    () => [
      t("pro.welcome.benefit1"),
      t("pro.welcome.benefit2"),
      t("pro.welcome.benefit3"),
    ],
    [t]
  );

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 220,
          damping: 18,
          mass: 0.7,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, visible]);

  const overlayTint = isDark ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.8)";
  const blurTint = isDark ? "dark" : "light";
  const blurIntensity = 35;
  const cardBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
      ? "rgba(15, 18, 30, 0.78)"
      : tokens.colors.modalGlassBg;
  const cardBorder =
    Platform.OS === "android"
      ? tokens.colors.border
      : isDark
      ? "rgba(255,255,255,0.12)"
      : "rgba(158,123,255,0.34)";
  const subtitleColor = isDark ? tokens.colors.muted : "rgba(16, 21, 34, 0.68)";
  const iconTint = isDark ? `${tokens.colors.accentPurple}22` : "rgba(158,123,255,0.16)";

  return (
    <Portal>
      <Modal
        visible={visible}
        dismissable={false}
        style={styles.modal}
        contentContainerStyle={styles.content}
        theme={{ colors: { backdrop: overlayTint } }}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBackground,
              borderColor: cardBorder,
              opacity,
              transform: [{ scale }],
              ...shadows.card,
            },
          ]}
        >
          <GlassBlur intensity={blurIntensity} tint={blurTint} fallbackColor="transparent" />
          <View style={[styles.iconWrap, { backgroundColor: iconTint }]}>
            <View
              style={[
                styles.iconInner,
                { backgroundColor: isDark ? tokens.colors.modalBorder : "rgba(255,255,255,0.55)" },
              ]}
            >
              <MaterialCommunityIcons name="crown-outline" size={30} color={tokens.colors.accent} />
            </View>
          </View>

          <Text variant="titleLarge" style={[styles.title, { color: tokens.colors.text }]}>
            {t("pro.welcome.title")}
          </Text>
          <Text variant="bodyMedium" style={[styles.body, { color: subtitleColor }]}>
            {t("pro.welcome.body")}
          </Text>

          <View style={styles.benefits}>
            {benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <View style={[styles.checkIcon, { backgroundColor: tokens.colors.accentPurple }]}>
                  <MaterialIcons name="check" size={16} color="#FFFFFF" />
                </View>
                <Text variant="bodyLarge" style={[styles.benefitText, { color: tokens.colors.text }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>

          <Button
            mode="contained"
            buttonColor={tokens.colors.accent}
            textColor="#FFFFFF"
            onPress={onContinue}
            loading={loading}
            disabled={loading}
            style={styles.primaryButton}
            contentStyle={styles.primaryButtonContent}
          >
            {t("pro.welcome.continue")}
          </Button>
        </Animated.View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "center",
  },
  content: {
    padding: 16,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 28,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    overflow: "hidden",
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    fontWeight: "700",
  },
  body: {
    textAlign: "center",
  },
  benefits: {
    gap: 10,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 999,
  },
  primaryButtonContent: {
    paddingVertical: 10,
  },
});
