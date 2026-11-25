import React from "react";
import { Image, StyleSheet, View } from "react-native";

const illustrations = {
  welcome: require("../../../assets/onboarding/welcome.png"),
  profile: require("../../../assets/onboarding/profile.png"),
  investments: require("../../../assets/onboarding/investments.png"),
  setup: require("../../../assets/onboarding/setup.png"),
};

export default function OnboardingIllustration({ scene }: { scene: keyof typeof illustrations }) {
  return (
    <View style={[styles.frame, scene === "setup" && styles.compact]}>
      <Image source={illustrations[scene]} style={styles.image} resizeMode="contain" accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: "stretch", height: 146, marginBottom: 12 },
  compact: { height: 106, marginBottom: 0 },
  image: { width: "100%", height: "100%" },
});
