import React from "react";
import { View, Pressable, Text, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

type NumberPadProps = {
  onPressDigit: (digit: string) => void;
  onBackspace?: (clearAll?: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const DIGIT_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

const triggerHaptics = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function NumberPad({
  onPressDigit,
  onBackspace,
  disabled = false,
  style,
}: NumberPadProps): JSX.Element {
  const handleDigit = (digit: string) => {
    if (disabled) return;
    triggerHaptics();
    onPressDigit(digit);
  };

  const handleBackspacePress = () => {
    if (disabled) return;
    triggerHaptics();
    onBackspace?.();
  };

  const handleBackspaceLongPress = () => {
    if (disabled) return;
    onBackspace?.(true);
  };

  return (
    <View style={[styles.wrapper, style]}>
      {DIGIT_ROWS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.row, rowIndex > 0 && styles.rowSpacing]}>
          {row.map((digit) => (
            <Pressable
              key={digit}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed, disabled && styles.keyDisabled]}
              onPress={() => handleDigit(digit)}
              disabled={disabled}
            >
              <Text style={styles.keyLabel}>{digit}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={[styles.row, styles.rowSpacing]}>
        <View style={styles.keyPlaceholder} />
        <Pressable
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed, disabled && styles.keyDisabled]}
          onPress={() => handleDigit("0")}
          disabled={disabled}
        >
          <Text style={styles.keyLabel}>0</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed, disabled && styles.keyDisabled]}
          onPress={handleBackspacePress}
          onLongPress={handleBackspaceLongPress}
          hitSlop={10}
          disabled={disabled}
        >
          <MaterialCommunityIcons name="backspace-outline" size={28} color="#F9FBFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "column",
    marginTop: 24,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  rowSpacing: {
    marginTop: 12,
  },
  key: {
    width: 72,
    height: 72,
    marginHorizontal: 8,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  keyLabel: {
    fontSize: 28,
    color: "#F9FBFF",
    fontWeight: "600",
  },
  keyPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: "rgba(169, 124, 255, 0.2)",
    borderColor: "#A97CFF",
    shadowOpacity: 0.4,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyPlaceholder: {
    width: 72,
    height: 72,
    marginHorizontal: 8,
  },
});
