import React, { useCallback, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import NumberPad from "@/security/components/NumberPad";
import PinDots from "@/security/components/PinDots";
import { hashPin } from "@/security/securityHash";
import { setPinHash } from "@/security/securityStorage";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type SetPinParams = {
  SetPinModal: {
    mode: "create" | "change";
    onPinSet: () => void;
  };
};

const SHAKE_DURATION = 80;
const SHAKE_DISTANCE = 8;

export default function SetPinModal(): JSX.Element {
  const [step, setStep] = useState<1 | 2>(1);
  const [firstPin, setFirstPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<SetPinParams, "SetPinModal">>();
  const { tokens } = useDashboardTheme();

  const translateX = useMemo(
    () =>
      shakeAnim.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0, -SHAKE_DISTANCE, SHAKE_DISTANCE, -SHAKE_DISTANCE, 0],
      }),
    [shakeAnim]
  );

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

  const title = params.mode === "change" ? "Cambia codice" : "Imposta codice";
  const stepTitle = step === 1 ? "Inserisci nuovo codice" : "Ripeti nuovo codice";

  const handleDigit = useCallback(
    (digit: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (step === 1) {
        if (firstPin.length >= 4) return;
        const next = (firstPin + digit).slice(0, 4);
        setFirstPin(next);
        if (next.length === 4) {
          setStep(2);
          setConfirmPin("");
          setError(null);
        }
        return;
      }
      if (confirmPin.length >= 4) return;
      const next = (confirmPin + digit).slice(0, 4);
      setConfirmPin(next);
      if (next.length === 4) {
        if (next !== firstPin) {
          setError("I codici non coincidono");
          triggerShake();
          setConfirmPin("");
          return;
        }
        (async () => {
          try {
            const hashed = await hashPin(next);
            await setPinHash(hashed);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            params.onPinSet();
            navigation.goBack();
          } catch {
            setError("I codici non coincidono");
            triggerShake();
            setConfirmPin("");
          }
        })();
      }
    },
    [confirmPin, firstPin, navigation, params, step, triggerShake]
  );

  const handleBackspace = useCallback(() => {
    if (step === 1) {
      setFirstPin((prev) => prev.slice(0, -1));
      return;
    }
    setConfirmPin((prev) => prev.slice(0, -1));
  }, [step]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: tokens.colors.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: tokens.colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>{stepTitle}</Text>
        <Animated.View style={{ transform: [{ translateX }] }}>
          <PinDots length={4} filled={step === 1 ? firstPin.length : confirmPin.length} color={tokens.colors.accent} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Animated.View>
        <NumberPad
          onPressDigit={handleDigit}
          onBackspace={(clearAll) => {
            if (clearAll) {
              setFirstPin("");
              setConfirmPin("");
              setStep(1);
              setError(null);
              return;
            }
            handleBackspace();
          }}
        />
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
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
  },
  error: {
    color: "#F87171",
    textAlign: "center",
  },
});
