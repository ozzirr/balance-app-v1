import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProfileState = {
  name: string;
  surname: string;
  profession: string;
  email: string;
};

const emptyProfile: ProfileState = {
  name: "",
  surname: "",
  profession: "",
  email: "",
};

export default function ProfileScreen(): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<ProfileState>(emptyProfile);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const [name, surname, profession, email] = await Promise.all([
      getPreference("profile_name"),
      getPreference("profile_surname"),
      getPreference("profile_profession"),
      getPreference("profile_email"),
    ]);
    setForm({
      name: name?.value ?? "",
      surname: surname?.value ?? "",
      profession: profession?.value ?? "",
      email: email?.value ?? "",
    });
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const save = async () => {
    setMessage(null);
    if (!form.name.trim() || !form.surname.trim() || !form.email.trim()) {
      setMessage("Nome, cognome ed email sono obbligatori.");
      return;
    }
    await Promise.all([
      setPreference("profile_name", form.name.trim()),
      setPreference("profile_surname", form.surname.trim()),
      setPreference("profile_profession", form.profession.trim()),
      setPreference("profile_email", form.email.trim()),
    ]);
    setMessage("Profilo salvato.");
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
          { gap: tokens.spacing.md, paddingBottom: 160 + insets.bottom },
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
              label="Cognome"
              value={form.surname}
              {...inputProps}
              onChangeText={(value) => setForm((prev) => ({ ...prev, surname: value }))}
            />
            <TextInput
              label="Professione (facoltativo)"
              value={form.profession}
              {...inputProps}
              onChangeText={(value) => setForm((prev) => ({ ...prev, profession: value }))}
            />
            <TextInput
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              {...inputProps}
              onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
            />
            {message ? <Text style={{ color: tokens.colors.muted }}>{message}</Text> : null}
          </View>
          <View style={styles.actions}>
            <Button mode="contained" buttonColor={tokens.colors.accent} onPress={save}>
              Salva profilo
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
});
