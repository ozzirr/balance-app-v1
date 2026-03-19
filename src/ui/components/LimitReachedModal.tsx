import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Button, Modal, Portal, Text } from "react-native-paper";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { BalanceProPlanId } from "@/config/entitlements";
import type { BalanceProAvailablePlan, BalanceProProduct } from "@/features/pro/BalanceProProvider";
import GlassBlur from "@/ui/components/GlassBlur";
import { useDashboardTheme } from "@/ui/dashboard/theme";

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

type PlanCycleUnit = "day" | "week" | "month" | "year";

function isPlanCycleUnit(value: string | null | undefined): value is PlanCycleUnit {
  return value === "day" || value === "week" || value === "month" || value === "year";
}

function parsePositiveInt(value: string | number | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function getPlanCycleUnit(plan: BalanceProAvailablePlan): PlanCycleUnit {
  if (isPlanCycleUnit(plan.product?.subscriptionPeriodUnitIOS)) {
    return plan.product.subscriptionPeriodUnitIOS;
  }

  return plan.planId === "yearly" ? "year" : "month";
}

function getPlanCycleCount(plan: BalanceProAvailablePlan): number {
  return parsePositiveInt(plan.product?.subscriptionPeriodNumberIOS) ?? 1;
}

function getFreeTrialOffer(product: BalanceProProduct | null): { count: number | null; unit: PlanCycleUnit | null } | null {
  if (!product) {
    return null;
  }

  const standardizedTrialOffer = product.subscriptionOffers?.find(
    (offer) => offer.type === "introductory" && offer.paymentMode === "free-trial"
  );

  if (standardizedTrialOffer) {
    return {
      count: standardizedTrialOffer.periodCount ?? standardizedTrialOffer.period?.value ?? null,
      unit: isPlanCycleUnit(standardizedTrialOffer.period?.unit) ? standardizedTrialOffer.period?.unit : null,
    };
  }

  if (product.introductoryPricePaymentModeIOS !== "free-trial") {
    return null;
  }

  return {
    count: parsePositiveInt(product.introductoryPriceNumberOfPeriodsIOS),
    unit: isPlanCycleUnit(product.introductoryPriceSubscriptionPeriodIOS)
      ? product.introductoryPriceSubscriptionPeriodIOS
      : null,
  };
}

function getPlanDurationInMonths(plan: BalanceProAvailablePlan): number | null {
  const cycleUnit = getPlanCycleUnit(plan);
  const cycleCount = getPlanCycleCount(plan);
  if (cycleCount <= 0) {
    return null;
  }

  if (cycleUnit === "year") {
    return cycleCount * 12;
  }

  if (cycleUnit === "month") {
    return cycleCount;
  }

  return null;
}

function getPlanSavingsPercentage(
  yearlyPlan: BalanceProAvailablePlan,
  monthlyPlan: BalanceProAvailablePlan | null
): number | null {
  if (!monthlyPlan) {
    return null;
  }

  const yearlyPrice = yearlyPlan.product?.price;
  const monthlyPrice = monthlyPlan.product?.price;
  if (
    typeof yearlyPrice !== "number" ||
    !Number.isFinite(yearlyPrice) ||
    typeof monthlyPrice !== "number" ||
    !Number.isFinite(monthlyPrice)
  ) {
    return null;
  }

  const yearlyDurationInMonths = getPlanDurationInMonths(yearlyPlan);
  const monthlyDurationInMonths = getPlanDurationInMonths(monthlyPlan);
  if (!yearlyDurationInMonths || !monthlyDurationInMonths) {
    return null;
  }

  const comparableMonthlyCost = monthlyPrice * (yearlyDurationInMonths / monthlyDurationInMonths);
  if (!Number.isFinite(comparableMonthlyCost) || comparableMonthlyCost <= 0 || comparableMonthlyCost <= yearlyPrice) {
    return null;
  }

  return Math.round(((comparableMonthlyCost - yearlyPrice) / comparableMonthlyCost) * 100);
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
  primaryLoading = false,
  primaryDisabled = false,
  secondaryActionLoading = false,
  tertiaryActionLoading = false,
  statusMessage,
  legalLinks,
  isStoreLoading = false,
}: Props): React.ReactElement {
  const { tokens, shadows, isDark } = useDashboardTheme();
  const { t, i18n } = useTranslation();
  const { width, height } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  const resolvedBenefits = useMemo(
    () =>
      benefits ?? [
        t("wallets.actions.limitBenefitUnlimited"),
        t("wallets.actions.limitBenefitInsights"),
        t("wallets.actions.limitBenefitControl"),
      ],
    [benefits, t]
  );

  const shouldShowPlans = Boolean(plans?.length && selectedPlanId && onSelectPlan);
  const paywallPlans = plans ?? [];
  const selectedPlan = useMemo(
    () => paywallPlans.find((plan) => plan.planId === selectedPlanId) ?? null,
    [paywallPlans, selectedPlanId]
  );
  const selectedPlanHasProduct = Boolean(selectedPlan?.product);
  const selectedPlanTrialOffer = getFreeTrialOffer(selectedPlan?.product ?? null);
  const hasSelectedPlanTrial = Boolean(selectedPlanTrialOffer);
  const monthlyPlan = useMemo(
    () => paywallPlans.find((plan) => plan.planId === "monthly") ?? null,
    [paywallPlans]
  );
  const yearlyPlanSavingsPercentage = useMemo(() => {
    const yearlyPlan = paywallPlans.find((plan) => plan.planId === "yearly") ?? null;
    if (!yearlyPlan) {
      return null;
    }

    return getPlanSavingsPercentage(yearlyPlan, monthlyPlan);
  }, [monthlyPlan, paywallPlans]);

  const resolvedHeadline = shouldShowPlans
    ? t("wallets.actions.paywallHeadline", { defaultValue: "Upgrade to Balance Pro" })
    : title ?? t("wallets.actions.limitModalTitle");

  const resolvedSubtitle = shouldShowPlans
    ? t("wallets.actions.paywallSubtitle", {
        defaultValue:
          "Start with a free trial and unlock a more complete way to manage your wallets, with advanced insights and more control.",
      })
    : subtitle ?? t("wallets.actions.limitModalSubtitle");

  const resolvedSecondaryLabel = secondaryLabel ?? t("wallets.actions.limitMaybeLater");
  const resolvedIconName = iconName ?? "wallet-outline";
  const resolvedCtaLabel = shouldShowPlans
    ? ctaLabel ??
      (hasSelectedPlanTrial
        ? t("wallets.actions.limitTrialCta", { defaultValue: "Start your free trial" })
        : selectedPlanId === "yearly"
        ? t("wallets.actions.limitYearlyCta", { defaultValue: "Choose yearly" })
        : t("wallets.actions.limitMonthlyCta", { defaultValue: "Choose monthly" }))
    : ctaLabel ?? t("common.continue", { defaultValue: "Continue" });
  const resolvedPrimaryDisabled = primaryDisabled || secondaryActionLoading || tertiaryActionLoading;

  const resolveCycleLabel = (plan: BalanceProAvailablePlan): string => {
    const unit = getPlanCycleUnit(plan);
    if (unit === "year") {
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

  const resolveDurationLabel = (plan: BalanceProAvailablePlan): string => {
    const count = getPlanCycleCount(plan);
    const unit = getPlanCycleUnit(plan);

    if (unit === "year") {
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

  const billingHelper = useMemo(() => {
    if (!shouldShowPlans || !selectedPlanHasProduct || !selectedPlan?.displayPrice) {
      return null;
    }

    const cycle = resolveCycleLabel(selectedPlan);
    if (hasSelectedPlanTrial) {
      return t("wallets.actions.paywallBillingHelperTrial", {
        price: selectedPlan.displayPrice,
        cycle,
        defaultValue: "If eligible, you'll be charged after the free trial. Then {{price}} / {{cycle}}. Cancel anytime.",
      });
    }

    return t("wallets.actions.paywallBillingHelper", {
      price: selectedPlan.displayPrice,
      cycle,
      defaultValue: "Renews at {{price}} / {{cycle}}. Cancel anytime.",
    });
  }, [hasSelectedPlanTrial, selectedPlan, selectedPlanHasProduct, shouldShowPlans, t]);

  const isTabletLayout = width >= 768;
  const cardWidth = Math.min(width - 32, isTabletLayout ? 560 : 398);
  const cardMaxHeight = Math.max(440, height - (isTabletLayout ? 48 : 72));
  const overlayTint = isDark ? "rgba(8, 10, 18, 0.32)" : "rgba(245, 248, 255, 0.2)";
  const cardBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
      ? "rgba(15, 18, 28, 0.72)"
      : "rgba(255,255,255,0.74)";
  const cardBorder =
    Platform.OS === "android"
      ? tokens.colors.border
      : isDark
      ? "rgba(255,255,255,0.14)"
      : "rgba(255,255,255,0.52)";
  const blurTint = isDark ? "dark" : "light";
  const subtitleColor = isDark ? tokens.colors.muted : "rgba(16, 21, 34, 0.68)";
  const subtleTextColor = isDark ? tokens.colors.muted : "rgba(16, 21, 34, 0.58)";
  const cardMutedBackground = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.54)";
  const cardMutedBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(16,24,40,0.08)";
  const annualPlanBackground = isDark ? "rgba(169,124,255,0.08)" : "rgba(255,255,255,0.28)";
  const selectedPlanBackground = isDark ? "rgba(169,124,255,0.14)" : "rgba(169,124,255,0.12)";
  const monthlyPlanBackground = isDark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.2)";
  const premiumChipBackground = isDark ? "rgba(169,124,255,0.1)" : "rgba(255,255,255,0.22)";
  const premiumChipText = isDark ? tokens.colors.accentPurple : tokens.colors.purplePrimary;
  const skeletonColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.08)";
  const glassShine = isDark ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.38)";
  const yearlyPlanTint = isDark ? "rgba(169,124,255,0.06)" : "rgba(169,124,255,0.04)";

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

  return (
    <Portal>
      {visible ? (
        <View pointerEvents="none" style={styles.portalBackdrop}>
          <GlassBlur intensity={26} tint={blurTint} fallbackColor="transparent" />
          <View style={[styles.backdropTint, { backgroundColor: overlayTint }]} />
        </View>
      ) : null}

      <Modal
        visible={visible}
        onDismiss={onClose}
        dismissable={!primaryLoading && !secondaryActionLoading && !tertiaryActionLoading}
        style={styles.modal}
        contentContainerStyle={styles.content}
        theme={{ colors: { backdrop: "transparent" } }}
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
          <GlassBlur intensity={34} tint={blurTint} fallbackColor="transparent" />

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerCenter}>
                <View style={[styles.balanceProChip, { backgroundColor: premiumChipBackground, borderColor: `${premiumChipText}24` }]}>
                  <MaterialCommunityIcons name="crown-outline" size={14} color={premiumChipText} />
                  <Text style={[styles.balanceProChipLabel, { color: premiumChipText }]}>Balance Pro</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.close", { defaultValue: "Close" })}
                onPress={onClose}
                disabled={primaryLoading || secondaryActionLoading || tertiaryActionLoading}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: cardMutedBackground,
                    borderColor: cardMutedBorder,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons name="close" size={18} color={tokens.colors.text} />
              </Pressable>
            </View>

            <View style={styles.heroBlock}>
              {!shouldShowPlans ? (
                <View style={[styles.iconWrap, { backgroundColor: premiumChipBackground }]}>
                  <View style={[styles.iconInner, { backgroundColor: isDark ? tokens.colors.modalBorder : "rgba(255,255,255,0.62)" }]}>
                    <MaterialCommunityIcons name={resolvedIconName} size={28} color={tokens.colors.accent} />
                  </View>
                </View>
              ) : null}

              <Text variant="headlineSmall" style={[styles.title, { color: tokens.colors.text }]}>
                {resolvedHeadline}
              </Text>
              <Text variant="bodyLarge" style={[styles.subtitle, { color: subtitleColor }]}>
                {resolvedSubtitle}
              </Text>
              {shouldShowPlans ? (
                <View style={styles.trustLine}>
                  <MaterialCommunityIcons name="shield-check-outline" size={14} color={tokens.colors.accentPurple} />
                  <Text style={[styles.trustText, { color: subtleTextColor }]}>
                    {t("wallets.actions.paywallTrustCancelAnytime", { defaultValue: "Free trial, cancel anytime" })}
                  </Text>
                </View>
              ) : null}
            </View>

            {resolvedBenefits.length > 0 ? (
              <View style={styles.benefits}>
                {resolvedBenefits.map((benefit) => (
                  <View key={benefit} style={styles.benefitRow}>
                    <View style={[styles.benefitIcon, { backgroundColor: tokens.colors.accentPurple }]}>
                      <MaterialIcons name="check" size={14} color="#FFFFFF" />
                    </View>
                    <Text variant="bodyLarge" style={[styles.benefitText, { color: tokens.colors.text }]}>
                      {benefit}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {shouldShowPlans ? (
              <View style={styles.plans}>
                {paywallPlans.map((plan) => {
                  const isSelected = plan.planId === selectedPlanId;
                  const planHasProduct = Boolean(plan.product);
                  const planSavingsPercentage = plan.planId === "yearly" ? yearlyPlanSavingsPercentage : null;
                  const isYearlyPlan = plan.planId === "yearly";
                  const planBackground = isSelected
                    ? selectedPlanBackground
                    : isYearlyPlan
                    ? annualPlanBackground
                    : monthlyPlanBackground;
                  const planBorderColor = isSelected
                    ? tokens.colors.accent
                    : isYearlyPlan
                    ? `${tokens.colors.accentPurple}66`
                    : cardMutedBorder;
                  const planTitleColor = isYearlyPlan ? tokens.colors.text : subtleTextColor;
                  const planShadowStyle = isYearlyPlan
                    ? {
                        shadowColor: premiumChipText,
                        shadowOpacity: isSelected ? 0.24 : 0.14,
                        shadowRadius: isSelected ? 18 : 12,
                        shadowOffset: { width: 0, height: 6 },
                        elevation: isSelected ? 7 : 4,
                      }
                    : null;
                  const planBadgeBackground = isYearlyPlan
                    ? isDark
                      ? "rgba(169,124,255,0.16)"
                      : "rgba(169,124,255,0.14)"
                    : premiumChipBackground;
                  const planBadgeBorder = isYearlyPlan ? `${premiumChipText}38` : `${premiumChipText}22`;

                  return (
                    <Pressable
                      key={plan.planId}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled: !planHasProduct }}
                      disabled={!planHasProduct}
                      onPress={() => onSelectPlan?.(plan.planId)}
                      style={({ pressed }) => [
                        styles.planCard,
                        isYearlyPlan ? styles.planCardAnnual : styles.planCardMonthly,
                        {
                          backgroundColor: planBackground,
                          borderColor: planBorderColor,
                          borderWidth: isYearlyPlan ? 2 : 1.5,
                          opacity: pressed ? 0.92 : planHasProduct ? 1 : 0.7,
                        },
                        planShadowStyle,
                      ]}
                    >
                      <GlassBlur intensity={18} tint={blurTint} fallbackColor="transparent" />
                      <View pointerEvents="none" style={[styles.planTint, { backgroundColor: isYearlyPlan ? yearlyPlanTint : "transparent" }]} />
                      <View
                        pointerEvents="none"
                        style={[
                          styles.planSheen,
                          {
                            backgroundColor: glassShine,
                            opacity: isYearlyPlan ? 1 : 0.7,
                          },
                        ]}
                      />

                      <View style={styles.planCardHeader}>
                        <Text variant="titleMedium" style={[styles.planTitle, { color: planTitleColor }]}>
                          {plan.planId === "yearly"
                            ? t("wallets.actions.planYearly", { defaultValue: "Yearly" })
                            : t("wallets.actions.planMonthly", { defaultValue: "Monthly" })}
                        </Text>

                        <View style={styles.planBadges}>
                          {plan.isBestValue ? (
                            <View
                              style={[
                                styles.planBadge,
                                isYearlyPlan ? styles.planBadgeAnnual : null,
                                { backgroundColor: planBadgeBackground, borderColor: planBadgeBorder },
                              ]}
                            >
                              <Text style={[styles.planBadgeText, { color: premiumChipText }]}>
                                {t("wallets.actions.planBestValue", { defaultValue: "Best value" })}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.planPriceBlock}>
                        {plan.displayPrice ? (
                          <View style={styles.planPriceRow}>
                            <Text
                              style={[
                                styles.planPrice,
                                isYearlyPlan ? styles.planPriceAnnual : styles.planPriceMonthly,
                                { color: tokens.colors.text },
                              ]}
                            >
                              {plan.displayPrice}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.planSkeletonGroup}>
                            <View style={[styles.skeletonLine, styles.skeletonPrice, { backgroundColor: skeletonColor }]} />
                          </View>
                        )}

                        {plan.planId === "yearly" && planSavingsPercentage ? (
                          <Text style={[styles.planAnchor, { color: tokens.colors.accentPurple }]}>
                            {t("wallets.actions.planSavingsPercentage", {
                              percent: planSavingsPercentage,
                              defaultValue: "Save {{percent}}% compared with monthly",
                            })}
                          </Text>
                        ) : plan.planId === "yearly" && !plan.displayPrice && isStoreLoading ? (
                          <Text style={[styles.planMeta, { color: subtleTextColor }]}>
                            {resolveDurationLabel(plan)}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {statusMessage ? (
              <View style={[styles.statusCard, { backgroundColor: cardMutedBackground, borderColor: cardMutedBorder }]}>
                <MaterialCommunityIcons name="information-outline" size={16} color={tokens.colors.accentPurple} />
                <Text style={[styles.statusText, { color: subtleTextColor }]}>{statusMessage}</Text>
              </View>
            ) : null}

            <View style={styles.ctaSection}>
              <Button
                mode="contained"
                buttonColor={tokens.colors.accent}
                textColor="#FFFFFF"
                onPress={onUpgrade}
                loading={primaryLoading}
                disabled={resolvedPrimaryDisabled}
                style={styles.primaryButton}
                contentStyle={styles.primaryButtonContent}
              >
                {resolvedCtaLabel}
              </Button>

              {billingHelper ? (
                <Text variant="bodySmall" style={[styles.billingHelper, { color: subtleTextColor }]}>
                  {billingHelper}
                </Text>
              ) : null}
            </View>

            {(secondaryActionLabel || tertiaryActionLabel) ? (
              <View style={styles.secondaryActions}>
                {secondaryActionLabel && onSecondaryAction ? (
                  <Button
                    mode="outlined"
                    textColor={tokens.colors.text}
                    onPress={onSecondaryAction}
                    loading={secondaryActionLoading}
                    disabled={primaryLoading || secondaryActionLoading || tertiaryActionLoading}
                    style={[styles.secondaryButton, { borderColor: cardMutedBorder }]}
                    contentStyle={styles.secondaryButtonContent}
                  >
                    {secondaryActionLabel}
                  </Button>
                ) : null}
                {tertiaryActionLabel && onTertiaryAction ? (
                  <Button
                    mode="text"
                    textColor={tokens.colors.accentPurple}
                    onPress={onTertiaryAction}
                    loading={tertiaryActionLoading}
                    disabled={primaryLoading || secondaryActionLoading || tertiaryActionLoading}
                    compact
                    contentStyle={styles.tertiaryButtonContent}
                  >
                    {tertiaryActionLabel}
                  </Button>
                ) : null}
              </View>
            ) : null}

            {legalLinks?.length ? (
              <View style={styles.legalLinks}>
                {legalLinks.map((link) => (
                  <Pressable
                    key={link.key}
                    accessibilityRole="button"
                    disabled={link.disabled}
                    onPress={link.onPress}
                    style={({ pressed }) => [styles.legalLinkButton, { opacity: pressed || link.disabled ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.legalLinkText, { color: tokens.colors.accentPurple }]}>{link.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Button
              mode="text"
              textColor={subtleTextColor}
              onPress={onSecondaryLabelPress ?? onClose}
              disabled={primaryLoading || secondaryActionLoading || tertiaryActionLoading}
              compact
              contentStyle={styles.dismissButtonContent}
            >
              {resolvedSecondaryLabel}
            </Button>
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
  portalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 16,
  },
  headerRow: {
    minHeight: 40,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    position: "relative",
    width: "100%",
  },
  headerCenter: {
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  balanceProChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  balanceProChipLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "absolute",
    right: 0,
    top: 2,
  },
  heroBlock: {
    gap: 8,
    alignItems: "center",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 25,
  },
  trustLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustText: {
    fontSize: 13,
    fontWeight: "600",
  },
  benefits: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    fontWeight: "600",
  },
  plans: {
    gap: 12,
  },
  planCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
    overflow: "hidden",
  },
  planCardAnnual: {
    minHeight: 128,
    paddingTop: 15,
    paddingBottom: 15,
  },
  planCardMonthly: {
    minHeight: 108,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  planSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  planTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  planTitle: {
    fontWeight: "700",
  },
  planBadges: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    flexShrink: 1,
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  planBadgeAnnual: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  planPriceBlock: {
    gap: 6,
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  planPrice: {
    fontWeight: "800",
    letterSpacing: -1,
  },
  planPriceAnnual: {
    fontSize: 30,
    lineHeight: 36,
  },
  planPriceMonthly: {
    fontSize: 30,
    lineHeight: 36,
  },
  planAnchor: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  planMeta: {
    fontSize: 13,
  },
  planSkeletonGroup: {
    gap: 10,
  },
  skeletonLine: {
    borderRadius: 999,
  },
  skeletonPrice: {
    width: 154,
    height: 18,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaSection: {
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 999,
  },
  primaryButtonContent: {
    minHeight: 56,
  },
  billingHelper: {
    textAlign: "center",
    lineHeight: 18,
  },
  secondaryActions: {
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 999,
  },
  secondaryButtonContent: {
    minHeight: 50,
  },
  tertiaryButtonContent: {
    minHeight: 34,
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  legalLinkButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  legalLinkText: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
  dismissButtonContent: {
    minHeight: 34,
  },
});
