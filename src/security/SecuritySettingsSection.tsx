import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { Switch } from "react-native-paper";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";

type Props = {
  securityEnabled: boolean;
  biometryEnabled: boolean;
  pinHashExists: boolean;
  biometryAvailable: boolean;
  onRequestEnableSecurity: (nextValue: boolean) => void;
  onRequestChangeOrSetPin: () => void;
  onRequestDisableSecurity: () => void;
  onToggleBiometry: (nextValue: boolean) => void;
  autoLockEnabled: boolean;
  onToggleAutoLock: (nextValue: boolean) => void;
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
  autoLockEnabled,
  onToggleAutoLock,
}: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();
  const actionLabel = pinHashExists ? t("security.pin.changeTitle") : t("security.pin.setTitle");

  return (
    <PremiumCard>
      <SectionHeader title={t("security.settings.title")} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Switch
            value={securityEnabled}
            onValueChange={onRequestEnableSecurity}
            color={tokens.colors.accent}
          />
            <Text style={[styles.label, { color: tokens.colors.text }]}>{t("security.settings.requirePin")}</Text>
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
            <View style={styles.biometryText}>
              <Text style={[styles.label, { color: securityEnabled ? tokens.colors.text : tokens.colors.muted }]}>
                {t("security.settings.useFaceId")}
              </Text>
              {!securityEnabled ? (
                <Text style={[styles.helperText, { color: tokens.colors.muted }]}>
                  {t("security.settings.faceIdRequiresPinHint")}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {securityEnabled ? (
          <View style={styles.row}>
            <Switch
              value={autoLockEnabled}
              onValueChange={onToggleAutoLock}
              color={tokens.colors.accent}
            />
            <View>
              <Text style={[styles.label, { color: tokens.colors.text }]}>
                {t("security.settings.autoLockTitle")}
              </Text>
              <Text style={[styles.autoLockSubtitle, { color: tokens.colors.muted }]}>
                {t("security.settings.autoLockSubtitle")}
              </Text>
            </View>
          </View>
        ) : null}
        {securityEnabled ? (
          <Pressable
            onPress={onRequestDisableSecurity}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.actionLabel, { color: tokens.colors.red }]}>
              {t("security.settings.disablePin")}
            </Text>
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
  autoLockSubtitle: {
    fontSize: 12,
  },
  biometryText: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
