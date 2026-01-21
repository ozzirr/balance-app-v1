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
        <View style={[styles.key, styles.invisibleKey]} pointerEvents="none" />
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
          <MaterialCommunityIcons name="backspace-outline" size={26} color="#F8F8FF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "column",
    alignItems: "center",
    marginTop: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  rowSpacing: {
    marginTop: 14,
  },
  key: {
    width: 76,
    height: 76,
    marginHorizontal: 9,
    borderRadius: 38,
    borderWidth: 1.4,
    borderColor: "rgba(193, 164, 255, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    shadowColor: "#B084FF",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
  },
  keyLabel: {
    fontSize: 29,
    color: "#F7F7FF",
    fontWeight: "600",
  },
  keyPressed: {
    transform: [{ scale: 0.965 }],
    backgroundColor: "rgba(193, 164, 255, 0.12)",
    borderColor: "#CBA8FF",
    shadowOpacity: 0.45,
  },
  keyDisabled: {
    opacity: 0.35,
  },
  invisibleKey: {
    opacity: 0,
  },
});
