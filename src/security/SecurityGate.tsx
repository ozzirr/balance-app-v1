import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getSecurityConfig } from "./securityStorage";
import LockScreen from "./LockScreen";
import type { SecurityConfig } from "./securityTypes";

type SecurityGateProps = {
  children: React.ReactNode;
};

export default function SecurityGate({ children }: SecurityGateProps): JSX.Element {
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [unlocked, setUnlocked] = useState(false);

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
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (!config) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  const requiresUnlock = config.securityEnabled && !unlocked && Boolean(config.pinHash);

  return (
    <>
      {children}
      {requiresUnlock ? (
        <View style={styles.lockScreenOverlay}>
          <LockScreen
            config={config}
            onAuthenticated={() => setUnlocked(true)}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 20,
  },
});
