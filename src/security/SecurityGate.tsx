import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getSecurityConfig } from "./securityStorage";
import LockScreen from "./LockScreen";
import type { SecurityConfig } from "./securityTypes";
import GlassBlur from "@/ui/components/GlassBlur";

type SecurityGateProps = {
  children: React.ReactNode;
};

export default function SecurityGate({ children }: SecurityGateProps): JSX.Element {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    let active = true;
    getSecurityConfig()
      .then((value) => {
        if (active) {
          setConfig(value);
        }
      })
      .catch(() => {
        if (active) {
          setConfig({
            securityEnabled: false,
            biometryEnabled: false,
            pinHash: null,
            autoLockEnabled: false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const autoLockEnabled = config?.autoLockEnabled ?? false;
  useEffect(() => {
    if (unlocked) {
      lastActivityRef.current = Date.now();
    }
  }, [unlocked]);

  useEffect(() => {
    if (!autoLockEnabled || !unlocked) {
      return;
    }
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= 60_000) {
        setUnlocked(false);
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [autoLockEnabled, unlocked]);

  const handleInteraction = useCallback(() => {
    if (unlocked && autoLockEnabled) {
      lastActivityRef.current = Date.now();
    }
  }, [autoLockEnabled, unlocked]);

  if (!config) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  const requiresUnlock = config.securityEnabled && !unlocked && Boolean(config.pinHash);

  return (
    <View style={styles.root}>
      {children}
      {requiresUnlock ? (
        <View
          style={styles.lockScreenOverlay}
          pointerEvents="auto"
          onTouchStart={handleInteraction}
        >
          <GlassBlur intensity={40} tint="dark" fallbackColor="rgba(8,10,18,0.5)" />
          <View style={styles.overlay} />
          <LockScreen
            config={config}
            onAuthenticated={() => setUnlocked(true)}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  root: {
    flex: 1,
  },
  lockScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 10, 18, 0.10)",
  },
});
