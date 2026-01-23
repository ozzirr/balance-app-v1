import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
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
import * as Haptics from "expo-haptics";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { hashPin } from "./securityHash";
import type { SecurityConfig } from "./securityTypes";
import PinDots from "./components/PinDots";
import NumberPad from "./components/NumberPad";
import FaceIdChip from "./components/FaceIdChip";
import { getBiometryName, getBiometryUnlockCtaLabel } from "./biometryCopy";
import { authenticateForUnlock, getBiometryHardwareInfo } from "./securityBiometry";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

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
        setError(t("security.lock.invalidPin"));
        triggerShake();
      } catch {
        setError(t("security.lock.pinCheckFailed"));
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
    [config.pinHash, onAuthenticated, triggerShake, t]
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

  const authInProgressRef = useRef(false);
  const authDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState ?? "active");

  const runBiometry = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!config.biometryEnabled) return false;
      if (authInProgressRef.current) {
        console.log("[FaceID] Authentication attempt skipped because another attempt is in progress");
        return false;
      }
      if (appStateRef.current !== "active") {
        console.log(`[FaceID] Authentication attempt skipped because app state is ${appStateRef.current}`);
        return false;
      }
      const silent = options?.silent ?? false;
      if (!silent) {
        setBusy(true);
        setError(null);
      }
      authInProgressRef.current = true;
      try {
        const info = await getBiometryHardwareInfo();
        if (!info.hasHardware || !info.hasEnrolled) {
        if (!silent) {
          setError(t("security.lock.biometryUnavailable"));
        }
          setBiometryAvailable(false);
          return false;
        }
        const { success, error } = await authenticateForUnlock();
        if (success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onAuthenticated();
          return true;
        }
        if (!silent) {
          const message =
            error === "lockout"
              ? t("security.lock.biometryLockout", { biometryName: getBiometryName() })
              : t("security.lock.biometryFailed");
          setError(message);
        }
        return false;
      } catch (error) {
        console.log("[FaceID] runBiometry exception", error);
        if (!silent) {
          setError(t("security.lock.biometryError"));
        }
        return false;
      } finally {
        authInProgressRef.current = false;
        if (!silent) {
          setBusy(false);
        }
      }
    },
    [config.biometryEnabled, onAuthenticated, t]
  );

  const scheduleBiometry = useCallback(
    (options?: { silent?: boolean }) => {
      if (!config.biometryEnabled) {
        console.log("[FaceID] schedule skipped because biometry is disabled");
        return;
      }
      if (appStateRef.current !== "active") {
        console.log(`[FaceID] schedule skipped because app state is ${appStateRef.current}`);
        return;
      }
      if (authDelayTimerRef.current) {
        clearTimeout(authDelayTimerRef.current);
      }
      authDelayTimerRef.current = setTimeout(() => {
        authDelayTimerRef.current = null;
        void runBiometry(options);
      }, 300);
    },
    [config.biometryEnabled, runBiometry]
  );

  const handleBiometry = useCallback(() => {
    scheduleBiometry({ silent: false });
  }, [scheduleBiometry]);

  useEffect(() => {
    let active = true;
    if (!config.biometryEnabled) {
      if (authDelayTimerRef.current) {
        clearTimeout(authDelayTimerRef.current);
        authDelayTimerRef.current = null;
      }
      setBiometryAvailable(false);
      setAutoBiometryTried(false);
      return () => {
        active = false;
      };
    }
    (async () => {
      const info = await getBiometryHardwareInfo();
      if (!active) return;
      const available = info.hasHardware && info.hasEnrolled;
      setBiometryAvailable(available);
      if (available && !autoBiometryTried) {
        setAutoBiometryTried(true);
        scheduleBiometry({ silent: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [autoBiometryTried, config.biometryEnabled, scheduleBiometry]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState === "active" && config.biometryEnabled) {
        setAutoBiometryTried(false);
      }
    });
    return () => subscription.remove();
  }, [config.biometryEnabled]);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
      if (authDelayTimerRef.current) {
        clearTimeout(authDelayTimerRef.current);
        authDelayTimerRef.current = null;
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
      <Animated.View style={[styles.content, { transform: [{ translateX }] }]}>
        <Text style={styles.inputLabel}>{t("security.lock.enterPinLabel")}</Text>
        <PinDots length={4} filled={pin.length} color={tintColor} style={styles.pinDots} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.hintText}>
          {t("security.lock.biometryHint", { biometryName: getBiometryName() })}
        </Text>
        <NumberPad
          onPressDigit={handleDigitPress}
          onBackspace={(clearAll) => (clearAll ? handleClearAll() : handleBackspace())}
          disabled={busy}
          style={styles.keyWrapper}
        />
        <View style={styles.bottomRow}>
          <Pressable onPress={() => {}} hitSlop={10} style={[styles.bottomAction, styles.bottomLeft]}>
            <Text style={styles.bottomText}>{t("security.lock.forgotPin")}</Text>
          </Pressable>
          <View style={[styles.bottomAction, styles.bottomCenter]}>
            <FaceIdChip
              onPress={handleBiometry}
              disabled={!shouldShowFaceId}
              style={[matrixStyle, !shouldShowFaceId && styles.faceIdDisabled]}
            />
          </View>
          <Pressable
            onPress={handleBiometry}
            hitSlop={10}
            disabled={!shouldShowFaceId}
            style={[styles.bottomAction, styles.bottomRight]}
          >
              <Text
                style={[
                  styles.bottomText,
                  !shouldShowFaceId && styles.bottomTextDisabled,
                ]}
              >
                {getBiometryUnlockCtaLabel()}
              </Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 8,
  },
  inputLabel: {
    fontSize: 20,
    letterSpacing: 0.4,
    color: "#FBFBFF",
    textAlign: "center",
  },
  keyWrapper: {
    alignItems: "center",
    width: "100%",
    marginTop: 10,
  },
  hintText: {
    fontSize: 13,
    textAlign: "center",
    color: "#F0EEFA",
    opacity: 0.92,
  },
  errorText: {
    color: "#F87171",
    textAlign: "center",
    fontSize: 13,
  },
  bottomRow: {
    position: "absolute",
    bottom: 26,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  bottomText: {
    fontSize: 13,
    color: "#E5E2F8",
    textAlign: "center",
  },
  bottomTextDisabled: {
    opacity: 0.35,
  },
  bottomAction: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  bottomLeft: {
    width: "33%",
    alignItems: "center",
  },
  bottomCenter: {
    width: "33%",
    alignItems: "center",
  },
  bottomRight: {
    width: "33%",
    alignItems: "center",
  },
  faceIdDisabled: {
    opacity: 0.35,
  },
  pinDots: {
    marginVertical: 14,
  },
});
