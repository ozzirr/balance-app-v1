import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";
import GlassBlur from "@/ui/components/GlassBlur";
import { useIsFocused } from "@react-navigation/native";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  selectedRange: T;
  onChangeRange: (range: T) => void;
  options: Option<T>[];
  showLabel?: boolean;
  label?: string;
  accessibilityLabel?: string;
  dropdownMinWidth?: number;
};

export default function RangeSelector({
  selectedRange,
  onChangeRange,
  options,
  showLabel = true,
  label,
  accessibilityLabel,
  dropdownMinWidth,
}: Props<string>): JSX.Element {
  const { tokens, isDark } = useDashboardTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isFocused = useIsFocused();
  const [triggerSize, setTriggerSize] = useState({ width: 0, height: 0 });
  const anim = useRef(new Animated.Value(0)).current;
  const selectedLabel = useMemo(
    () => options.find((opt) => opt.value === selectedRange)?.label ?? "",
    [options, selectedRange]
  );
  const dropdownBackground =
    Platform.OS === "android" ? tokens.colors.surface2 : tokens.colors.modalGlassBg;
  const dropdownBorder =
    Platform.OS === "android" ? tokens.colors.border : tokens.colors.modalBorder;
  const resolvedDropdownMinWidth = dropdownMinWidth ?? 168;

  const openSheet = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
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
        setOpen(false);
      }
    });
  }, [anim]);

  const toggleSheet = useCallback(() => {
    if (open) {
      closeSheet();
      return;
    }
    openSheet();
  }, [closeSheet, open, openSheet]);

  useEffect(() => {
    if (!isFocused && open) {
      closeSheet();
    }
  }, [closeSheet, isFocused, open]);

  const dropdownStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-6, 0],
        }),
      },
      {
        scaleY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };
  const dropdownTop = triggerSize.height + 6;
  const dropdownWidth = Math.max(resolvedDropdownMinWidth, triggerSize.width);

  return (
    <>
      <View
        style={styles.wrapper}
        onLayout={(event) =>
          setTriggerSize({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
      >
        <Pressable
          onPress={toggleSheet}
          hitSlop={6}
          style={({ pressed }) => [
            styles.selectorRow,
            !showLabel && styles.selectorRowCompact,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ??
          t("dashboard.range.accessibility", {
            defaultValue: "Seleziona intervallo KPI",
          })
        }
        accessibilityState={{ expanded: open }}
      >
        {showLabel ? (
          <Text style={[styles.selectorLabel, { color: tokens.colors.muted }]}>
            {label ?? t("dashboard.range.label")}
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
      </View>
      {open ? (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.dropdown,
            {
              top: dropdownTop,
              right: 0,
              backgroundColor: dropdownBackground,
              borderColor: dropdownBorder,
              width: dropdownWidth,
            },
            dropdownStyle,
          ]}
        >
          <GlassBlur intensity={35} tint={isDark ? "dark" : "light"} fallbackColor="transparent" />
          {options.map((option, index) => {
            const selected = option.value === selectedRange;
            const isLast = index === options.length - 1;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChangeRange(option.value);
                  closeSheet();
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.dropdownRow,
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
                <Text
                  style={[styles.dropdownLabel, { color: tokens.colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {option.label}
                </Text>
                {selected ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={18}
                    color={tokens.colors.accent}
                    style={styles.checkIcon}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignSelf: "flex-start",
    overflow: "visible",
  },
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
    position: "relative",
    zIndex: 1,
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
  dropdown: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    overflow: "hidden",
    zIndex: 2,
  },
  dropdownRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 0,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
  },
  checkIcon: {
    position: "absolute",
    right: 12,
  },
});
