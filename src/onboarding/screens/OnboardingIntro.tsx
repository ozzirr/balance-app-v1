import React, { useRef, useState } from "react";
import { Alert, FlatList, SafeAreaView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import OnboardingDots from "@/onboarding/components/OnboardingDots";
import OnboardingSlide from "@/onboarding/components/OnboardingSlide";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { OnboardingStackParamList } from "@/onboarding/OnboardingNavigator";
import { setOnboardingCompleted } from "@/onboarding/onboardingStorage";
import { useOnboardingDraft } from "@/onboarding/state/OnboardingContext";
import type { SlideData } from "@/onboarding/types";

const slides: SlideData[] = [
  {
    title: "Benvenuto in OpenMoney",
    subtitle: "La tua finanza personale, chiara e in un unico posto.",
    bullets: [
      "Entrate, uscite e ricorrenze sotto controllo",
      "Grafici smart per l’andamento nel tempo",
      "Setup in meno di 2 minuti",
    ],
  },
  {
    title: "Open source. Trasparente",
    subtitle: "Il codice è pubblico. Quello che fa l’app è verificabile.",
    bullets: ["Nessuna scatola nera", "Community-driven", "Più fiducia sui dati sensibili"],
  },
  {
    title: "Offline-first. Privacy",
    subtitle: "Niente account. Niente cloud. Niente tracking.",
    bullets: ["I dati restano sul dispositivo", "Funziona senza internet", "Meno rischi"],
  },
  {
    title: "Facciamo il primo setup",
    subtitle: "Aggiungi l’essenziale. Poi rifinisci quando vuoi.",
    bullets: ["1 wallet di liquidità", "1 entrata ricorrente", "2–3 uscite"],
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
  const { width } = useWindowDimensions();
  const { resetDraft } = useOnboardingDraft();

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
    scrollToIndex(activeIndex + 1);
  };

  const handleRestart = () => {
    resetDraft();
    scrollToIndex(0);
    setActiveIndex(0);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index?: number }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== undefined) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: tokens.colors.bg }]}>
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.slider}
        contentContainerStyle={styles.sliderContainer}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <OnboardingSlide slide={item} />
          </View>
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        />
      <View style={styles.dotsArea}>
        <OnboardingDots count={slides.length} activeIndex={activeIndex} />
        <Button mode="text" textColor={tokens.colors.accent} onPress={handleRestart}>
          Ricomincia
        </Button>
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
    paddingTop: 32,
    justifyContent: "space-between",
  },
  slider: {
    flexGrow: 0,
  },
  sliderContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  dotsArea: {
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 12,
  },
});
