import React, { useEffect, useRef } from "react";
import { Animated, Easing, ImageSourcePropType, StyleSheet, View } from "react-native";

type AnimatedSplashOverlayProps = {
  visible: boolean;
  active: boolean;
  onAnimationComplete: () => void;
};

const ICON_SOURCE: ImageSourcePropType = require("../../../assets/splash-icon.png");
const SPLASH_BACKGROUND_COLOR = "#0B0E1A";

export default function AnimatedSplashOverlay({
  visible,
  active,
  onAnimationComplete,
}: AnimatedSplashOverlayProps): JSX.Element | null {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || !active) {
      return;
    }
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 18,
        duration: 550,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(onAnimationComplete, 150);
    });
  }, [visible, active, onAnimationComplete, opacity, scale]);

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.overlay, { backgroundColor: SPLASH_BACKGROUND_COLOR }]} pointerEvents="auto">
      <Animated.Image
        source={ICON_SOURCE}
        style={[styles.icon, { opacity, transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  icon: {
    width: 96,
    height: 96,
  },
});
