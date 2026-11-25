/// <reference types="react" />
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, Image, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Snackbar, Switch, Text, TextInput } from "react-native-paper";
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
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { STORAGE_KEY, SUPPORTED_LANGUAGES, SupportedLanguage, resolveSupportedLanguage } from "@/i18n";
import { useSettings } from "@/settings/useSettings";
import { useOnboardingFlow } from "@/onboarding/flowContext";
import {
  setDisplayName,
  setHasInvestments,
  setInitialSeedDone,
  setOnboardingCompleted,
} from "@/onboarding/onboardingStorage";
import AppBackground from "@/ui/components/AppBackground";
import { FrequencyPillGroup, GlassCardContainer, PrimaryPillButton, SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useBalancePro } from "@/features/pro/BalanceProProvider";
import type { BalanceProPlanId } from "@/config/entitlements";
import { FREE_WALLET_LIMIT } from "@/config/entitlements";
import TutorialCatalog from "@/features/tutorials/TutorialCatalog";
import { FREE_RADAR } from "@/features/news/newsPreferences";
import { openPrivacyPolicyLink, openTermsOfUseLink } from "@/config/storeLinks";
import {
  cancelSnapshotReminderSchedule,
  requestSnapshotReminderPermissions,
  SNAPSHOT_REMINDER_ENABLED_KEY,
  SNAPSHOT_REMINDER_FREQUENCY_KEY,
  syncSnapshotReminderSchedule,
} from "@/notifications/snapshotReminder";
import {
  coerceSnapshotReminderFrequency,
  DEFAULT_SNAPSHOT_REMINDER_FREQUENCY,
  type SnapshotReminderFrequency,
} from "@/domain/snapshotReminder";
import LimitReachedModal from "@/ui/components/LimitReachedModal";
import ProWelcomeModal from "@/ui/components/ProWelcomeModal";

type StorageAccessFrameworkLike = {
  requestDirectoryPermissionsAsync?: () => Promise<{ granted: boolean; directoryUri?: string }>;
  createFileAsync: (parentUri: string, fileName: string, mimeType: string) => Promise<string>;
  writeAsStringAsync?: (fileUri: string, contents: string) => Promise<void>;
};

type SettingsSection = "plan" | "profile" | "tutorials" | "general" | "notifications" | "security" | "data";

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
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [profileName, setProfileName] = useState("");
  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [chartMonths, setChartMonths] = useState(6);
  const [snapshotReminderEnabled, setSnapshotReminderEnabled] = useState(false);
  const [snapshotReminderFrequency, setSnapshotReminderFrequency] = useState<SnapshotReminderFrequency>(
    DEFAULT_SNAPSHOT_REMINDER_FREQUENCY
  );
  const [settingsPaywallVisible, setSettingsPaywallVisible] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<BalanceProPlanId>("yearly");
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [proWelcomeVisible, setProWelcomeVisible] = useState(false);
  const [isDismissingProWelcome, setIsDismissingProWelcome] = useState(false);
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
  useFocusEffect(useCallback(() => {
    if (!activeSection) return undefined;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      setActiveSection(null);
      return true;
    });
    return () => listener.remove();
  }, [activeSection]));
  const {
    showInvestments,
    setShowInvestments,
    showInvestmentAvailability,
    setShowInvestmentAvailability,
    trackPension,
    setTrackPension,
    scrollBounceEnabled,
    setScrollBounceEnabled,
    showGreeting,
    setShowGreeting,
  } = useSettings();
  const {
    isPro,
    isReady,
    isStoreAvailable,
    isStoreLoading,
    storeErrorCode,
    storeErrorMessage,
    isPurchasePending,
    isRestorePending,
    availablePlans,
    prepareStore,
    purchase,
    restore,
    markProWelcomeSeen,
  } = useBalancePro();

  const currentLanguage = resolveSupportedLanguage(i18n.resolvedLanguage ?? i18n.language ?? "en");
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
  const snapshotReminderOptions = useMemo(
    () => [
      {
        value: "daily",
        label: t("settings.preferences.snapshotReminder.frequencies.daily", {
          defaultValue: "Giornaliera",
        }),
      },
      {
        value: "weekly",
        label: t("settings.preferences.snapshotReminder.frequencies.weekly", {
          defaultValue: "Settimanale",
        }),
      },
      {
        value: "monthly",
        label: t("settings.preferences.snapshotReminder.frequencies.monthly", {
          defaultValue: "Mensile",
        }),
      },
    ],
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

  const balanceProStatusTitle = useMemo(() => {
    return isPro
      ? t("settings.balancePro.statusActive", {
          defaultValue: "Balance Pro",
        })
      : t("settings.balancePro.statusFree", {
          defaultValue: "Balance Free",
        });
  }, [isPro, t]);



  const load = useCallback(async () => {
    const [name, prefill, points, reminderEnabledPref, reminderFrequencyPref] = await Promise.all([
      getPreference("profile_name"),
      getPreference("prefill_snapshot"),
      getPreference("chart_points"),
      getPreference(SNAPSHOT_REMINDER_ENABLED_KEY),
      getPreference(SNAPSHOT_REMINDER_FREQUENCY_KEY),
    ]);
    setProfileName(name?.value ?? "");
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    const parsedPoints = points ? Number(points.value) : 6;
    const safePoints = Number.isFinite(parsedPoints) ? Math.min(12, Math.max(3, parsedPoints)) : 6;
    setChartMonths(safePoints);
    setSnapshotReminderEnabled(reminderEnabledPref?.value === "true");
    setSnapshotReminderFrequency(coerceSnapshotReminderFrequency(reminderFrequencyPref?.value));
  }, []);

  const updatePreference = async (key: string, value: string) => {
    await setPreference(key, value);
  };

  const handleSnapshotReminderToggle = useCallback(
    async (next: boolean) => {
      if (next) {
        const permissions = await requestSnapshotReminderPermissions();
        if (!permissions.granted) {
          setSnapshotReminderEnabled(false);
          await updatePreference(SNAPSHOT_REMINDER_ENABLED_KEY, "false");
          Alert.alert(
            t("settings.preferences.snapshotReminder.permissionTitle", {
              defaultValue: "Permesso notifiche richiesto",
            }),
            t("settings.preferences.snapshotReminder.permissionBody", {
              defaultValue:
                "Abilita le notifiche di Balance dalle impostazioni del dispositivo per ricevere i promemoria snapshot.",
            }),
            permissions.canAskAgain
              ? [{ text: t("common.ok") }]
              : [
                  { text: t("common.cancel") },
                  {
                    text: t("common.openSettings", { defaultValue: "Apri impostazioni" }),
                    onPress: () => {
                      void Linking.openSettings();
                    },
                  },
                ]
          );
          return;
        }
      }

      setSnapshotReminderEnabled(next);
      await updatePreference(SNAPSHOT_REMINDER_ENABLED_KEY, String(next));
      await syncSnapshotReminderSchedule({
        enabled: next,
        frequency: snapshotReminderFrequency,
      });
    },
    [snapshotReminderFrequency, t]
  );

  const handleSnapshotReminderFrequencyChange = useCallback(
    async (next: string) => {
      const frequency = coerceSnapshotReminderFrequency(next);
      setSnapshotReminderFrequency(frequency);
      await updatePreference(SNAPSHOT_REMINDER_FREQUENCY_KEY, frequency);
      if (snapshotReminderEnabled) {
        await syncSnapshotReminderSchedule({
          enabled: true,
          frequency,
        });
      }
    },
    [snapshotReminderEnabled]
  );

  const selectedPlan = availablePlans.find((plan) => plan.planId === selectedPlanId) ?? null;
  const canPurchaseSelectedPlan = Boolean(isStoreAvailable && selectedPlan?.product);

  const handlePurchasePro = useCallback(async () => {
    if (!canPurchaseSelectedPlan || isStoreLoading || !isReady) {
      setPurchaseNotice(
        t("wallets.actions.limitStatusPriceUnavailable", {
          defaultValue: "I prezzi di Balance Pro non sono disponibili in questo momento. Riprova tra poco.",
        })
      );
      return;
    }

    const result = await purchase(selectedPlanId);
    switch (result.status) {
      case "success":
        setSettingsPaywallVisible(false);
        if (result.showWelcome) {
          setPurchaseNotice(null);
          setProWelcomeVisible(true);
          return;
        }
        setPurchaseNotice(t("wallets.actions.purchaseSuccess", { defaultValue: "Balance Pro attivato." }));
        return;
      case "cancelled":
        setPurchaseNotice(t("wallets.actions.purchaseCancelled", { defaultValue: "Acquisto annullato." }));
        return;
      case "pending":
        setPurchaseNotice(
          t("wallets.actions.purchasePending", {
            defaultValue: "L'abbonamento è in attesa di conferma. Ti avviseremo appena Balance Pro sarà disponibile.",
          })
        );
        return;
      case "product-unavailable":
        setPurchaseNotice(
          t("wallets.actions.productUnavailable", {
            defaultValue: "Questo piano non è disponibile al momento. Riprova tra poco.",
          })
        );
        return;
      case "store-unavailable":
        setPurchaseNotice(t("wallets.actions.storeUnavailable", { defaultValue: "Store non disponibile. Riprova più tardi." }));
        return;
      default:
        setPurchaseNotice(
          t("wallets.actions.purchaseError", {
            defaultValue: "Impossibile completare l'acquisto ora. Riprova tra poco.",
          })
        );
    }
  }, [canPurchaseSelectedPlan, isReady, isStoreLoading, purchase, selectedPlanId, t]);

  const handleRestorePurchases = useCallback(async () => {
    const result = await restore();
    switch (result.status) {
      case "restored":
        setPurchaseNotice(t("wallets.actions.restoreSuccess", { defaultValue: "Abbonamento ripristinato." }));
        setSettingsPaywallVisible(false);
        return;
      case "nothing-to-restore":
        setPurchaseNotice(t("wallets.actions.restoreEmpty", { defaultValue: "Nessun acquisto da ripristinare." }));
        return;
      case "store-unavailable":
        setPurchaseNotice(t("wallets.actions.storeUnavailable", { defaultValue: "Store non disponibile. Riprova più tardi." }));
        return;
      default:
        setPurchaseNotice(
          t("wallets.actions.restoreError", {
            defaultValue: "Impossibile ripristinare gli acquisti ora. Riprova più tardi.",
          })
        );
      }
  }, [restore, t]);

  const handleRetryStore = useCallback(() => {
    void prepareStore();
  }, [prepareStore]);

  const handleOpenExternalStoreLink = useCallback(
    async (openLink: () => Promise<void>) => {
      try {
        await openLink();
      } catch (error) {
        console.warn("Failed to open Balance Pro legal link", error);
        setPurchaseNotice(
          t("wallets.actions.storeError", {
            defaultValue: "Impossibile aprire il link.",
          })
        );
      }
    },
    [t]
  );

  const handleOpenPrivacyPolicy = useCallback(() => {
    void handleOpenExternalStoreLink(openPrivacyPolicyLink);
  }, [handleOpenExternalStoreLink]);

  const handleOpenTermsOfUse = useCallback(() => {
    void handleOpenExternalStoreLink(openTermsOfUseLink);
  }, [handleOpenExternalStoreLink]);

  const handleDismissProWelcome = useCallback(() => {
    if (isDismissingProWelcome) {
      return;
    }

    setIsDismissingProWelcome(true);
    void markProWelcomeSeen()
      .catch((error) => {
        console.warn("Failed to persist Balance Pro welcome state", error);
      })
      .finally(() => {
        setIsDismissingProWelcome(false);
        setProWelcomeVisible(false);
      });
  }, [isDismissingProWelcome, markProWelcomeSeen]);

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
      await syncSnapshotReminderSchedule();
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
    await cancelSnapshotReminderSchedule();
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
  const paywallLegalLinks = useMemo(
    () => [
      {
        key: "privacy",
        label: t("wallets.actions.privacyPolicy", { defaultValue: "Privacy Policy" }),
        onPress: handleOpenPrivacyPolicy,
      },
      {
        key: "terms",
        label: t("wallets.actions.termsOfUse", { defaultValue: "Terms of Use" }),
        onPress: handleOpenTermsOfUse,
      },
    ],
    [handleOpenPrivacyPolicy, handleOpenTermsOfUse, t]
  );
  const shouldShowRetryStore = Boolean((storeErrorCode || storeErrorMessage || !isStoreAvailable) && isReady && !isStoreLoading);
  const paywallStatusMessage = !isReady
    ? t("wallets.actions.limitStatusSyncing", {
        defaultValue: "Sto verificando il tuo stato Balance Pro...",
      })
    : isStoreLoading
    ? t("wallets.actions.limitStatusSyncing", {
        defaultValue: "Sto verificando il tuo stato Balance Pro...",
      })
    : storeErrorCode === "empty-products" || !canPurchaseSelectedPlan
    ? t("wallets.actions.limitStatusPriceUnavailable", {
        defaultValue: "I prezzi di Balance Pro non sono disponibili in questo momento. Riprova tra poco o ripristina gli acquisti.",
      })
    : storeErrorMessage
    ? t("wallets.actions.storeUnavailable", { defaultValue: "Store non disponibile. Riprova più tardi." })
    : undefined;
  const sections: { id: SettingsSection; title: string; subtitle: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }[] = [
    { id: "tutorials", title: t("tutorials.title"), subtitle: t("tutorials.entry"), icon: "play-box-outline", color: "#A885FF" },
    { id: "profile", title: t("settings.profile.title"), subtitle: t("settings.menu.profile", { defaultValue: "Nickname e lingua" }), icon: "account-outline", color: "#A885FF" },
    { id: "general", title: t("settings.preferences.title"), subtitle: t("settings.menu.general", { defaultValue: "Aspetto, dashboard e preferenze" }), icon: "tune-variant", color: "#69A9FF" },
    { id: "notifications", title: t("settings.notifications.title"), subtitle: t("settings.menu.notifications", { defaultValue: "Promemoria e frequenza" }), icon: "bell-outline", color: "#F0B771" },
    { id: "security", title: t("settings.menu.securityTitle", { defaultValue: "Sicurezza" }), subtitle: t("settings.menu.security", { defaultValue: "Codice, biometria e blocco" }), icon: "shield-lock-outline", color: "#68D4A3" },
    { id: "data", title: t("settings.data.title"), subtitle: t("settings.menu.data", { defaultValue: "Esporta, importa o cancella i dati" }), icon: "database-outline", color: "#F48F95" },
  ];
  const selectedSection = sections.find((section) => section.id === activeSection);
  const sectionTitle = activeSection === "plan" ? t("settings.balancePro.title") : selectedSection?.title;
  const openSection = (section: SettingsSection | null) => {
    Keyboard.dismiss();
    setActiveSection(section);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  };
  return (
    <AppBackground>
      <>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          bounces={scrollBounceEnabled}
          alwaysBounceVertical={scrollBounceEnabled}
          overScrollMode={scrollBounceEnabled ? "always" : "never"}
          contentContainerStyle={[
            styles.container,
            { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: 12 },
          ]}
        >
          {!activeSection ? <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("settings.balancePro.title") + ", " + balanceProStatusTitle}
              disabled={!isReady}
              onPress={() => {
                openSection("plan");
                if (!isPro && !isStoreLoading && !availablePlans.some((plan) => plan.product)) void prepareStore();
              }}
              style={({ pressed }) => [styles.planCard, { backgroundColor: tokens.colors.accent + "16", borderColor: tokens.colors.accent + "45", opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.menuText}>
                <Text style={[styles.groupTitle, { color: tokens.colors.accent }]}>{t("settings.balancePro.title")}</Text>
                <Text style={[styles.planName, { color: tokens.colors.text }]}>{balanceProStatusTitle}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={tokens.colors.accent} />
            </Pressable>
            <View style={styles.menuList}>
              {sections.map((section) => <Pressable key={section.id} accessibilityRole="button" accessibilityLabel={section.title} onPress={() => openSection(section.id)} style={({ pressed }) => [styles.menuRow, { backgroundColor: tokens.colors.glassBg, borderColor: tokens.colors.glassBorder, opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.menuIcon, { backgroundColor: `${section.color}22` }]}><MaterialCommunityIcons name={section.icon} size={22} color={section.color} /></View>
                <View style={styles.menuText}><Text style={[styles.menuTitle, { color: tokens.colors.text }]}>{section.title}</Text><Text numberOfLines={2} style={[styles.menuSubtitle, { color: tokens.colors.muted }]}>{section.subtitle}</Text></View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={tokens.colors.muted} />
              </Pressable>)}
            </View>
          </> : <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("settings.menu.back")}
            onPress={() => openSection(null)}
            style={styles.backRow}
          >
            <View style={[styles.backIcon, { backgroundColor: `${tokens.colors.accent}20` }]}><MaterialCommunityIcons name="arrow-left" size={20} color={tokens.colors.accent} /></View>
            <View style={styles.menuText}><Text style={[styles.detailTitle, { color: tokens.colors.text }]}>{sectionTitle}</Text></View>
          </Pressable>}

          {activeSection === "plan" && isPro ? <GlassCardContainer contentStyle={styles.cardContent}>
            <Text style={[styles.balanceProTitle, { color: tokens.colors.text }]}>
              {balanceProStatusTitle}
            </Text>
            <Text style={[styles.balanceProBody, { color: tokens.colors.text }]}>
              {t("settings.balancePro.summaryActive")}
            </Text>
        </GlassCardContainer> : null}

        {activeSection === "plan" && !isPro ? (
          <>
            <View style={[styles.offerHero, { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.glassBorder }]}>
              <View style={styles.offerArt}>
                <Image source={require("../../../assets/pro/balance-pro-hero.png")} resizeMode="contain" accessible={false} style={styles.offerArtImage} />
              </View>
              <Text variant="labelLarge" style={{ color: tokens.colors.muted }}>
                {t("settings.balancePro.currentPlan", { plan: balanceProStatusTitle })}
              </Text>
              <Text accessibilityRole="header" style={[styles.planName, { color: tokens.colors.text }]}>
                {t("settings.balancePro.goPro")}
              </Text>
            </View>
            <View style={[styles.offerFeature, { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.glassBorder }]}>
              <View style={styles.offerFeatureHeader}>
                <View style={[styles.offerFeatureIcon, { backgroundColor: tokens.colors.accent + "1C" }]}>
                  <MaterialCommunityIcons name="wallet-bifold-outline" size={22} color={tokens.colors.accent} />
                </View>
                <Text accessibilityRole="header" variant="titleLarge" style={[styles.offerFeatureTitle, { color: tokens.colors.text }]}>
                  {t("wallets.actions.limitBenefitUnlimited")}
                </Text>
              </View>
              <Text variant="bodyMedium" style={{ color: tokens.colors.muted }}>{t("settings.balancePro.offerBody")}</Text>
              <View style={[styles.planComparison, { borderColor: tokens.colors.glassBorder }]}>
                <View style={styles.offerColumn}>
                  <Text variant="labelMedium" style={{ color: tokens.colors.muted }}>Balance Free</Text>
                  <Text variant="titleSmall" style={{ color: tokens.colors.text }}>
                    {t("settings.balancePro.walletLimit", { count: FREE_WALLET_LIMIT })}
                  </Text>
                </View>
                <View style={[styles.offerColumn, { backgroundColor: tokens.colors.accent + "14" }]}>
                  <Text variant="labelMedium" style={{ color: tokens.colors.accent }}>Balance Pro</Text>
                  <Text variant="titleSmall" style={{ color: tokens.colors.text }}>{t("settings.balancePro.walletPro")}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.offerFeature, { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.glassBorder }]}>
              <View style={styles.offerFeatureHeader}>
                <View style={[styles.offerFeatureIcon, { backgroundColor: tokens.colors.accent + "1C" }]}>
                  <MaterialCommunityIcons name="newspaper-variant-outline" size={22} color={tokens.colors.accent} />
                </View>
                <Text accessibilityRole="header" variant="titleLarge" style={[styles.offerFeatureTitle, { color: tokens.colors.text }]}>
                  {t("news.briefing")}
                </Text>
              </View>
              <Text variant="bodyMedium" style={{ color: tokens.colors.muted }}>{t("settings.balancePro.radarBody")}</Text>
              <View style={[styles.planComparison, { borderColor: tokens.colors.glassBorder }]}>
                <View style={styles.offerColumn}>
                  <Text variant="labelMedium" style={{ color: tokens.colors.muted }}>Balance Free</Text>
                  <Text variant="titleSmall" style={{ color: tokens.colors.text }}>
                    {t("settings.balancePro.radarFree", FREE_RADAR)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: tokens.colors.muted }}>
                    {t("settings.balancePro.radarFreeChanges", FREE_RADAR)}
                  </Text>
                </View>
                <View style={[styles.offerColumn, { backgroundColor: tokens.colors.accent + "14" }]}>
                  <Text variant="labelMedium" style={{ color: tokens.colors.accent }}>Balance Pro</Text>
                  <Text variant="titleSmall" style={{ color: tokens.colors.text }}>{t("settings.balancePro.radarPro")}</Text>
                  <Text variant="bodySmall" style={{ color: tokens.colors.muted }}>{t("settings.balancePro.radarProChanges")}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.offerFeature, { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.glassBorder }]}>
              <Text accessibilityRole="header" variant="titleLarge" style={[styles.offerFeatureTitle, { color: tokens.colors.text }]}>
                {t("settings.balancePro.subscription")}
              </Text>
              {availablePlans.map((plan) => {
                const selected = plan.planId === selectedPlanId;
                const name = t(plan.planId === "yearly" ? "wallets.actions.planYearly" : "wallets.actions.planMonthly");
                const period = t(plan.planId === "yearly" ? "wallets.actions.planCycleYear" : "wallets.actions.planCycleMonth");
                return (
                  <Pressable key={plan.planId} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !plan.product }}
                    disabled={!plan.product} onPress={() => setSelectedPlanId(plan.planId)}
                    style={[styles.offerPlanOption, { borderColor: selected ? tokens.colors.accent : tokens.colors.glassBorder,
                      backgroundColor: selected ? tokens.colors.accent + "14" : tokens.colors.bg }]}>
                    <MaterialCommunityIcons name={selected ? "radiobox-marked" : "radiobox-blank"} size={22} color={selected ? tokens.colors.accent : tokens.colors.muted} />
                    <Text variant="titleMedium" style={[styles.offerPlanLabel, { color: tokens.colors.text }]}>{name}</Text>
                    <Text variant="bodyMedium" style={{ color: tokens.colors.text }}>
                      {plan.displayPrice ? t("settings.balancePro.recurringPrice", { price: plan.displayPrice, period }) : "—"}
                    </Text>
                  </Pressable>
                );
              })}
              {paywallStatusMessage && <Text variant="bodySmall" style={{ color: tokens.colors.muted }}>{paywallStatusMessage}</Text>}
              {shouldShowRetryStore && <SmallOutlinePillButton label={t("wallets.actions.retryStoreLoad")} color={tokens.colors.accent} onPress={handleRetryStore} />}
              <PrimaryPillButton label={t("settings.balancePro.goPro")} color={tokens.colors.accent}
                disabled={!canPurchaseSelectedPlan || isStoreLoading}
                onPress={() => setSettingsPaywallVisible(true)} />
              {!canPurchaseSelectedPlan && <SmallOutlinePillButton label={t("wallets.actions.restorePurchases")} color={tokens.colors.muted}
                onPress={() => { if (!isRestorePending) void handleRestorePurchases(); }} />}
            </View>
          </>
        ) : null}

        {activeSection === "profile" ? <GlassCardContainer contentStyle={styles.cardContent}>
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
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.showGreeting", { defaultValue: "Mostra il saluto nella dashboard" })}</Text>
              <Switch accessibilityLabel={t("settings.preferences.showGreeting", { defaultValue: "Mostra il saluto nella dashboard" })} value={showGreeting} onValueChange={(value) => { void setShowGreeting(value); }} color={tokens.colors.accent} />
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>
                {t("settings.profile.languageLabel", {
                  defaultValue: "Lingua",
                })}
              </Text>
              <View style={styles.segmentControl}>
                <Pressable
                  onPress={cycleLanguage}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.profile.languageLabel", {
                    defaultValue: "Lingua",
                  })}
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
        </GlassCardContainer> : null}

        {activeSection === "tutorials" && <TutorialCatalog />}

        {activeSection === "notifications" ? <GlassCardContainer contentStyle={styles.cardContent}>
            <View style={[styles.row, styles.preferenceTopAlignedRow]}>
              <View style={styles.preferenceTextBlock}>
                <Text style={[styles.label, { color: tokens.colors.text }]}>
                  {t("settings.preferences.snapshotReminder.label", {
                    defaultValue: "Promemoria snapshot",
                  })}
                </Text>
                <Text style={[styles.helperText, { color: tokens.colors.muted }]}>
                  {t("settings.preferences.snapshotReminder.helper", {
                    defaultValue:
                      "Ricevi un promemoria locale alle 20:00 per aggiungere lo snapshot del giorno, in base alla frequenza scelta.",
                  })}
                </Text>
              </View>
              <Switch
                accessibilityLabel={t("settings.preferences.snapshotReminder.label")}
                value={snapshotReminderEnabled}
                onValueChange={(value) => {
                  void handleSnapshotReminderToggle(value);
                }}
                color={tokens.colors.accent}
              />
            </View>
            {snapshotReminderEnabled ? (
              <View style={styles.preferenceBlock}>
                <Text style={[styles.label, { color: tokens.colors.text }]}>
                  {t("settings.preferences.snapshotReminder.frequencyLabel", {
                    defaultValue: "Frequenza",
                  })}
                </Text>
                <FrequencyPillGroup
                  value={snapshotReminderFrequency}
                  options={snapshotReminderOptions}
                  onChange={(value) => {
                    void handleSnapshotReminderFrequencyChange(value);
                  }}
                />
              </View>
            ) : null}
        </GlassCardContainer> : null}

        {activeSection === "general" ? <>
          <GlassCardContainer contentStyle={styles.cardContent}>
            <Text accessibilityRole="header" style={[styles.groupTitle, { color: tokens.colors.accent }]}>{t("settings.preferences.appearanceGroup")}</Text>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>
                {t("settings.preferences.darkTheme")}
              </Text>
              <Switch
                accessibilityLabel={t("settings.preferences.darkTheme")}
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
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.scrollBounce")}</Text>
              <Switch
                accessibilityLabel={t("settings.preferences.scrollBounce")}
                value={scrollBounceEnabled}
                onValueChange={(value) => {
                  void setScrollBounceEnabled(value);
                }}
                color={tokens.colors.accent}
              />
            </View>
          </GlassCardContainer>
          <GlassCardContainer contentStyle={styles.cardContent}>
            <Text accessibilityRole="header" style={[styles.groupTitle, { color: tokens.colors.accent }]}>{t("settings.preferences.trackingGroup")}</Text>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.prefillSnapshot")}</Text>
              <Switch
                accessibilityLabel={t("settings.preferences.prefillSnapshot")}
                value={prefillSnapshot}
                onValueChange={(value) => {
                  setPrefillSnapshot(value);
                  updatePreference("prefill_snapshot", String(value));
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
          </GlassCardContainer>
          <GlassCardContainer contentStyle={styles.cardContent}>
            <Text accessibilityRole="header" style={[styles.groupTitle, { color: tokens.colors.accent }]}>{t("settings.preferences.investmentsGroup")}</Text>
            <View style={styles.row}>
              <Text style={[styles.label, { color: tokens.colors.text }]}>{t("settings.preferences.showInvestments")}</Text>
              <Switch
                accessibilityLabel={t("settings.preferences.showInvestments")}
                value={showInvestments}
                onValueChange={(value) => {
                  void setShowInvestments(value);
                }}
                color={tokens.colors.accent}
              />
            </View>
            {showInvestments ? (
              <View style={styles.row}>
                <View style={styles.preferenceTextBlock}>
                  <Text style={[styles.label, { color: tokens.colors.text }]}>
                    {t("settings.preferences.showInvestmentAvailability")}
                  </Text>
                  <Text style={[styles.helperText, { color: tokens.colors.muted }]}>
                    {t("settings.preferences.showInvestmentAvailabilityHint")}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={t("settings.preferences.showInvestmentAvailability")}
                value={showInvestmentAvailability}
                  onValueChange={(value) => {
                    void setShowInvestmentAvailability(value);
                  }}
                  color={tokens.colors.accent}
                />
              </View>
            ) : null}
            {showInvestments ? (
              <View style={styles.row}>
                <View style={styles.preferenceTextBlock}>
                  <Text style={[styles.label, { color: tokens.colors.text }]}>
                    {t("settings.preferences.trackPension")}
                  </Text>
                  <Text style={[styles.helperText, { color: tokens.colors.muted }]}>
                    {t("settings.preferences.trackPensionHint")}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={t("settings.preferences.trackPension")}
                value={trackPension}
                  onValueChange={(value) => {
                    void setTrackPension(value);
                  }}
                  color={tokens.colors.accent}
                />
              </View>
            ) : null}
          </GlassCardContainer>
        </> : null}

        {activeSection === "security" ? <SecuritySettingsSection hideHeader
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
        /> : null}

        {activeSection === "data" ? <GlassCardContainer contentStyle={styles.cardContent}>
            <PrimaryPillButton label={t("settings.data.export")} onPress={exportData} color={tokens.colors.accent} />
            <SmallOutlinePillButton label={t("settings.data.import")} onPress={importData} color={tokens.colors.text} fullWidth />
            <SmallOutlinePillButton label={t("settings.reset")} onPress={resetData} color={tokens.colors.red} fullWidth />
        </GlassCardContainer> : null}
        </ScrollView>
        <LimitReachedModal
          visible={settingsPaywallVisible}
          onClose={() => setSettingsPaywallVisible(false)}
          onUpgrade={handlePurchasePro}
          plans={availablePlans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
          title={t("settings.balancePro.goPro")}
          subtitle={t("settings.balancePro.billingOptions")}
          primaryDisabled={!canPurchaseSelectedPlan || !isReady || isStoreLoading}
          onSecondaryAction={handleRestorePurchases}
          secondaryActionLabel={t("wallets.actions.restorePurchases")}
          onTertiaryAction={shouldShowRetryStore ? handleRetryStore : undefined}
          tertiaryActionLabel={shouldShowRetryStore ? t("wallets.actions.retryStoreLoad", { defaultValue: "Riprova" }) : undefined}
          secondaryLabel={t("common.close", { defaultValue: "Chiudi" })}
          benefits={[]}
          primaryLoading={isPurchasePending}
          secondaryActionLoading={isRestorePending}
          tertiaryActionLoading={isStoreLoading}
          statusMessage={paywallStatusMessage}
          legalLinks={paywallLegalLinks}
          isStoreLoading={!isReady || isStoreLoading}
        />
        <ProWelcomeModal
          visible={proWelcomeVisible}
          onContinue={handleDismissProWelcome}
          loading={isDismissingProWelcome}
        />
        <Snackbar visible={purchaseNotice !== null} onDismiss={() => setPurchaseNotice(null)} duration={4000}>
          {purchaseNotice}
        </Snackbar>
      </>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  menuList: { gap: 9 },
  menuRow: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  menuIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  menuText: { flex: 1, minWidth: 0, gap: 3 },
  menuTitle: { fontSize: 15, fontWeight: "700" },
  menuSubtitle: { fontSize: 12, lineHeight: 17 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  backIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  detailTitle: { fontSize: 21, fontWeight: "800" },
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  cardContent: {
    gap: 12,
  },
  groupTitle: { fontSize: 14, fontWeight: "700" },
  offerHero: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 8 },
  offerFeature: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 12 },
  offerFeatureHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  offerPlanOption: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 12, minHeight: 48, borderWidth: 1, borderRadius: 14 },
  offerPlanLabel: { flexGrow: 1 },
  offerFeatureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  offerFeatureTitle: { flex: 1, fontWeight: "700" },
  offerArt: { height: 172, marginBottom: 8 },
  offerArtImage: { width: "100%", height: "100%" },
  planComparison: { flexDirection: "row", borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  offerColumn: { flex: 1, padding: 16, gap: 4 },
  planName: { fontSize: 28, fontWeight: "800", letterSpacing: -0.7 },
  planCard: { minHeight: 102, padding: 20, borderWidth: 1, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  preferenceTopAlignedRow: {
    alignItems: "flex-start",
  },
  preferenceBlock: {
    gap: 10,
  },
  preferenceTextBlock: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
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
});
