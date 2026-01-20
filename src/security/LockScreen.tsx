import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import * as Haptics from "expo-haptics";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { hashPin } from "./securityHash";
import type { SecurityConfig } from "./securityTypes";
import PinDots from "./components/PinDots";
import NumberPad from "./components/NumberPad";
import FaceIdChip from "./components/FaceIdChip";

type LockScreenProps = {
  config: SecurityConfig;
  onAuthenticated: () => void;
  style?: StyleProp<ViewStyle>;
};

const SHAKE_DURATION = 80;
const SHAKE_DISTANCE = 8;

export default function LockScreen({ config, onAuthenticated, style }: LockScreenProps): JSX.Element {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [autoBiometryTried, setAutoBiometryTried] = useState(false);
  const { tokens } = useDashboardTheme();

  const tintColor = tokens.colors.accent;
  const translateX = shakeAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -SHAKE_DISTANCE, SHAKE_DISTANCE, -SHAKE_DISTANCE, 0],
  });

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

  const verifyPin = useCallback(
    async (value: string) => {
      if (!config.pinHash) return;
      setBusy(true);
      setError(null);
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
      let matched = false;
      try {
        const hashed = await hashPin(value);
        if (hashed === config.pinHash) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onAuthenticated();
          matched = true;
          setPin("");
          return;
        }
        setError("Codice errato");
        triggerShake();
      } catch {
        setError("Impossibile verificare il codice");
        triggerShake();
      } finally {
        setBusy(false);
        Keyboard.dismiss();
        if (!matched) {
          resetTimer.current = setTimeout(() => {
            setPin("");
          }, 400);
        }
      }
    },
    [config.pinHash, onAuthenticated, triggerShake]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (busy) return;
      if (pin.length >= 4) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nextValue = (pin + digit).slice(0, 4);
      setPin(nextValue);
      if (nextValue.length === 4) {
        verifyPin(nextValue);
      }
    },
    [busy, pin, verifyPin]
  );

  const handleBackspace = useCallback(() => {
    if (busy) return;
    setPin((prev) => prev.slice(0, -1));
  }, [busy]);

  const handleClearAll = useCallback(() => {
    if (busy) return;
    setPin("");
  }, [busy]);

  const handleBiometry = useCallback(() => {
    runBiometry();
  }, [runBiometry]);

  useEffect(() => {
    let active = true;
    if (!config.biometryEnabled) {
      setBiometryAvailable(false);
      setAutoBiometryTried(false);
      return;
    }
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const hasEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!active) return;
      const available = hasHardware && hasEnrolled;
      setBiometryAvailable(available);
      if (available && !autoBiometryTried) {
        setAutoBiometryTried(true);
        runBiometry({ silent: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [autoBiometryTried, config.biometryEnabled, runBiometry]);

  const runBiometry = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!config.biometryEnabled) return false;
      const silent = options?.silent ?? false;
      if (!silent) {
        setBusy(true);
        setError(null);
      }
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const hasEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !hasEnrolled) {
          if (!silent) {
            setError("Autenticazione biometrica non disponibile");
          }
          return false;
        }
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Sblocca OpenMoney",
          cancelLabel: "Annulla",
          disableDeviceFallback: true,
          fallbackLabel: "",
        });
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onAuthenticated();
          return true;
        }
        if (!silent) {
          setError("Autenticazione biometrica fallita");
        }
        return false;
      } catch {
        if (!silent) {
          setError("Errore durante l'autenticazione biometrica");
        }
        return false;
      } finally {
        if (!silent) {
          setBusy(false);
        }
      }
    },
    [config.biometryEnabled, onAuthenticated]
  );

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, []);

  const matrixStyle = useMemo(
    () => ({
      borderColor: tintColor,
      borderRadius: 26,
      padding: 24,
      backgroundColor: "rgba(13, 16, 27, 0.7)",
    }),
    [tintColor]
  );
  const shouldShowFaceId = biometryAvailable && config.biometryEnabled;

  return (
    <SafeAreaView style={[styles.safeArea, style]}>
      <BlurView intensity={65} tint="dark" style={styles.blur}>
        <Animated.View style={[styles.container, { transform: [{ translateX }], borderColor: tintColor }]}>
          <Text style={styles.inputLabel}>Inserisci codice a 4 cifre</Text>
          <PinDots length={4} filled={pin.length} color={tintColor} />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.hintText}>
            Puoi attivare Face ID dalle impostazioni
          </Text>
          <View style={styles.keyWrapper}>
          <NumberPad
            onPressDigit={handleDigitPress}
            onBackspace={(clearAll) => (clearAll ? handleClearAll() : handleBackspace())}
            disabled={busy}
          />
          </View>
          <View style={styles.bottomRow}>
            <Pressable onPress={() => {}} hitSlop={10}>
              <Text style={styles.bottomText}>Codice dimenticato?</Text>
            </Pressable>
            <View style={styles.bottomCenter}>
              {shouldShowFaceId ? (
                <FaceIdChip onPress={handleBiometry} style={matrixStyle} />
              ) : (
                <View style={styles.bottomPlaceholder} />
              )}
            </View>
            <View style={styles.bottomRight}>
              {shouldShowFaceId ? (
                <Pressable onPress={handleBiometry} hitSlop={10}>
                  <Text style={styles.bottomText}>Usa Face ID</Text>
                </Pressable>
              ) : (
                <View style={styles.bottomPlaceholder} />
              )}
            </View>
          </View>
        </Animated.View>
      </BlurView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  blur: {
    flex: 1,
    backgroundColor: "rgba(4, 6, 12, 0.55)",
  },
  container: {
    flex: 1,
    marginHorizontal: 24,
    marginVertical: 40,
    borderWidth: 1,
    borderRadius: 32,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "rgba(11, 15, 26, 0.55)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
    gap: 12,
  },
  inputLabel: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 0.4,
    color: "#F7F7FC",
  },
  keyWrapper: {
    alignItems: "center",
  },
  hintText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    color: "#D0CFF4",
  },
  errorText: {
    color: "#F87171",
    textAlign: "center",
    fontSize: 13,
  },
  bottomRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomCenter: {
    flex: 1,
    alignItems: "center",
  },
  bottomRight: {
    minWidth: 90,
    alignItems: "flex-end",
  },
  bottomPlaceholder: {
    width: 68,
    height: 68,
  },
  bottomText: {
    fontSize: 13,
    color: "#D0CFF4",
  },
});
