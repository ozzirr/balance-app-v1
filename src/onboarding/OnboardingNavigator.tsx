import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OnboardingWelcome from "./screens/OnboardingWelcome";
import OnboardingProImport from "./screens/OnboardingProImport";
import OnboardingName from "./screens/OnboardingName";
import OnboardingInvestments from "./screens/OnboardingInvestments";
import { IS_PRO_VARIANT } from "@/config/entitlements";

export type OnboardingStackParamList = {
  OnboardingWelcome: undefined;
  OnboardingProImport: undefined;
  OnboardingName: undefined;
  OnboardingIntro: undefined;
  OnboardingWallets: undefined;
  OnboardingCategories: undefined;
  OnboardingIncomeRecurring: undefined;
  OnboardingExpensesQuickAdd: undefined;
  OnboardingDone: undefined;
  OnboardingInvestments: undefined;
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
  const isProVariant = IS_PRO_VARIANT;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingWelcome">
        {({ navigation }) => (
          <OnboardingWelcome
            variant={isProVariant ? "pro" : "free"}
            onNext={() => navigation.navigate("OnboardingName")}
            onSkip={onComplete}
            onImport={isProVariant ? () => navigation.navigate("OnboardingProImport") : undefined}
          />
        )}
      </Stack.Screen>
      {isProVariant ? (
        <Stack.Screen name="OnboardingProImport">
          {({ navigation }) => (
            <OnboardingProImport
              onImportComplete={onComplete}
              onContinueGuided={() => navigation.replace("OnboardingName")}
            />
          )}
        </Stack.Screen>
      ) : null}
      <Stack.Screen name="OnboardingName">
        {({ navigation }) => (
          <OnboardingName
            onNext={() => navigation.navigate("OnboardingInvestments")}
            onSkip={onComplete}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OnboardingInvestments">
        {() => (
          <OnboardingInvestments
            onFinish={onComplete}
            shouldSeedOnComplete={shouldSeedOnComplete}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
