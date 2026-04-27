import React, { useState } from "react";
import { Image, StyleSheet, View, Pressable } from "react-native";
import { Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { GlassCardContainer, PrimaryPillButton } from "@/ui/components/EntriesUI";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import OnboardingScaffold, { ONBOARDING_CARD_MIN_HEIGHT } from "@/onboarding/components/OnboardingScaffold";

type Props = {
  onFinish: (hasInvestments: boolean) => void;
};

export default function OnboardingInvestments({ onFinish }: Props): JSX.Element {
  const { t } = useTranslation();
  const { tokens } = useDashboardTheme();
  const [choice, setChoice] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinish = () => {
    if (choice === null || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    onFinish(choice);
  };

  const renderOption = (value: boolean, label: string) => {
    const selected = choice === value;
    return (
      <Pressable
        onPress={() => setChoice(value)}
        style={({ pressed }) => [
          styles.option,
          {
            borderColor: selected ? tokens.colors.accent : tokens.colors.glassBorder,
            backgroundColor: selected ? `${tokens.colors.accent}22` : tokens.colors.glassBg,
            opacity: pressed ? 0.93 : 1,
          },
        ]}
      >
        <Text style={[styles.optionLabel, { color: tokens.colors.text }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <OnboardingScaffold step={3} totalSteps={3}>
      <GlassCardContainer contentStyle={{ minHeight: ONBOARDING_CARD_MIN_HEIGHT }}>
        <View style={styles.cardContent}>
          <View>
            <View style={styles.heroWrap}>
              <Image
                source={require("../../../assets/onboarding/onboarding-3.png")}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: tokens.colors.text }]}>{t("onboardingV2.investments.title")}</Text>
              <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>
                {t("onboardingV2.investments.subtitle")}
              </Text>
            </View>
            <View style={styles.options}>
              {renderOption(true, t("onboardingV2.investments.optionYes"))}
              {renderOption(false, t("onboardingV2.investments.optionNo"))}
            </View>
          </View>
          <View style={styles.actions}>
            <Text style={[styles.helper, { color: tokens.colors.muted }]}>
              {t("onboardingV2.investments.helper")}
            </Text>
            <View style={{ marginTop: 12 }}>
              <PrimaryPillButton
                label={t("onboardingV2.investments.cta")}
                onPress={handleFinish}
                color={tokens.colors.accent}
                disabledColor={tokens.colors.surface2}
                disabled={choice === null || isSubmitting}
              />
            </View>
          </View>
        </View>
      </GlassCardContainer>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  heroImage: {
    width: 180,
    height: 140,
  },
  cardContent: {
    flex: 1,
    minHeight: ONBOARDING_CARD_MIN_HEIGHT,
    justifyContent: "space-between",
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  options: {
    marginTop: 18,
    gap: 12,
  },
  option: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  helper: {
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    marginTop: 16,
  },
});
