import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Modal, Portal, Text, Button } from "react-native-paper";
import GlassBlur from "@/ui/components/GlassBlur";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";
import type { BalanceProPlanId } from "@/config/entitlements";
import type { BalanceProAvailablePlan } from "@/features/pro/BalanceProProvider";
import type { ProductSubscriptionIOS } from "expo-iap";

type LegalLinkAction = {
  key: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  plans?: BalanceProAvailablePlan[];
  selectedPlanId?: BalanceProPlanId | null;
  onSelectPlan?: (planId: BalanceProPlanId) => void;
  onSecondaryAction?: () => void;
  onTertiaryAction?: () => void;
  title?: string;
  subtitle?: string;
  benefits?: string[];
  ctaLabel?: string;
  secondaryLabel?: string;
  onSecondaryLabelPress?: () => void;
  secondaryActionLabel?: string;
  tertiaryActionLabel?: string;
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryActionLoading?: boolean;
  tertiaryActionLoading?: boolean;
  statusMessage?: string;
  legalLinks?: LegalLinkAction[];
  isStoreLoading?: boolean;
};

const LinearGradient: React.ComponentType<any> | undefined = undefined;

function getIosSubscriptionProduct(plan: BalanceProAvailablePlan): ProductSubscriptionIOS | null {
  return plan.product?.platform === "ios" ? plan.product : null;
}

export default function LimitReachedModal({
  visible,
  onClose,
  onUpgrade,
  plans,
  selectedPlanId,
  onSelectPlan,
  onSecondaryAction,
  onTertiaryAction,
  title,
  subtitle,
  benefits,
  ctaLabel,
  secondaryLabel,
  onSecondaryLabelPress,
  secondaryActionLabel,
  tertiaryActionLabel,
  iconName,
  primaryLoading,
  primaryDisabled,
  secondaryActionLoading,
  tertiaryActionLoading,
  statusMessage,
  legalLinks,
  isStoreLoading,
}: Props): React.ReactElement {
  const { tokens, shadows, isDark } = useDashboardTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();

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

  const isTabletLayout = width >= 768;
  const cardWidth = Math.min(width - 32, isTabletLayout ? 560 : 390);
  const cardMaxHeight = Math.max(420, height - 48);
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
  const legalLinkColor = isDark ? tokens.colors.accent : tokens.colors.text;
  const iconTint = isDark ? `${tokens.colors.accentPurple}22` : "rgba(158,123,255,0.16)";

  const resolvePlanCycleLabel = (plan: BalanceProAvailablePlan): string => {
    const unit = getIosSubscriptionProduct(plan)?.subscriptionPeriodUnitIOS;
    if (unit === "year" || plan.planId === "yearly") {
      return t("wallets.actions.planCycleYear", { defaultValue: "year" });
    }

    if (unit === "week") {
      return t("wallets.actions.planCycleWeek", { defaultValue: "week" });
    }

    if (unit === "day") {
      return t("wallets.actions.planCycleDay", { defaultValue: "day" });
    }

    return t("wallets.actions.planCycleMonth", { defaultValue: "month" });
  };

  const resolvePlanDurationLabel = (plan: BalanceProAvailablePlan): string => {
    const iosProduct = getIosSubscriptionProduct(plan);
    const rawCount = Number(iosProduct?.subscriptionPeriodNumberIOS ?? "1");
    const count = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1;
    const unit = iosProduct?.subscriptionPeriodUnitIOS;

    if (unit === "year" || plan.planId === "yearly") {
      return count === 1
        ? t("wallets.actions.planDurationYear", { defaultValue: "1 year subscription" })
        : t("wallets.actions.planDurationYears", { count, defaultValue: `${count} years subscription` });
    }

    if (unit === "week") {
      return count === 1
        ? t("wallets.actions.planDurationWeek", { defaultValue: "1 week subscription" })
        : t("wallets.actions.planDurationWeeks", { count, defaultValue: `${count} weeks subscription` });
    }

    if (unit === "day") {
      return count === 1
        ? t("wallets.actions.planDurationDay", { defaultValue: "1 day subscription" })
        : t("wallets.actions.planDurationDays", { count, defaultValue: `${count} days subscription` });
    }

    return count === 1
      ? t("wallets.actions.planDurationMonth", { defaultValue: "1 month subscription" })
      : t("wallets.actions.planDurationMonths", { count, defaultValue: `${count} months subscription` });
  };

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
          accessibilityState={{ disabled: primaryDisabled || primaryLoading || secondaryActionLoading || tertiaryActionLoading }}
          disabled={primaryDisabled || primaryLoading || secondaryActionLoading || tertiaryActionLoading}
          onPress={onUpgrade}
          style={{ width: "100%" }}
        >
          <Gradient
            colors={[tokens.colors.accentPurple, tokens.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradientButton, primaryDisabled ? styles.disabledButton : null]}
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
        disabled={primaryDisabled || primaryLoading || secondaryActionLoading || tertiaryActionLoading}
      >
        {resolvedCtaLabel}
      </Button>
    );
  };

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
              width: cardWidth,
              maxHeight: cardMaxHeight,
              backgroundColor: cardBackground,
              borderColor: cardBorder,
              opacity,
              transform: [{ scale }],
              ...shadows.card,
            },
          ]}
        >
          <GlassBlur intensity={blurIntensity} tint={blurTint} fallbackColor="transparent" />
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
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
              <View style={[styles.planGrid, isTabletLayout ? styles.planGridWide : null]}>
                {plans?.map((plan) => {
                  const isSelected = plan.planId === selectedPlanId;
                  const isAvailable = Boolean(plan.product && plan.displayPrice);
                  const planTitle =
                    plan.planId === "yearly"
                      ? t("wallets.actions.planYearly", { defaultValue: "Yearly" })
                      : t("wallets.actions.planMonthly", { defaultValue: "Monthly" });
                  const billingCycleLabel = resolvePlanCycleLabel(plan);
                  const subscriptionLengthLabel = resolvePlanDurationLabel(plan);

                  return (
                    <Pressable
                      key={plan.planId}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled: !isAvailable }}
                      disabled={!isAvailable}
                      onPress={() => onSelectPlan?.(plan.planId)}
                      style={[
                        styles.planCard,
                        isTabletLayout ? styles.planCardWide : null,
                        {
                          borderColor: isSelected ? tokens.colors.accent : secondaryButtonBorderColor,
                          backgroundColor: isSelected
                            ? isDark
                              ? "rgba(255,255,255,0.08)"
                              : "rgba(255,255,255,0.76)"
                            : secondaryButtonBackgroundColor,
                          opacity: isAvailable ? 1 : 0.72,
                        },
                      ]}
                    >
                      <Text variant="titleMedium" style={{ color: tokens.colors.text }}>
                        {planTitle}
                      </Text>
                      {plan.displayPrice ? (
                        <Text style={[styles.planPriceLine, { color: tokens.colors.text }]}>
                          <Text style={styles.planPrice}>{plan.displayPrice}</Text>
                          <Text style={[styles.planPriceSuffix, { color: tokens.colors.text }]}> / {billingCycleLabel}</Text>
                        </Text>
                      ) : (
                        <Text variant="bodyLarge" style={[styles.planPriceUnavailable, { color: tokens.colors.muted }]}>
                          {isStoreLoading
                            ? t("wallets.actions.planLoadingPrice", { defaultValue: "Loading price..." })
                            : t("wallets.actions.planPriceUnavailable", { defaultValue: "Price unavailable" })}
                        </Text>
                      )}
                      <Text variant="bodySmall" style={[styles.planMeta, { color: subtitleColor }]}>
                        {subscriptionLengthLabel}
                      </Text>
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
                disabled={primaryLoading || secondaryActionLoading || tertiaryActionLoading}
              >
                {secondaryActionLabel}
              </Button>
            ) : null}

            {onTertiaryAction && tertiaryActionLabel ? (
              <Button
                mode="outlined"
                onPress={onTertiaryAction}
                style={[
                  styles.secondaryActionButton,
                  {
                    borderColor: secondaryButtonBorderColor,
                    backgroundColor: secondaryButtonBackgroundColor,
                  },
                ]}
                contentStyle={{ paddingVertical: 8 }}
                textColor={tokens.colors.text}
                loading={tertiaryActionLoading}
                disabled={primaryLoading || secondaryActionLoading || tertiaryActionLoading}
              >
                {tertiaryActionLabel}
              </Button>
            ) : null}

            {statusMessage ? (
              <Text variant="bodySmall" style={[styles.statusMessage, { color: statusColor }]}>
                {statusMessage}
              </Text>
            ) : null}

            {legalLinks?.length ? (
              <View style={styles.legalLinks}>
                {legalLinks.map((link) => (
                  <Pressable
                    key={link.key}
                    accessibilityRole="button"
                    disabled={link.disabled}
                    onPress={link.onPress}
                    style={styles.legalLinkButton}
                  >
                    <Text variant="bodySmall" style={[styles.legalLinkText, { color: legalLinkColor }]}>
                      {link.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={primaryLoading || secondaryActionLoading || tertiaryActionLoading}
              onPress={onSecondaryLabelPress ?? onClose}
              style={styles.secondary}
            >
              <Text variant="bodyLarge" style={{ color: dismissColor }}>
                {resolvedSecondaryLabel}
              </Text>
            </Pressable>
          </ScrollView>
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
    padding: 16,
    alignItems: "center",
  },
  card: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
  },
  scrollContent: {
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
  planGridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  planCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  planCardWide: {
    width: "48.5%",
  },
  planPriceLine: {
    fontWeight: "700",
  },
  planPrice: {
    fontSize: 26,
    fontWeight: "800",
  },
  planPriceSuffix: {
    fontSize: 15,
    fontWeight: "600",
  },
  planPriceUnavailable: {
    fontWeight: "600",
  },
  planMeta: {
    lineHeight: 18,
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
  disabledButton: {
    opacity: 0.52,
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
  legalLinks: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
  },
  legalLinkButton: {
    paddingVertical: 4,
  },
  legalLinkText: {
    textDecorationLine: "underline",
  },
  secondary: {
    paddingVertical: 6,
  },
});
