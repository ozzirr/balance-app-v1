import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OnboardingIntro from "./screens/OnboardingIntro";
import OnboardingWallets from "./screens/OnboardingWallets";
import OnboardingCategories from "./screens/OnboardingCategories";
import OnboardingIncomeRecurring from "./screens/OnboardingIncomeRecurring";
import OnboardingExpensesQuickAdd from "./screens/OnboardingExpensesQuickAdd";
import OnboardingDone from "./screens/OnboardingDone";
import { OnboardingProvider } from "./state/OnboardingContext";

export type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  OnboardingWallets: undefined;
  OnboardingCategories: undefined;
  OnboardingIncomeRecurring: undefined;
  OnboardingExpensesQuickAdd: undefined;
  OnboardingDone: undefined;
};

type Props = {
  onComplete: () => void;
  shouldSeedOnComplete?: boolean;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator({
  onComplete,
  shouldSeedOnComplete = true,
}: Props): JSX.Element {
  return (
    <OnboardingProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="OnboardingIntro">
          {() => (
            <OnboardingIntro onComplete={onComplete} shouldSeedOnComplete={shouldSeedOnComplete} />
          )}
        </Stack.Screen>
        <Stack.Screen name="OnboardingWallets">
          {() => <OnboardingWallets />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingCategories">
          {() => <OnboardingCategories />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingIncomeRecurring">
          {() => <OnboardingIncomeRecurring />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingExpensesQuickAdd">
          {() => <OnboardingExpensesQuickAdd />}
        </Stack.Screen>
        <Stack.Screen name="OnboardingDone">
          {() => (
            <OnboardingDone onComplete={onComplete} shouldSeedOnComplete={shouldSeedOnComplete} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
