import React, { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";
import { GlassCardContainer, PrimaryPillButton, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import OnboardingScaffold, { ONBOARDING_CARD_MIN_HEIGHT } from "@/onboarding/components/OnboardingScaffold";
import { importFromFile } from "@/importExport";
import { emitDataReset } from "@/app/dataEvents";

type Props = {
  onImportComplete: () => void;
  onContinueGuided: () => void;
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export default function OnboardingProImport({
  onImportComplete,
  onContinueGuided,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const { tokens } = useDashboardTheme();
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImport = async () => {
    if (isImporting) return;
    setErrorMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }

    setIsImporting(true);
    try {
      await importFromFile(result.assets[0].uri);
      emitDataReset();
      onImportComplete();
    } catch (error) {
      setErrorMessage(
        toErrorMessage(
          error,
          t("onboardingV2.proImport.importError", {
            defaultValue: "Importazione non riuscita. Riprova con un file esportato da Balance.",
          })
        )
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <OnboardingScaffold>
      <GlassCardContainer contentStyle={{ minHeight: ONBOARDING_CARD_MIN_HEIGHT }}>
        <View style={styles.cardContent}>
          <View>
            <View style={styles.heroWrap}>
              <Image
                source={require("../../../assets/onboarding/onboarding-1.png")}
                style={styles.heroImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: tokens.colors.text }]}>{t("onboardingV2.proImport.title")}</Text>
              <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>
                {t("onboardingV2.proImport.subtitle")}
              </Text>
            </View>
            {errorMessage ? (
              <Text style={[styles.errorText, { color: tokens.colors.expense }]}>
                {errorMessage}
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            <PrimaryPillButton
              label={t("onboardingV2.proImport.ctaImport")}
              onPress={handleImport}
              color={tokens.colors.accent}
              disabled={isImporting}
            />
            <View style={{ height: 12 }} />
            <SmallOutlinePillButton
              label={t("onboardingV2.proImport.ctaGuided")}
              onPress={() => {
                if (isImporting) return;
                onContinueGuided();
              }}
              color={tokens.colors.accent}
            />
            {isImporting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={tokens.colors.accent} />
                <Text style={[styles.loadingText, { color: tokens.colors.muted }]}>
                  {t("onboardingV2.proImport.importing")}
                </Text>
              </View>
            ) : null}
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
    width: 160,
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
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  errorText: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },
  actions: {
    marginTop: 18,
  },
  loadingRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
