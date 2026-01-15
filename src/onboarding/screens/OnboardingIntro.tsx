import React, { useRef, useState } from "react";
import { Alert, FlatList, SafeAreaView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import OnboardingSlide from "@/onboarding/components/OnboardingSlide";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { OnboardingStackParamList } from "@/onboarding/OnboardingNavigator";
import { setOnboardingCompleted } from "@/onboarding/onboardingStorage";
import type { SlideData } from "@/onboarding/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const slides: SlideData[] = [
  {
    title: "Benvenuto in OpenMoney",
    subtitle: "Tutte le tue finanze personali in un unico posto e sotto controllo.",
    bullets: ["Entrate e uscite organizzate", "Andamento chiaro nel tempo"],
    image: require("../../../assets/onboarding/onboarding-1.png"),
  },
  {
    title: "Open source e trasparente",
    subtitle: "Sai sempre cosa fa l’app e come funziona.",
    bullets: ["Codice pubblico", "Nessuna scatola nera"],
    image: require("../../../assets/onboarding/onboarding-2.png"),
  },
  {
    title: "Offline-first e privata",
    subtitle: "I tuoi dati restano solo sul tuo telefono.",
    bullets: ["Nessun account", "Nessun cloud", "Nessun tracciamento"],
    image: require("../../../assets/onboarding/onboarding-3.png"),
  },
  {
    title: "Iniziamo subito",
    subtitle: "Pochi passaggi per partire.",
    bullets: [],
    image: require("../../../assets/onboarding/onboarding-4.png"),
  },
];

type Props = {
  onComplete: () => void;
  shouldSeedOnComplete: boolean;
};

export default function OnboardingIntro({ onComplete, shouldSeedOnComplete }: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList, "OnboardingIntro">>();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<SlideData>>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const handleSkip = () => {
    Alert.alert("Saltare la configurazione?", "Puoi farla in seguito dal profilo.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Salta",
        onPress: async () => {
          if (shouldSeedOnComplete) {
            await setOnboardingCompleted(true);
          }
          onComplete();
        },
      },
    ]);
  };

  const scrollToIndex = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handlePrimaryPress = () => {
    if (activeIndex >= slides.length - 1) {
      navigation.navigate("OnboardingWallets");
      return;
    }
    requestAnimationFrame(() => scrollToIndex(activeIndex + 1));
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index?: number }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== undefined) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const CTA_HEIGHT = 140;
  const availableHeight = Math.max(height - insets.top - insets.bottom - CTA_HEIGHT, 320);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: tokens.colors.bg }]}>
      <View style={styles.sliderWrapper}>
        <FlatList
          ref={flatListRef}
          data={slides}
          keyExtractor={(item) => item.title}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.slider}
          contentContainerStyle={styles.sliderContainer}
          renderItem={({ item, index }) => (
            <View style={[styles.slidePage, { width }]}>
              <OnboardingSlide slide={item} isActive={activeIndex === index} availableHeight={availableHeight} />
            </View>
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        />
      </View>
      <View style={styles.footer}>
        <Button mode="contained" buttonColor={tokens.colors.accent} onPress={handlePrimaryPress}>
          {activeIndex >= slides.length - 1 ? "Inizia" : "Continua"}
        </Button>
        <Button mode="text" textColor={tokens.colors.muted} onPress={handleSkip}>
          Salta per ora
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sliderWrapper: {
    flex: 1,
  },
  slider: {
    flex: 1,
  },
  sliderContainer: {
    flexGrow: 1,
    justifyContent: "flex-start",
    alignItems: "stretch",
    paddingHorizontal: 24,
  },
  slidePage: {
    flex: 1,
    justifyContent: "flex-start",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 12,
  },
});
