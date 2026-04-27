import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { GlassCardContainer, PrimaryPillButton } from "@/ui/components/EntriesUI";
import OnboardingScaffold, { ONBOARDING_CARD_MIN_HEIGHT } from "@/onboarding/components/OnboardingScaffold";
import { getDisplayName, setHasInvestments, setOnboardingCompleted } from "@/onboarding/onboardingStorage";
import { seedInitialData } from "@/onboarding/onboardingSeed";
import { setPreference } from "@/repositories/preferencesRepo";
import { useSettings } from "@/settings/useSettings";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  hasInvestments: boolean;
  onComplete: () => void;
  shouldSeedOnComplete: boolean;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function OnboardingSetup({
  hasInvestments,
  onComplete,
  shouldSeedOnComplete,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { tokens } = useDashboardTheme();
  const { setShowInvestments } = useSettings();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const setupSteps = useMemo(
    () => [
      t("onboardingV2.setup.stepPersonalize", {
        defaultValue: "Personalizziamo la tua esperienza",
      }),
      t("onboardingV2.setup.stepWallets", {
        defaultValue: "Creiamo i tuoi primi wallet",
      }),
      t("onboardingV2.setup.stepLiquidity", {
        defaultValue: "Creato wallet Liquidità",
      }),
      hasInvestments
        ? t("onboardingV2.setup.stepInvestments", {
            defaultValue: "Creato wallet Investimenti",
          })
        : t("onboardingV2.setup.stepWalletSection", {
            defaultValue: "Preparata la sezione Wallet",
          }),
      t("onboardingV2.setup.stepHome", {
        defaultValue: "Personalizzata la Dashboard",
      }),
      t("onboardingV2.setup.stepTour", {
        defaultValue: "Colleghiamo Snapshot, Cashflow e Wallet",
      }),
      t("onboardingV2.setup.stepDetails", {
        defaultValue: "Ultimi dettagli",
      }),
    ],
    [hasInvestments, t]
  );

  const previews = useMemo(
    () => [
      {
        icon: "view-dashboard-outline",
        title: "Dashboard",
        body: t("onboardingV2.setup.previewDashboard", {
          defaultValue: "La tua regia: azioni iniziali, patrimonio e trend principali.",
        }),
      },
      {
        icon: "wallet-outline",
        title: "Wallet",
        body: t("onboardingV2.setup.previewWallet", {
          defaultValue: "Qui organizzi liquidità, investimenti e conti personali.",
        }),
      },
      {
        icon: "camera-timer",
        title: "Snapshot",
        body: t("onboardingV2.setup.previewSnapshot", {
          defaultValue: "Registra fotografie del patrimonio per vedere l'evoluzione.",
        }),
      },
      {
        icon: "swap-vertical",
        title: "Cashflow",
        body: t("onboardingV2.setup.previewCashflow", {
          defaultValue: "Entrate, uscite e ricorrenze restano sotto controllo.",
        }),
      },
    ],
    [t]
  );

  const finalizeOnboarding = async () => {
    await setHasInvestments(hasInvestments);
    await setShowInvestments(hasInvestments);
    const onboardingName = (await getDisplayName()).trim();
    if (onboardingName) {
      await setPreference("profile_name", onboardingName);
    }
    if (shouldSeedOnComplete) {
      await seedInitialData({ hasInvestments });
    }
    await setOnboardingCompleted(true);
  };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setActiveStep(0);
    progress.setValue(0);
    pulse.setValue(0);

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    Animated.timing(progress, {
      toValue: 1,
      duration: 4600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const run = async () => {
      try {
        const finalizePromise = finalizeOnboarding();
        for (let index = 0; index < setupSteps.length; index += 1) {
          if (cancelled) {
            return;
          }
          setActiveStep(index);
          if (Platform.OS === "ios") {
            void Haptics.selectionAsync();
          }
          await delay(620);
        }
        await finalizePromise;
        await delay(420);
        if (!cancelled) {
          onComplete();
        }
      } catch (setupError) {
        if (!cancelled) {
          const message =
            setupError instanceof Error
              ? setupError.message
              : t("onboardingV2.setup.error", {
                  defaultValue: "Non siamo riusciti a completare la configurazione.",
                });
          setError(message);
          Alert.alert("Errore", message);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      pulseAnimation.stop();
    };
  }, [hasInvestments, onComplete, progress, pulse, retryKey, setupSteps, shouldSeedOnComplete, t]);

  const previewIndex = Math.min(Math.floor((activeStep / setupSteps.length) * previews.length), previews.length - 1);
  const preview = previews[previewIndex];
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["4%", "100%"],
  });

  return (
    <OnboardingScaffold>
      <GlassCardContainer contentStyle={{ minHeight: ONBOARDING_CARD_MIN_HEIGHT }}>
        <View style={styles.cardContent}>
          <View style={styles.header}>
            <Animated.View
              style={[
                styles.orbit,
                {
                  borderColor: tokens.colors.glassBorder,
                  backgroundColor: tokens.colors.glassBg,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            >
              <MaterialCommunityIcons name="auto-fix" size={34} color={tokens.colors.accent} />
            </Animated.View>
            <Text style={[styles.title, { color: tokens.colors.text }]}>
              {t("onboardingV2.setup.title", {
                defaultValue: "Stiamo configurando Balance per te",
              })}
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>
              {t("onboardingV2.setup.subtitle", {
                defaultValue: "Usiamo le tue risposte per preparare la prima esperienza e mostrarti le aree principali.",
              })}
            </Text>
          </View>

          <View style={styles.previewBlock}>
            <View style={[styles.previewCard, { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.surface }]}>
              <View style={[styles.previewIcon, { backgroundColor: `${tokens.colors.accent}1F` }]}>
                <MaterialCommunityIcons name={preview.icon as never} size={24} color={tokens.colors.accent} />
              </View>
              <View style={styles.previewCopy}>
                <Text style={[styles.previewTitle, { color: tokens.colors.text }]}>{preview.title}</Text>
                <Text style={[styles.previewBody, { color: tokens.colors.muted }]}>{preview.body}</Text>
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: tokens.colors.surface2 }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: tokens.colors.accent,
                    width: progressWidth,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.steps}>
            {setupSteps.map((step, index) => {
              const done = index < activeStep;
              const active = index === activeStep;
              return (
                <View key={step} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepIcon,
                      {
                        backgroundColor: done || active ? tokens.colors.accent : tokens.colors.surface2,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={done ? "check" : active ? "dots-horizontal" : "circle-small"}
                      size={16}
                      color={done || active ? "#FFFFFF" : tokens.colors.muted}
                    />
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: done || active ? tokens.colors.text : tokens.colors.muted,
                      },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>

          {error ? (
            <PrimaryPillButton
              label={t("onboardingV2.setup.retry", { defaultValue: "Riprova" })}
              onPress={() => setRetryKey((value) => value + 1)}
              color={tokens.colors.accent}
            />
          ) : null}
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
    gap: 22,
  },
  header: {
    alignItems: "center",
    gap: 10,
  },
  orbit: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    textAlign: "center",
  },
  previewBlock: {
    gap: 12,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCopy: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  previewBody: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  steps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
});
