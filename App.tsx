import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MD3DarkTheme, MD3LightTheme, Provider as PaperProvider } from "react-native-paper";
import { enableScreens } from "react-native-screens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useAppBootstrap } from "@/app/useAppBootstrap";
import DashboardScreen from "@/ui/screens/DashboardScreen";
import EntriesScreen from "@/ui/screens/EntriesScreen";
import SnapshotScreen from "@/ui/screens/SnapshotScreen";
import WalletScreen from "@/ui/screens/WalletScreen";
import SettingsScreen from "@/ui/screens/SettingsScreen";
import { ThemeContext } from "@/ui/theme";
import GlassTabBar from "@/ui/components/GlassTabBar";
import AppBackground from "@/ui/components/AppBackground";
import AppBootScreen from "@/ui/components/AppBootScreen";
import { DashboardThemeProvider } from "@/ui/dashboard/theme";
import ProfileButton from "@/components/header/ProfileButton";
import OnboardingNavigator from "@/onboarding/OnboardingNavigator";
import { OnboardingFlowProvider } from "@/onboarding/flowContext";
import { getOnboardingCompleted } from "@/onboarding/onboardingStorage";
import { StatusBar } from "expo-status-bar";

enableScreens(false);

const Tab = createBottomTabNavigator();

export default function App(): JSX.Element {
  const { ready, error, themeMode, setThemeMode, retry } = useAppBootstrap();
  const [onboardingCompleted, setOnboardingCompletedState] = useState<boolean | null>(null);
  const [manualOnboarding, setManualOnboarding] = useState(false);

  useEffect(() => {
    let mounted = true;
    getOnboardingCompleted().then((value) => {
      if (mounted) setOnboardingCompletedState(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setManualOnboarding(false);
    setOnboardingCompletedState(true);
  }, []);

  const requestManualOnboarding = useCallback(() => {
    setManualOnboarding(true);
  }, []);

  const paperTheme =
    themeMode === "dark"
      ? {
          ...MD3DarkTheme,
          colors: {
            ...MD3DarkTheme.colors,
            primary: "#A97CFF",
            secondary: "#6BA3FF",
          },
        }
      : {
          ...MD3LightTheme,
          colors: {
            ...MD3LightTheme.colors,
            primary: "#A97CFF",
            secondary: "#A97CFF",
          },
        };
  const navTheme = themeMode === "dark" ? DarkTheme : DefaultTheme;
  const headerBlurTint = themeMode === "dark" ? "dark" : "light";
  const headerOverlay =
    themeMode === "dark" ? "rgba(15, 18, 30, 0.55)" : "rgba(169, 124, 255, 0.32)";
  const headerBorder = themeMode === "dark" ? navTheme.colors.border : "rgba(169, 124, 255, 0.5)";

  return (
    <ThemeContext.Provider value={{ mode: themeMode, setMode: setThemeMode }}>
      <PaperProvider theme={paperTheme}>
        <DashboardThemeProvider isDark={paperTheme.dark}>
          <AppBackground>
            <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
            {!ready ? (
              <AppBootScreen status="loading" />
            ) : error ? (
              <AppBootScreen status="error" error={error} onRetry={retry} />
            ) : (
              <OnboardingFlowProvider value={{ requestReplay: requestManualOnboarding }}>
                <NavigationContainer theme={navTheme}>
                  {(!onboardingCompleted || manualOnboarding) ? (
                    <OnboardingNavigator
                      onComplete={handleOnboardingComplete}
                      shouldSeedOnComplete={!manualOnboarding}
                    />
                  ) : (
                    <Tab.Navigator
                      screenOptions={({ route }) => ({
                        headerTitleAlign: "center",
                        headerTransparent: true,
                        headerBackground: () => (
                          <BlurView
                            intensity={35}
                            tint={headerBlurTint}
                            style={[
                              StyleSheet.absoluteFill,
                              {
                                borderBottomWidth: 1,
                                borderBottomColor: headerBorder,
                                backgroundColor: headerOverlay,
                              },
                            ]}
                          />
                        ),
                        headerRight: () => <ProfileButton isSettingsScreen={route.name === "Impostazioni"} />,
                        tabBarStyle: { display: "none" },
                      })}
                      tabBar={(props) => <GlassTabBar {...props} />}
                    >
                      <Tab.Screen name="Dashboard" component={DashboardScreen} />
                      <Tab.Screen name="Snapshot" component={SnapshotScreen} />
                      <Tab.Screen name="Entrate/Uscite" component={EntriesScreen} />
                      <Tab.Screen name="Wallet" component={WalletScreen} />
                      <Tab.Screen
                        name="Impostazioni"
                        component={SettingsScreen}
                        options={{ tabBarButton: () => null }}
                      />
                    </Tab.Navigator>
                  )}
                </NavigationContainer>
              </OnboardingFlowProvider>
            )}
          </AppBackground>
        </DashboardThemeProvider>
      </PaperProvider>
    </ThemeContext.Provider>
  );
}
