import React, { useCallback, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import NumberPad from "@/security/components/NumberPad";
import PinDots from "@/security/components/PinDots";
import { hashPin } from "@/security/securityHash";
import { getPinHash } from "@/security/securityStorage";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { useTranslation } from "react-i18next";

type VerifyPinRoute = RouteProp<{ VerifyPinModal: { onVerified: () => void } }, "VerifyPinModal">;
const SHAKE_DURATION = 80;
const SHAKE_DISTANCE = 8;

export default function VerifyPinModal(): JSX.Element {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();
  const { params } = useRoute<VerifyPinRoute>();
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 1,
        duration: SHAKE_DURATION * 5,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: SHAKE_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [shakeAnim]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 4) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const value = (pin + digit).slice(0, 4);
      setPin(value);
      if (value.length === 4) {
        (async () => {
          try {
            const stored = await getPinHash();
            if (!stored) {
              setError(t("security.pin.wrongPin"));
              triggerShake();
              setTimeout(() => setPin(""), 400);
              return;
            }
            const hashed = await hashPin(value);
            if (hashed === stored) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.goBack();
              params.onVerified();
            } else {
              setError(t("security.pin.wrongPin"));
              triggerShake();
              setTimeout(() => setPin(""), 400);
            }
          } catch {
            setError(t("security.pin.wrongPin"));
            triggerShake();
            setTimeout(() => setPin(""), 400);
          }
        })();
      }
    },
    [pin, navigation, params, triggerShake, t]
  );

  const translateX = useMemo(
    () =>
      shakeAnim.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0, -SHAKE_DISTANCE, SHAKE_DISTANCE, -SHAKE_DISTANCE, 0],
      }),
    [shakeAnim]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: tokens.colors.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: tokens.colors.text }]}>{t("security.pin.verifyTitle")}</Text>
        <Animated.View style={{ transform: [{ translateX }] }}>
          <PinDots length={4} filled={pin.length} color={tokens.colors.accent} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Animated.View>
        <NumberPad onPressDigit={handleDigit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  error: {
    color: "#F87171",
    textAlign: "center",
  },
});
