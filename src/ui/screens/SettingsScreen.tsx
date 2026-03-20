/// <reference types="react" />
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Switch, Text, TextInput } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { exportToJson, importFromFile, importFromJson } from "@/importExport";
import type { ExportPayload } from "@/importExport/types";
import { runMigrations, withTransaction } from "@/db/db";
import { emitDataReset } from "@/app/dataEvents";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemeContext } from "@/ui/theme";
import SecuritySettingsSection from "@/security/SecuritySettingsSection";
import {
  getSecurityConfig,
  setBiometryEnabled,
  getAutoLockEnabled,
  setAutoLockEnabled,
} from "@/security/securityStorage";
import { isBiometryAvailable } from "@/security/securityBiometry";
import { handleSecurityToggle as handleSecurityToggleFlow } from "@/security/securityFlowsEnableOnly";
import { openSetOrChangePinFlow } from "@/security/securityFlowsPinOnly";
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { disableSecurityFlow } from "@/security/securityFlowsDisableOnly";
import { handleBiometryToggle as handleBiometryToggleFlow } from "@/security/securityFlowsBiometryOnly";
import type { SecurityModalStackParamList } from "@/security/securityFlowsTypes";
import { useTranslation } from "react-i18next";
import { STORAGE_KEY, SUPPORTED_LANGUAGES, SupportedLanguage } from "@/i18n";
import { useSettings } from "@/settings/useSettings";
import { useOnboardingFlow } from "@/onboarding/flowContext";
import {
  setDisplayName,
  setHasInvestments,
  setInitialSeedDone,
  setOnboardingCompleted,
} from "@/onboarding/onboardingStorage";
import AppBackground from "@/ui/components/AppBackground";
import { GlassCardContainer, PrimaryPillButton, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBalancePro } from "@/features/pro/BalanceProProvider";

type StorageAccessFrameworkLike = {
  requestDirectoryPermissionsAsync?: () => Promise<{ granted: boolean; directoryUri?: string }>;
  createFileAsync: (parentUri: string, fileName: string, mimeType: string) => Promise<string>;
  writeAsStringAsync?: (fileUri: string, contents: string) => Promise<void>;
};

function findSecurityModalNavigation(
  navigation: NavigationProp<ParamListBase>
): NavigationProp<SecurityModalStackParamList> | undefined {
  let current: NavigationProp<ParamListBase> | undefined = navigation;
  while (current) {
    const state = current.getState?.();
    if (state?.routeNames?.includes("SetPinModal") && state.routeNames.includes("VerifyPinModal")) {
      return current as NavigationProp<SecurityModalStackParamList>;
    }
    current = current.getParent?.();
  }
  return undefined;
}

export default function SettingsScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [profileName, setProfileName] = useState("");
  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [chartMonths, setChartMonths] = useState(6);
  const [securityEnabled, setSecurityEnabledState] = useState(false);
  const [biometryEnabled, setBiometryEnabledState] = useState(false);
  const [pinHashExists, setPinHashExists] = useState(false);
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [autoLockEnabled, setAutoLockEnabledState] = useState(false);
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const securityModalNavigation = useMemo(
    () => findSecurityModalNavigation(navigation),
    [navigation]
  );
  const { mode, setMode } = useContext(ThemeContext);
  const { requestReplay } = useOnboardingFlow();
  const { t, i18n } = useTranslation();
  const { showInvestments, setShowInvestments, scrollBounceEnabled, setScrollBounceEnabled } = useSettings();
  const {
    activePlan,
    entitlementSource,
    isEntitlementStale,
    isPro,
    isReady,
    lastValidatedAt,
    refreshProStatus,
    resetEntitlementForTesting,
  } = useBalancePro();
  const isProDebugResetEnabled =
    Platform.OS === "ios" && (__DEV__ || process.env.EXPO_PUBLIC_ENABLE_PRO_DEBUG_RESET === "true");
  const [isRefreshingBalancePro, setIsRefreshingBalancePro] = useState(false);

  const currentLanguage = (i18n.resolvedLanguage ?? i18n.language ?? "it") as SupportedLanguage;
  const languageOptions = useMemo(
    () =>
      SUPPORTED_LANGUAGES.map((lang) => ({
        value: lang,
        label: t(`settings.preferences.language.${lang}`, {
          defaultValue: lang.toUpperCase(),
        }),
      })),
    [t]
  );

  const handleLanguageChange = useCallback(
    async (next: SupportedLanguage) => {
      if (next === currentLanguage) return;
      await AsyncStorage.setItem(STORAGE_KEY, next);
      await i18n.changeLanguage(next);
    },
    [currentLanguage, i18n]
  );

  const cycleLanguage = useCallback(() => {
    const index = SUPPORTED_LANGUAGES.indexOf(currentLanguage);
    const next = SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length];
    void handleLanguageChange(next);
  }, [currentLanguage, handleLanguageChange]);

  const activePlanLabel = useMemo(() => {
    if (activePlan === "yearly") {
      return t("settings.balancePro.planYearly", {
        defaultValue: "annuale",
      });
    }

    if (activePlan === "monthly") {
      return t("settings.balancePro.planMonthly", {
        defaultValue: "mensile",
      });
    }

    return null;
  }, [activePlan, t]);

  const balanceProStatusTitle = useMemo(() => {
    if (!isReady || isRefreshingBalancePro) {
      return t("settings.balancePro.statusChecking", {
        defaultValue: "Sto verificando il tuo piano...",
      });
    }

    return isPro
      ? t("settings.balancePro.statusActive", {
          defaultValue: "Balance Pro attivo",
        })
      : t("settings.balancePro.statusFree", {
          defaultValue: "Piano Free",
        });
  }, [isPro, isReady, isRefreshingBalancePro, t]);

  const balanceProSummary = useMemo(() => {
    if (!isReady || isRefreshingBalancePro) {
      return t("settings.balancePro.summaryChecking", {
        defaultValue: "Sto chiedendo conferma ad Apple sullo stato dell'abbonamento.",
      });
    }

    if (isPro) {
      return activePlanLabel
        ? t("settings.balancePro.summaryActivePlan", {
            defaultValue: "Abbonamento attivo sul piano {{plan}}.",
            plan: activePlanLabel,
          })
        : t("settings.balancePro.summaryActive", {
            defaultValue: "Abbonamento attivo.",
          });
    }

    return t("settings.balancePro.summaryFree", {
      defaultValue: "Sblocca wallet illimitati e insight avanzati con Balance Pro.",
    });
  }, [activePlanLabel, isPro, isReady, isRefreshingBalancePro, t]);

  const balanceProSourceLabel = useMemo(() => {
    if (!isReady) {
      return t("settings.balancePro.sourceChecking", {
        defaultValue: "Origine stato: controllo iniziale in corso",
      });
    }

    if (entitlementSource === "store") {
      return t("settings.balancePro.sourceStore", {
        defaultValue: "Origine stato: confermato da Apple",
      });
    }

    return t("settings.balancePro.sourceCache", {
      defaultValue: "Origine stato: cache locale del dispositivo",
    });
  }, [entitlementSource, isReady, t]);

  const balanceProSourceHelper = useMemo(() => {
    if (!isReady) {
      return null;
    }

    if (entitlementSource === "store") {
      return t("settings.balancePro.sourceStoreHelper", {
        defaultValue: "Questo stato arriva dallo store Apple.",
      });
    }

    if (isEntitlementStale) {
      return t("settings.balancePro.sourceCacheStaleHelper", {
        defaultValue: "Questo stato arriva dal cache locale e potrebbe essere datato. Tocca \"Controlla adesso\".",
      });
    }

    return t("settings.balancePro.sourceCacheHelper", {
      defaultValue: "Questo stato arriva dal cache locale. Tocca \"Controlla adesso\" per verificare con Apple.",
    });
  }, [entitlementSource, isEntitlementStale, isReady, t]);

  const balanceProLastCheckLabel = useMemo(() => {
    return t("settings.balancePro.lastCheck", {
      defaultValue: "Ultimo controllo: {{value}}",
      value: lastValidatedAt > 0 ? new Date(lastValidatedAt).toLocaleString() : "mai",
    });
  }, [lastValidatedAt, t]);

  const load = useCallback(async () => {
    const [name, prefill, points] = await Promise.all([
      getPreference("profile_name"),
      getPreference("prefill_snapshot"),
      getPreference("chart_points"),
    ]);
    setProfileName(name?.value ?? "");
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    const parsedPoints = points ? Number(points.value) : 6;
    const safePoints = Number.isFinite(parsedPoints) ? Math.min(12, Math.max(3, parsedPoints)) : 6;
    setChartMonths(safePoints);
  }, []);

  const updatePreference = async (key: string, value: string) => {
    await setPreference(key, value);
  };

  const handleOpenBalanceProPlans = useCallback(() => {
    navigation.navigate("Wallet", { openPaywall: true });
  }, [navigation]);

  const handleRefreshBalancePro = useCallback(async () => {
    if (isRefreshingBalancePro) {
      return;
    }

    setIsRefreshingBalancePro(true);
    try {
      await refreshProStatus();
    } catch (error) {
      console.warn("Failed to refresh Balance Pro status", error);
    } finally {
      setIsRefreshingBalancePro(false);
    }
  }, [isRefreshingBalancePro, refreshProStatus]);

  const confirmWipeAndReplace = async (titleKey: string, bodyKey: string): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        t(titleKey),
        t(bodyKey),
        [
          { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
          { text: t("common.confirm"), style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const confirmed = await confirmWipeAndReplace(
        "alerts.settings.import.title",
        "alerts.settings.import.body"
      );
      if (!confirmed) return;
      await importFromFile(result.assets[0].uri);
    } catch (error) {
      console.warn(error);
    }
  };

  const exportData = async () => {
  const fileName = "balance-export.json";
    try {
      const payload = (await exportToJson()) as ExportPayload;
      const json = JSON.stringify(payload, null, 2);
      const storageAccess =
        (FileSystem as typeof FileSystem & { StorageAccessFramework?: StorageAccessFrameworkLike })
          .StorageAccessFramework;
      if (Platform.OS === "android" && storageAccess?.requestDirectoryPermissionsAsync) {
        const permission = await storageAccess.requestDirectoryPermissionsAsync();
        if (!permission.granted || !permission.directoryUri) {
          return;
        }
        const fileUri = await storageAccess.createFileAsync(
          permission.directoryUri,
          fileName,
          "application/json"
        );
        if (storageAccess.writeAsStringAsync) {
          await storageAccess.writeAsStringAsync(fileUri, json);
        } else {
          await LegacyFileSystem.writeAsStringAsync(fileUri, json);
        }
        return;
      }
      const cacheDir =
        (FileSystem as typeof FileSystem & { cacheDirectory?: string }).cacheDirectory ??
        LegacyFileSystem.cacheDirectory;
      const docDir =
        (FileSystem as typeof FileSystem & { documentDirectory?: string }).documentDirectory ??
        LegacyFileSystem.documentDirectory;
      let baseDir =
        cacheDir ??
        docDir;
      if (!baseDir && FileSystem.getInfoAsync) {
        if (docDir) {
          const info = await FileSystem.getInfoAsync(docDir);
          if (info.exists) baseDir = docDir;
        }
        if (!baseDir && cacheDir) {
          const info = await FileSystem.getInfoAsync(cacheDir);
          if (info.exists) baseDir = cacheDir;
        }
      }
      if (!baseDir) {
        return;
      }
      const path = `${baseDir}${fileName}`;
      await LegacyFileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: t("alerts.settings.export.title"),
        });
        return;
      }
    } catch (error) {
      console.warn(error);
    }
  };

  const confirmReset = async (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        t("alerts.settings.reset.title"),
        t("alerts.settings.reset.body"),
        [
          { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
          { text: t("settings.reset"), style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

  const resetData = async () => {
    const confirmed = await confirmReset();
    if (!confirmed) return;
    await withTransaction(async (db) => {
      const tables = [
        "snapshot_lines",
        "snapshots",
        "income_entries",
        "expense_entries",
        "wallets",
        "expense_categories",
        "preferences",
      ];
      for (const table of tables) {
        await db.runAsync(`DELETE FROM ${table}`);
      }
    });
    await setDisplayName("");
    await setHasInvestments(false);
    await setInitialSeedDone(false);
    await setOnboardingCompleted(false);
    await setShowInvestments(false);
    requestReplay({ seed: true });
    emitDataReset();
  };

  const confirmResetBalanceProTesting = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        t("settings.balanceProTesting.resetTitle", {
          defaultValue: "Reset Balance Pro di test?",
        }),
        t("settings.balanceProTesting.resetBody", {
          defaultValue:
            "Cancella solo il cache locale di Balance Pro e lo stato del welcome. Non annulla l'abbonamento su App Store. Se lo store risponde ancora con un abbonamento attivo, l'app tornerà Pro al prossimo controllo.",
        }),
        [
          { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
          {
            text: t("settings.balanceProTesting.resetCta", {
              defaultValue: "Reset test",
            }),
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true }
      );
    });
  }, [t]);

  const handleResetBalanceProTesting = useCallback(async () => {
    const confirmed = await confirmResetBalanceProTesting();
    if (!confirmed) {
      return;
    }

    try {
      await resetEntitlementForTesting();
      Alert.alert(
        t("settings.balanceProTesting.doneTitle", {
          defaultValue: "Reset completato",
        }),
        t("settings.balanceProTesting.doneBody", {
          defaultValue:
            "Lo stato locale di Balance Pro è stato azzerato. Ora torna ai wallet e prova di nuovo ad aprire il paywall.",
        })
      );
    } catch (error) {
      console.warn("Failed to reset Balance Pro testing state", error);
      Alert.alert(
        t("settings.balanceProTesting.errorTitle", {
          defaultValue: "Reset non riuscito",
        }),
        t("settings.balanceProTesting.errorBody", {
          defaultValue: "Non sono riuscito a pulire lo stato locale di Balance Pro. Riprova.",
        })
      );
    }
  }, [confirmResetBalanceProTesting, resetEntitlementForTesting, t]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshSecurityState = useCallback(async () => {
    const config = await getSecurityConfig();
    const available = await isBiometryAvailable();
    if (!available && config.biometryEnabled) {
      await setBiometryEnabled(false);
    }
    setSecurityEnabledState(config.securityEnabled);
    setBiometryEnabledState(available ? config.biometryEnabled : false);
    setPinHashExists(Boolean(config.pinHash));
    setBiometryAvailable(available);
    setAutoLockEnabledState(config.autoLockEnabled);
  }, []);

  useEffect(() => {
    refreshSecurityState();
  }, [refreshSecurityState]);

  const handleSecurityToggle = useCallback(
    async (next: boolean) => {
      if (!securityModalNavigation) {
        return;
      }
      await handleSecurityToggleFlow(
        next,
        securityModalNavigation as NavigationProp<Pick<SecurityModalStackParamList, "SetPinModal">>
      );
      await refreshSecurityState();
    },
    [refreshSecurityState, securityModalNavigation]
  );

  const handleBiometryToggle = useCallback(
    async (next: boolean) => {
      await handleBiometryToggleFlow(next, securityEnabled);
      await refreshSecurityState();
    },
    [refreshSecurityState, securityEnabled]
  );

  const handleAutoLockToggle = useCallback(async (next: boolean) => {
    await setAutoLockEnabled(next);
    setAutoLockEnabledState(next);
  }, []);

  const handleChangeOrSetPin = useCallback(() => {
    if (!securityModalNavigation) {
      return;
    }
    void openSetOrChangePinFlow(securityModalNavigation);
  }, [securityModalNavigation]);

  const handleDisableCode = useCallback(() => {
    if (!securityModalNavigation) {
      return;
    }
    void disableSecurityFlow(
      securityModalNavigation as NavigationProp<Pick<SecurityModalStackParamList, "VerifyPinModal">>
    );
  }, [securityModalNavigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshSecurityState();
      return () => {
        Keyboard.dismiss();
      };
    }, [load, refreshSecurityState])
  );

  const maxNicknameLength = 7;
  const limitNickname = (value: string, max: number) => {
    try {
      // Prefer grapheme segmentation when available (emoji-safe).
      const Seg = (Intl as typeof Intl & { Segmenter?: any }).Segmenter;
      if (Seg) {
        const segmenter = new Seg(undefined, { granularity: "grapheme" });
        const parts = Array.from(segmenter.segment(value), (part: { segment: string }) => part.segment);
        return parts.slice(0, max).join("");
      }
    } catch {
      // ignore and fallback
    }
    return Array.from(value).slice(0, max).join("");
  };
  const countGraphemes = (value: string) => {
    try {
      const Seg = (Intl as typeof Intl & { Segmenter?: any }).Segmenter;
      if (Seg) {
        const segmenter = new Seg(undefined, { granularity: "grapheme" });
        return Array.from(segmenter.segment(value)).length;
      }
    } catch {
      // ignore and fallback
    }
    return Array.from(value).length;
  };
  const nicknameCount = countGraphemes(profileName);

  const inputProps = {
    mode: "outlined" as const,
    outlineColor: tokens.colors.glassBorder,
    activeOutlineColor: tokens.colors.accent,
    textColor: tokens.colors.text,
    style: { backgroundColor: tokens.colors.glassBg },
  };
  return (
    <AppBackground>
      <ScrollView
        bounces={scrollBounceEnabled}
        alwaysBounceVertical={scrollBounceEnabled}
        overScrollMode={scrollBounceEnabled ? "always" : "never"}
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
      >
        <GlassCardContainer contentStyle={styles.cardContent}>
            <SectionHeader title={t("settings.profile.title")} />
            <TextInput
              label={t("settings.profile.nameLabel")}
              placeholder={t("settings.profile.nameLabel")}
              value={profileName}
              {...inputProps}
              right={<TextInput.Affix text={`${nicknameCount}/${maxNicknameLength}`} />}
              onChangeText={(value) => {
                const next = limitNickname(value, maxNicknameLength);
                setProfileName(next);
                void updatePreference("profile_name", next.trim());
              }}
            />
        </GlassCardContainer>

        <GlassCardContainer contentStyle={styles.cardContent}>
            <SectionHeader
              title={t("settings.balancePro.title", {
                defaultValue: "Balance Pro",
              })}
            />
            <Text style={[styles.balanceProTitle, { color: tokens.colors.text }]}>
              {balanceProStatusTitle}
            </Text>
            <Text style={[styles.balanceProBody, { color: tokens.colors.text }]}>
              {balanceProSummary}
            </Text>
            <Text style={[styles.balanceProMeta, { color: tokens.colors.muted }]}>
              {balanceProSourceLabel}
            </Text>
            {balanceProSourceHelper ? (
              <Text style={[styles.balanceProMeta, { color: tokens.colors.muted }]}>
                {balanceProSourceHelper}
              </Text>
            ) : null}
            <Text style={[styles.balanceProMeta, { color: tokens.colors.muted }]}>
              {balanceProLastCheckLabel}
            </Text>
            <PrimaryPillButton
              label={isPro
                ? t("settings.balancePro.openPlans", {
                    defaultValue: "Apri i piani Balance Pro",
                  })
                : t("settings.balancePro.upgrade", {
                    defaultValue: "Fai l'upgrade del piano",
                  })}
              onPress={handleOpenBalanceProPlans}
              color={tokens.colors.accent}
              disabled={!isReady || isRefreshingBalancePro}
            />
            <SmallOutlinePillButton
              label={t("settings.balancePro.checkNow", {
                defaultValue: "Controlla adesso",
              })}
              onPress={() => {
                void handleRefreshBalancePro();
              }}
              color={tokens.colors.text}
              fullWidth
            />
        </GlassCardContainer>

        <GlassCardContainer style={styles.preferencesCard} contentStyle={styles.cardContent}>
            <SectionHeader title={t("settings.preferences.title")} />
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.darkTheme")}</Text>
              <Switch
                value={mode === "dark"}
                onValueChange={(value) => {
                  const next = value ? "dark" : "light";
                  setMode(next);
                  updatePreference("theme", next);
                }}
                color={tokens.colors.accent}
              />
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.prefillSnapshot")}</Text>
              <Switch
                value={prefillSnapshot}
                onValueChange={(value) => {
                  setPrefillSnapshot(value);
                  updatePreference("prefill_snapshot", String(value));
                }}
                color={tokens.colors.accent}
              />
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.showInvestments")}</Text>
              <Switch
                value={showInvestments}
                onValueChange={(value) => {
                  void setShowInvestments(value);
                }}
                color={tokens.colors.accent}
              />
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.scrollBounce")}</Text>
              <Switch
                value={scrollBounceEnabled}
                onValueChange={(value) => {
                  void setScrollBounceEnabled(value);
                }}
                color={tokens.colors.accent}
              />
            </View>
            <View style={[styles.row, styles.counterRow]}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.monthsInChart")}</Text>
              <View style={styles.counterControls}>
                <SmallOutlinePillButton
                  label=""
                  icon={<MaterialCommunityIcons name="minus" size={16} color={tokens.colors.text} />}
                  color={tokens.colors.text}
                  onPress={() => {
                    const next = Math.max(3, chartMonths - 1);
                    setChartMonths(next);
                    updatePreference("chart_points", String(next));
                  }}
                />
                <Text style={[styles.counterValue, { color: tokens.colors.text }]}>{chartMonths}</Text>
                <SmallOutlinePillButton
                  label=""
                  icon={<MaterialCommunityIcons name="plus" size={16} color={tokens.colors.text} />}
                  color={tokens.colors.text}
                  onPress={() => {
                    const next = Math.min(12, chartMonths + 1);
                    setChartMonths(next);
                    updatePreference("chart_points", String(next));
                  }}
                />
              </View>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.languageLabel")}</Text>
              <View style={styles.segmentControl}>
                <Pressable
                  onPress={cycleLanguage}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.preferences.languageLabel")}
                  style={({ pressed }) => [
                    styles.languageSelector,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.languageSelectorText, { color: tokens.colors.accent }]}>
                    {languageOptions.find((option) => option.value === currentLanguage)?.label ?? currentLanguage}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={tokens.colors.accent} />
                </Pressable>
              </View>
            </View>
        </GlassCardContainer>

        <SecuritySettingsSection
          securityEnabled={securityEnabled}
          biometryEnabled={biometryEnabled}
          pinHashExists={pinHashExists}
          biometryAvailable={biometryAvailable}
          onRequestEnableSecurity={handleSecurityToggle}
          onRequestChangeOrSetPin={handleChangeOrSetPin}
          onRequestDisableSecurity={handleDisableCode}
          onToggleBiometry={handleBiometryToggle}
          autoLockEnabled={autoLockEnabled}
          onToggleAutoLock={handleAutoLockToggle}
        />

        <GlassCardContainer contentStyle={styles.cardContent}>
            <SectionHeader title={t("settings.data.title")} />
            <PrimaryPillButton label={t("settings.data.export")} onPress={exportData} color={tokens.colors.accent} />
            <SmallOutlinePillButton label={t("settings.data.import")} onPress={importData} color={tokens.colors.text} fullWidth />
            <SmallOutlinePillButton label={t("settings.reset")} onPress={resetData} color={tokens.colors.red} fullWidth />
        </GlassCardContainer>

        {isProDebugResetEnabled ? (
          <GlassCardContainer contentStyle={styles.cardContent}>
            <SectionHeader
              title={t("settings.balanceProTesting.title", {
                defaultValue: "Balance Pro Test",
              })}
            />
            <Text style={[styles.debugText, { color: tokens.colors.text }]}>
              {t("settings.balanceProTesting.status", {
                defaultValue: "Stato locale: {{status}}",
                status: isPro ? "PRO" : "FREE",
              })}
            </Text>
            <Text style={[styles.debugText, { color: tokens.colors.muted }]}>
              {t("settings.balanceProTesting.source", {
                defaultValue: "Origine: {{source}} · cache stale: {{stale}}",
                source: entitlementSource,
                stale: isEntitlementStale ? "si" : "no",
              })}
            </Text>
            <Text style={[styles.debugText, { color: tokens.colors.muted }]}>
              {t("settings.balanceProTesting.lastCheck", {
                defaultValue: "Ultimo controllo: {{value}}",
                value: lastValidatedAt > 0 ? new Date(lastValidatedAt).toLocaleString() : "mai",
              })}
            </Text>
            <SmallOutlinePillButton
              label={t("settings.balanceProTesting.resetButton", {
                defaultValue: "Reset cache Pro di test",
              })}
              onPress={handleResetBalanceProTesting}
              color={tokens.colors.red}
              fullWidth
            />
          </GlassCardContainer>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  cardContent: {
    gap: 12,
  },
  preferencesCard: {},

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  counterRow: {
    alignItems: "center",
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  counterValue: {
    minWidth: 24,
    textAlign: "center",
    fontWeight: "700",
  },
  onboardingRow: {
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    gap: 12,
  },
  onboardingText: {
    flex: 1,
  },
  onboardingTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  onboardingSubtitle: {
    fontSize: 12,
  },
  segmentControl: {
    alignItems: "flex-end",
  },
  languageSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  languageSelectorText: {
    fontSize: 13,
    fontWeight: "600",
  },
  balanceProTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  balanceProBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  balanceProMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  debugText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
