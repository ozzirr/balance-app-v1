import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { GlassCardContainer, PrimaryPillButton, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import OnboardingIllustration from "@/onboarding/components/OnboardingIllustration";
import OnboardingScaffold, { ONBOARDING_CARD_MIN_HEIGHT } from "@/onboarding/components/OnboardingScaffold";

type Props = {
  variant?: "free" | "pro";
  onNext: () => void;
  onImport?: () => void;
};

export default function OnboardingWelcome({
  variant = "free",
  onNext,
  onImport,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { tokens } = useDashboardTheme();
  const isProVariant = variant === "pro";

  const bullets = [
    t("onboardingV2.welcome.bullet1"),
    t("onboardingV2.welcome.bullet2"),
    t("onboardingV2.welcome.bullet3"),
  ];

  return (
    <OnboardingScaffold step={1} totalSteps={3}>
      <GlassCardContainer contentStyle={{ minHeight: ONBOARDING_CARD_MIN_HEIGHT }}>
        <View style={styles.cardContent}>
          <View>
            <OnboardingIllustration scene="welcome" />
            <View style={styles.header}>
              <Text style={[styles.title, { color: tokens.colors.text }]}>
                {isProVariant ? t("onboardingV2.proWelcome.title") : t("onboardingV2.welcome.title")}
              </Text>
              <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>
                {isProVariant ? t("onboardingV2.proWelcome.subtitle") : t("onboardingV2.welcome.subtitle")}
              </Text>
            </View>
            {!isProVariant ? (
              <View style={styles.list}>
                {bullets.map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.bulletRow,
                      {
                        borderColor: tokens.colors.glassBorder,
                        backgroundColor: tokens.colors.glassBg,
                      },
                    ]}
                  >
                    <View style={[styles.bulletDot, { backgroundColor: tokens.colors.accent }]} />
                    <Text style={[styles.bullet, { color: tokens.colors.text }]}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.actions}>
            <PrimaryPillButton
              label={isProVariant ? t("onboardingV2.proWelcome.ctaImport") : t("onboardingV2.common.continue")}
              onPress={isProVariant ? onImport ?? onNext : onNext}
              color={tokens.colors.accent}
            />
            {isProVariant && (
              <View style={styles.secondaryAction}>
                <SmallOutlinePillButton
                  label={t("onboardingV2.proWelcome.ctaGuided")}
                  onPress={onNext}
                  color={tokens.colors.accent}
                />
              </View>
            )}
          </View>
        </View>
      </GlassCardContainer>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    flex: 1,
    minHeight: ONBOARDING_CARD_MIN_HEIGHT,
    justifyContent: "space-between",
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  list: {
    marginTop: 16,
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  bullet: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    flex: 1,
  },
  secondaryAction: { marginTop: 12 },
  actions: {
    marginTop: 18,
  },
});
