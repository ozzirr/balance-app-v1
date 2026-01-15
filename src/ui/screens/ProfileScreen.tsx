import React, { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput } from "react-native-paper";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { exportToJson, importFromFile, importFromJson } from "@/importExport";
import { runMigrations, withTransaction } from "@/db/db";
import { loadSampleData as seedSampleData } from "@/seed/sampleData";
import { ensureDefaultWallets } from "@/repositories/walletsRepo";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemeContext } from "@/ui/theme";
import { useOnboardingFlow } from "@/onboarding/flowContext";

type ProfileState = {
  name: string;
  email: string;
};

const emptyProfile: ProfileState = {
  name: "",
  email: "",
};

export default function ProfileScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [form, setForm] = useState<ProfileState>(emptyProfile);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [prefillSnapshot, setPrefillSnapshot] = useState(true);
  const [chartMonths, setChartMonths] = useState(6);
  const { mode, setMode } = useContext(ThemeContext);
  const [refreshing, setRefreshing] = useState(false);
  const { requestReplay } = useOnboardingFlow();

  const load = useCallback(async () => {
    const [name, email, prefill, points] = await Promise.all([
      getPreference("profile_name"),
      getPreference("profile_email"),
      getPreference("prefill_snapshot"),
      getPreference("chart_points"),
    ]);
    setForm({
      name: name?.value ?? "",
      email: email?.value ?? "",
    });
    setPrefillSnapshot(prefill ? prefill.value === "true" : true);
    const parsedPoints = points ? Number(points.value) : 6;
    const safePoints = Number.isFinite(parsedPoints) ? Math.min(12, Math.max(3, parsedPoints)) : 6;
    setChartMonths(safePoints);
  }, []);

  const updatePreference = async (key: string, value: string) => {
    await setPreference(key, value);
    setStatusMessage("Preferenze salvate.");
  };

  const confirmWipeAndReplace = async (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        "Conferma import",
        "L'import sostituirà tutti i dati esistenti. Vuoi continuare?",
        [
          { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
          { text: "Continua", style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

  const importData = async () => {
    setStatusMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const confirmed = await confirmWipeAndReplace();
      if (!confirmed) return;
      await importFromFile(result.assets[0].uri);
      setStatusMessage("Import completato.");
    } catch (error) {
      setStatusMessage((error as Error).message);
    }
  };

  const exportData = async () => {
    setStatusMessage(null);
    const fileName = "openMoney-export.json";
    try {
      const payload = await exportToJson();
      const json = JSON.stringify(payload, null, 2);
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted || !permission.directoryUri) {
        setStatusMessage("Permesso necessario per salvare il file.");
          return;
        }
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          fileName,
          "application/json"
        );
        if (FileSystem.StorageAccessFramework.writeAsStringAsync) {
          await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, json);
        } else {
          await LegacyFileSystem.writeAsStringAsync(fileUri, json);
        }
        setStatusMessage("Export completato.");
        return;
      }
      const cacheDir = FileSystem.cacheDirectory ?? LegacyFileSystem.cacheDirectory;
      const docDir = FileSystem.documentDirectory ?? LegacyFileSystem.documentDirectory;
      let baseDir = cacheDir ?? docDir ?? FileSystem.temporaryDirectory ?? LegacyFileSystem.temporaryDirectory;
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
        setStatusMessage("Impossibile salvare il file su questo dispositivo.");
        return;
      }
      const path = `${baseDir}${fileName}`;
      await LegacyFileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Esporta dati" });
        setStatusMessage("Export completato.");
        return;
      }
      setStatusMessage(`Export completato: ${path}`);
    } catch (error) {
      setStatusMessage((error as Error).message);
    }
  };

  const pasteFromClipboard = async () => {
    setStatusMessage(null);
    try {
      const copy = (await Clipboard.getStringAsync())?.trim();
      if (!copy) {
      setStatusMessage("Appunti vuoti.");
        return;
      }
      const confirmed = await confirmWipeAndReplace();
      if (!confirmed) return;
      let payload: unknown;
      try {
        payload = JSON.parse(copy);
      } catch {
        setStatusMessage("JSON non valido.");
        return;
      }
      await runMigrations();
      await importFromJson(payload);
      setStatusMessage("Import completato dagli appunti.");
    } catch (error) {
      const message = (error as Error).message;
      setStatusMessage(message.includes("Could not open database") ? "Database non disponibile. Riprova tra poco." : message);
    }
  };

  const confirmReset = async (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        "Conferma reset",
        "Questa azione cancellerà tutti i dati. Vuoi continuare?",
        [
          { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
          { text: "Reset", style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true }
      );
    });

  const resetData = async () => {
    setStatusMessage(null);
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
      ];
      for (const table of tables) {
        await db.runAsync(`DELETE FROM ${table}`);
      }
    });
    await ensureDefaultWallets();
    setStatusMessage("Reset completato.");
  };

  const loadSampleDataHandler = useCallback(async () => {
    setStatusMessage(null);
    try {
      await seedSampleData();
      setStatusMessage("Dati di esempio caricati.");
    } catch (error) {
      setStatusMessage((error as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const save = async () => {
    setProfileMessage(null);
    if (!form.name.trim() || !form.email.trim()) {
      setProfileMessage("Nome ed email sono obbligatori.");
      return;
    }
    await Promise.all([
      setPreference("profile_name", form.name.trim()),
      setPreference("profile_email", form.email.trim()),
    ]);
    setProfileMessage("Profilo salvato.");
  };

  const inputProps = {
    mode: "outlined" as const,
    outlineColor: tokens.colors.border,
    activeOutlineColor: tokens.colors.accent,
    textColor: tokens.colors.text,
    style: { backgroundColor: tokens.colors.surface2 },
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom, paddingTop: headerHeight + 12 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.colors.accent} />}
      >
        <PremiumCard>
          <SectionHeader title="Profilo utente" />
          <View style={styles.form}>
            <TextInput
              label="Nome"
              value={form.name}
              {...inputProps}
              onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
            />
            <TextInput
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              {...inputProps}
              onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
            />
            {profileMessage ? <Text style={{ color: tokens.colors.muted }}>{profileMessage}</Text> : null}
          </View>
          <View style={styles.actions}>
            <Button mode="contained" buttonColor={tokens.colors.accent} onPress={save}>
              Salva profilo
            </Button>
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Preferenze" />
          {statusMessage ? <Text style={{ color: tokens.colors.muted }}>{statusMessage}</Text> : null}
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <Switch
                value={mode === "dark"}
                onValueChange={(value) => {
                  const next = value ? "dark" : "light";
                  setMode(next);
                  updatePreference("theme", next);
                }}
              />
              <Text style={{ color: tokens.colors.text }}>Tema scuro</Text>
            </View>
            <View style={styles.row}>
              <Switch
                value={prefillSnapshot}
                onValueChange={(value) => {
                  setPrefillSnapshot(value);
                  updatePreference("prefill_snapshot", String(value));
                }}
              />
              <Text style={{ color: tokens.colors.text }}>Precompila snapshot</Text>
            </View>
            <View style={[styles.row, { gap: 12, marginTop: 8 }]}>
              <Text style={{ color: tokens.colors.text }}>Mesi nel grafico</Text>
              <Button
                mode="outlined"
                textColor={tokens.colors.text}
                onPress={() => {
                  const next = Math.max(3, chartMonths - 1);
                  setChartMonths(next);
                  updatePreference("chart_points", String(next));
                }}
              >
                -
              </Button>
              <Text style={{ color: tokens.colors.text }}>{chartMonths}</Text>
              <Button
                mode="outlined"
                textColor={tokens.colors.text}
                onPress={() => {
                  const next = Math.min(12, chartMonths + 1);
                  setChartMonths(next);
                  updatePreference("chart_points", String(next));
                }}
              >
                +
              </Button>
            </View>
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Dati" />
          <View style={styles.sectionContent}>
            <Button mode="contained" buttonColor={tokens.colors.accent} onPress={importData}>
              Importa
            </Button>
            <Button mode="contained" buttonColor={tokens.colors.accent} onPress={exportData}>
              Esporta
            </Button>
            <Button
              mode="outlined"
              textColor={tokens.colors.accent}
              onPress={pasteFromClipboard}
              style={{ borderColor: tokens.colors.accent }}
            >
              Incolla JSON dagli appunti
            </Button>
            <Button
              mode="outlined"
              textColor={tokens.colors.accent}
              style={{ borderColor: tokens.colors.accent }}
              onPress={loadSampleDataHandler}
            >
              Carica dati di test
            </Button>
            <View style={[styles.onboardingRow, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface2 }]}>
              <View style={styles.onboardingText}>
                <Text style={[styles.onboardingTitle, { color: tokens.colors.text }]}>Onboarding</Text>
                <Text style={[styles.onboardingSubtitle, { color: tokens.colors.muted }]}>
                  Rivedi la configurazione guidata
                </Text>
              </View>
              <Button mode="text" textColor={tokens.colors.accent} onPress={requestReplay}>
                Rivedi
              </Button>
            </View>
            <Button mode="outlined" textColor={tokens.colors.red} onPress={resetData}>
              Reset
            </Button>
          </View>
        </PremiumCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  form: {
    gap: 12,
  },
  actions: {
    marginTop: 12,
  },
  sectionContent: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onboardingRow: {
    borderRadius: 12,
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
});
