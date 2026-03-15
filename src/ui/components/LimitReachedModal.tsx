import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { Modal, Portal, Text, Button } from "react-native-paper";
import GlassBlur from "@/ui/components/GlassBlur";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";
import type { BalanceProPlanId } from "@/config/entitlements";
import type { BalanceProAvailablePlan } from "@/features/pro/BalanceProProvider";

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  plans?: BalanceProAvailablePlan[];
  selectedPlanId?: BalanceProPlanId | null;
  onSelectPlan?: (planId: BalanceProPlanId) => void;
  onSecondaryAction?: () => void;
  title?: string;
  subtitle?: string;
  benefits?: string[];
  ctaLabel?: string;
  secondaryLabel?: string;
  secondaryActionLabel?: string;
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  primaryLoading?: boolean;
  secondaryActionLoading?: boolean;
  statusMessage?: string;
};

const LinearGradient: React.ComponentType<any> | undefined = undefined;

export default function LimitReachedModal({
  visible,
  onClose,
  onUpgrade,
  plans,
  selectedPlanId,
  onSelectPlan,
  onSecondaryAction,
  title,
  subtitle,
  benefits,
  ctaLabel,
  secondaryLabel,
  secondaryActionLabel,
  iconName,
  primaryLoading,
  secondaryActionLoading,
  statusMessage,
}: Props): React.ReactElement {
  const { tokens, shadows, isDark } = useDashboardTheme();
  const { t } = useTranslation();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  const resolvedTitle = title ?? t("wallets.actions.limitModalTitle");
  const resolvedSubtitle = subtitle ?? t("wallets.actions.limitModalSubtitle");
  const resolvedSecondaryLabel = secondaryLabel ?? t("wallets.actions.limitMaybeLater");
  const resolvedIconName = iconName ?? "wallet-outline";
  const resolvedBenefits = useMemo(
    () =>
      benefits ?? [
        t("wallets.actions.limitBenefitUnlimited"),
        t("wallets.actions.limitBenefitInsights"),
        t("wallets.actions.limitBenefitControl"),
      ],
    [benefits, t]
  );

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          stiffness: 220,
          damping: 18,
          mass: 0.7,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.96, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, visible]);

  const renderPrimaryCta = () => {
    const resolvedCtaLabel = ctaLabel ?? t("wallets.actions.limitUpgradeCta");
    if (LinearGradient) {
      const Gradient = LinearGradient;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={resolvedCtaLabel}
          onPress={onUpgrade}
          style={{ width: "100%" }}
        >
          <Gradient
            colors={[tokens.colors.accentPurple, tokens.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Text style={[styles.ctaText, { color: "#FFFFFF" }]}>{resolvedCtaLabel}</Text>
          </Gradient>
        </Pressable>
      );
    }

    return (
      <Button
        mode="contained"
        buttonColor={tokens.colors.accent}
        textColor="#FFFFFF"
        onPress={onUpgrade}
        style={styles.fallbackButton}
        contentStyle={{ paddingVertical: 10 }}
        loading={primaryLoading}
        disabled={primaryLoading || secondaryActionLoading}
      >
        {resolvedCtaLabel}
      </Button>
    );
  };

  const iconTint = isDark ? `${tokens.colors.accentPurple}22` : "rgba(158,123,255,0.16)";
  const shouldShowBenefits = resolvedBenefits.length > 0;
  const shouldShowPlans = Boolean(plans?.length && selectedPlanId && onSelectPlan);
  const overlayTint = isDark ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0.8)";
  const cardBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
      ? "rgba(15, 18, 30, 0.78)"
      : tokens.colors.modalGlassBg;
  const cardBorder =
    Platform.OS === "android"
      ? tokens.colors.border
      : isDark
      ? "rgba(255,255,255,0.12)"
      : "rgba(158,123,255,0.34)";
  const blurTint = isDark ? "dark" : "light";
  const blurIntensity = 35;
  const subtitleColor = isDark ? tokens.colors.muted : "rgba(16, 21, 34, 0.68)";
  const statusColor = isDark ? tokens.colors.muted : "rgba(16, 21, 34, 0.64)";
  const secondaryButtonBorderColor = isDark ? tokens.colors.glassBorder : "rgba(16, 21, 34, 0.14)";
  const secondaryButtonBackgroundColor = isDark ? "transparent" : "rgba(255,255,255,0.52)";
  const dismissColor = isDark ? tokens.colors.accent : tokens.colors.purplePrimary;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        dismissable
        style={styles.modal}
        contentContainerStyle={styles.content}
        theme={{ colors: { backdrop: overlayTint } }}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBackground,
              borderColor: cardBorder,
              opacity,
              transform: [{ scale }],
              ...shadows.card,
            },
          ]}
        >
          <GlassBlur intensity={blurIntensity} tint={blurTint} fallbackColor="transparent" />
          <View style={[styles.iconWrap, { backgroundColor: iconTint }]}>
            <View
              style={[
                styles.iconInner,
                { backgroundColor: isDark ? tokens.colors.modalBorder : "rgba(255,255,255,0.55)" },
              ]}
            >
              <MaterialCommunityIcons name={resolvedIconName} size={32} color={tokens.colors.accent} />
            </View>
          </View>
          <Text variant="titleLarge" style={[styles.title, { color: tokens.colors.text }]}>
            {resolvedTitle}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: subtitleColor }]}>
            {resolvedSubtitle}
          </Text>

          {shouldShowBenefits ? (
            <View style={styles.benefits}>
              {resolvedBenefits.map((item) => (
                <View key={item} style={styles.benefitRow}>
                  <View style={[styles.checkIcon, { backgroundColor: tokens.colors.accentPurple }]}>
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                  </View>
                  <Text variant="bodyLarge" style={{ color: tokens.colors.text }}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {shouldShowPlans ? (
            <View style={styles.planGrid}>
              {plans?.map((plan) => {
                const isSelected = plan.planId === selectedPlanId;
                const planTitle =
                  plan.planId === "yearly"
                    ? t("wallets.actions.planYearly", { defaultValue: "Yearly" })
                    : t("wallets.actions.planMonthly", { defaultValue: "Monthly" });

                return (
                  <Pressable
                    key={plan.planId}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onSelectPlan?.(plan.planId)}
                    style={[
                      styles.planCard,
                      {
                        borderColor: isSelected ? tokens.colors.accent : secondaryButtonBorderColor,
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.76)"
                          : secondaryButtonBackgroundColor,
                      },
                    ]}
                  >
                    <View style={styles.planHeader}>
                      <Text variant="titleMedium" style={{ color: tokens.colors.text }}>
                        {planTitle}
                      </Text>
                      {plan.isBestValue ? (
                        <View style={[styles.planBadge, { backgroundColor: tokens.colors.accentPurple }]}>
                          <Text style={styles.planBadgeText}>
                            {t("wallets.actions.planBestValue", { defaultValue: "Best value" })}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {plan.displayPrice ? (
                      <Text variant="bodyLarge" style={[styles.planPrice, { color: tokens.colors.text }]}>
                        {plan.displayPrice}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {renderPrimaryCta()}

          {onSecondaryAction && secondaryActionLabel ? (
            <Button
              mode="outlined"
              onPress={onSecondaryAction}
              style={[
                styles.secondaryActionButton,
                {
                  borderColor: secondaryButtonBorderColor,
                  backgroundColor: secondaryButtonBackgroundColor,
                },
              ]}
              contentStyle={{ paddingVertical: 8 }}
              textColor={tokens.colors.text}
              loading={secondaryActionLoading}
              disabled={primaryLoading || secondaryActionLoading}
            >
              {secondaryActionLabel}
            </Button>
          ) : null}

          {statusMessage ? (
            <Text variant="bodySmall" style={[styles.statusMessage, { color: statusColor }]}>
              {statusMessage}
            </Text>
          ) : null}

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
            <Text variant="bodyLarge" style={{ color: dismissColor }}>
              {resolvedSecondaryLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "center",
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  title: {
    textAlign: "center",
    fontWeight: "700",
  },
  subtitle: {
    textAlign: "center",
  },
  benefits: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  planGrid: {
    width: "100%",
    gap: 10,
  },
  planCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  planBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  planPrice: {
    fontWeight: "700",
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientButton: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  fallbackButton: {
    width: "100%",
    borderRadius: 999,
  },
  secondaryActionButton: {
    width: "100%",
    borderRadius: 999,
  },
  ctaText: {
    fontWeight: "700",
    fontSize: 16,
  },
  statusMessage: {
    textAlign: "center",
    lineHeight: 18,
  },
  secondary: {
    paddingVertical: 6,
  },
});
