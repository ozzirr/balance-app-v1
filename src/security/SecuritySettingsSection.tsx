import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { Switch } from "react-native-paper";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  securityEnabled: boolean;
  biometryEnabled: boolean;
  pinHashExists: boolean;
  biometryAvailable: boolean;
  onRequestEnableSecurity: (nextValue: boolean) => void;
  onRequestChangeOrSetPin: () => void;
  onRequestDisableSecurity: () => void;
  onToggleBiometry: (nextValue: boolean) => void;
};

export default function SecuritySettingsSection({
  securityEnabled,
  biometryEnabled,
  pinHashExists,
  biometryAvailable,
  onRequestEnableSecurity,
  onRequestChangeOrSetPin,
  onRequestDisableSecurity,
  onToggleBiometry,
}: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const actionLabel = pinHashExists ? "Cambia codice" : "Imposta codice";

  return (
    <PremiumCard>
      <SectionHeader title="Sicurezza" />
      <View style={styles.content}>
        <View style={styles.row}>
          <Switch
            value={securityEnabled}
            onValueChange={onRequestEnableSecurity}
            color={tokens.colors.accent}
          />
          <Text style={[styles.label, { color: tokens.colors.text }]}>Richiedi codice all’avvio</Text>
        </View>
        <Pressable
          onPress={onRequestChangeOrSetPin}
          style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.actionLabel, { color: tokens.colors.text }]}>{actionLabel}</Text>
          <Text style={{ color: tokens.colors.muted }}>→</Text>
        </Pressable>
        {biometryAvailable ? (
          <View style={styles.row}>
            <Switch
              value={biometryEnabled && securityEnabled}
              onValueChange={onToggleBiometry}
              color={tokens.colors.accent}
              disabled={!securityEnabled}
            />
            <Text style={[styles.label, { color: securityEnabled ? tokens.colors.text : tokens.colors.muted }]}>
              Usa Face ID
            </Text>
          </View>
        ) : null}
        {securityEnabled ? (
          <Pressable
            onPress={onRequestDisableSecurity}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.actionLabel, { color: tokens.colors.red }]}>Disattiva codice</Text>
            <Text style={{ color: tokens.colors.muted }}>→</Text>
          </Pressable>
        ) : null}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 16,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionLabel: {
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
