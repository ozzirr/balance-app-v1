import React, { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DarkTheme } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import type { KpiDeltaRange } from "@/ui/dashboard/types";
import GlassBlur from "@/ui/components/GlassBlur";

type Option = { value: KpiDeltaRange; label: string };

type Props = {
  selectedRange: KpiDeltaRange;
  onChangeRange: (range: KpiDeltaRange) => void;
  options: Option[];
  showLabel?: boolean;
};

export default function RangeSelector({
  selectedRange,
  onChangeRange,
  options,
  showLabel = true,
}: Props): JSX.Element {
  const { tokens, isDark } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === selectedRange)?.label ?? "",
    [options, selectedRange]
  );
  const sheetBackground =
    Platform.OS === "android"
      ? tokens.colors.surface2
      : isDark
      ? "rgba(15, 18, 30, 0.55)"
      : "rgba(169, 124, 255, 0.32)";
  const sheetBorder =
    Platform.OS === "android"
      ? tokens.colors.border
      : isDark
      ? DarkTheme.colors.border
      : "rgba(169, 124, 255, 0.5)";
  const blurIntensity = 35;
  const overlayTint = isDark ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.18)";

  const openSheet = useCallback(() => {
    setModalVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [anim]);

  const closeSheet = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setModalVisible(false);
      }
    });
  }, [anim]);

  const sheetTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [64, 0],
  });

  return (
    <>
      <Pressable
        onPress={openSheet}
        hitSlop={6}
        style={({ pressed }) => [
          styles.selectorRow,
          !showLabel && styles.selectorRowCompact,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Periodo: ${selectedLabel}`}
      >
        {showLabel ? (
          <Text style={[styles.selectorLabel, { color: tokens.colors.muted }]}>
            {t("dashboard.range.label")}
          </Text>
        ) : null}
        <View style={styles.selectorValue}>
          <Text
            style={[
              styles.selectorValueText,
              !showLabel && styles.selectorValueTextCompact,
              { color: tokens.colors.accent },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selectedLabel}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={tokens.colors.accent} />
        </View>
      </Pressable>
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        onRequestClose={closeSheet}
      >
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet}>
            <Animated.View
              pointerEvents="none"
              style={[styles.overlayDim, { backgroundColor: overlayTint, opacity: anim }]}
            />
          </Pressable>
            <Animated.View
              pointerEvents="auto"
              style={[
                styles.sheet,
                {
                  backgroundColor: sheetBackground,
                  borderColor: sheetBorder,
                  paddingBottom: insets.bottom + 12,
                  transform: [{ translateY: sheetTranslateY }],
                  opacity: anim,
                },
              ]}
            >
            <GlassBlur intensity={blurIntensity} tint={isDark ? "dark" : "light"} fallbackColor="transparent" />
            <Text style={[styles.sheetTitle, { color: tokens.colors.text }]}>
              {t("dashboard.range.title")}
            </Text>
            <Text style={[styles.sheetSubtitle, { color: tokens.colors.muted }]}>
              {t("dashboard.range.subtitle")}
            </Text>
            <View style={styles.sheetList}>
              {options.map((option, index) => {
                const selected = option.value === selectedRange;
                const isLast = index === options.length - 1;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChangeRange(option.value);
                    }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.sheetRow,
                      {
                        borderColor: tokens.colors.glassBorder,
                        backgroundColor: selected
                          ? `${tokens.colors.accent}22`
                          : pressed
                          ? `${tokens.colors.glassBorder}33`
                          : "transparent",
                        borderBottomWidth: isLast ? 0 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.sheetLabel, { color: tokens.colors.text }]}>{option.label}</Text>
                    {selected ? (
                      <MaterialCommunityIcons name="check" size={18} color={tokens.colors.accent} style={styles.checkIcon} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 0,
    maxWidth: "100%",
    alignSelf: "flex-start",
    gap: 4,
  },
  selectorRowCompact: {
    minWidth: 0,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "transparent",
  },
  selectorValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "80%",
    flexShrink: 1,
  },
  selectorValueText: {
    fontSize: 13,
    fontWeight: "600",
  },
  selectorValueTextCompact: {
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 18,
    overflow: "hidden",
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: -6,
    marginBottom: 8,
  },
  sheetList: {
    gap: 0,
  },
  sheetRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0,
  },
  sheetLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  checkIcon: {
    position: "absolute",
    right: 12,
  },
});
