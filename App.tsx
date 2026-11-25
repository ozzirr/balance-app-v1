// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Balance contributors

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MD3DarkTheme, MD3LightTheme, Provider as PaperProvider } from "react-native-paper";
import { enableScreens } from "react-native-screens";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import AnimatedSplashOverlay from "@/ui/splash/AnimatedSplashOverlay";
import { useAppBootstrap } from "@/app/useAppBootstrap";
import DashboardScreen from "@/ui/screens/DashboardScreen";
import EntriesScreen from "@/ui/screens/EntriesScreen";
import SnapshotScreen from "@/ui/screens/SnapshotScreen";
import WalletScreen from "@/ui/screens/WalletScreen";
import SettingsScreen from "@/ui/screens/SettingsScreen";
import NewsScreen from "@/ui/screens/NewsScreen";
import { ThemeContext } from "@/ui/theme";
import GlassTabBar from "@/ui/components/GlassTabBar";
import TabContentTransition, { TabTransitionProvider } from "@/ui/components/TabContentTransition";
import AppBackground from "@/ui/components/AppBackground";
import AppBootScreen from "@/ui/components/AppBootScreen";
import { DashboardThemeProvider } from "@/ui/dashboard/theme";
import AppHeader from "@/ui/components/AppHeader";
import OnboardingNavigator from "@/onboarding/OnboardingNavigator";
import { OnboardingFlowProvider } from "@/onboarding/flowContext";
import { getOnboardingCompleted, setOnboardingCompleted } from "@/onboarding/onboardingStorage";
import { StatusBar } from "expo-status-bar";
import SecurityGate from "@/security/SecurityGate";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SetPinModal from "@/security/modals/SetPinModal";
import VerifyPinModal from "@/security/modals/VerifyPinModal";
import { getSecurityConfig } from "@/security/securityStorage";
import type { SecurityModalStackParamList } from "@/security/securityFlowsTypes";
import { initI18n } from "@/i18n";
import { SettingsProvider } from "@/settings/useSettings";
import { BalanceProProvider } from "@/features/pro/BalanceProProvider";
import i18n from "i18next";

enableScreens(false);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();
const SettingsTab = () => <TabContentTransition index={-1} routeName="Impostazioni"><SettingsScreen /></TabContentTransition>;
const DashboardTab = () => <TabContentTransition index={0} routeName="Dashboard"><DashboardScreen /></TabContentTransition>;
const SnapshotTab = () => <TabContentTransition index={1} routeName="Snapshot"><SnapshotScreen /></TabContentTransition>;
const EntriesTab = () => <TabContentTransition index={2} routeName="Balance"><EntriesScreen /></TabContentTransition>;
const WalletTab = () => <TabContentTransition index={3} routeName="Wallet"><WalletScreen /></TabContentTransition>;
const NewsTab = () => <TabContentTransition index={4} routeName="News"><NewsScreen /></TabContentTransition>;
type RootStackParamList = SecurityModalStackParamList & {
  MainContent: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

let splashPrevented = false;
if (!splashPrevented) {
  void SplashScreen.preventAutoHideAsync();
  splashPrevented = true;
}

export default function App(): React.JSX.Element | null {

  const { ready, error, themeMode, setThemeMode, retry } = useAppBootstrap();
  const [i18nReady, setI18nReady] = useState(false);
  const [onboardingCompleted, setOnboardingCompletedState] = useState<boolean | null>(null);
  const [manualOnboarding, setManualOnboarding] = useState(false);
  const [seedOnCompleteRequested, setSeedOnCompleteRequested] = useState(false);
  const [postOnboardingInitialTab, setPostOnboardingInitialTab] = useState<"Dashboard" | "Snapshot">("Dashboard");

  useEffect(() => {
    let mounted = true;
    void initI18n()
      .catch((error) => {
        console.warn("Failed to initialize localization:", error);
      })
      .finally(() => {
        if (mounted) {
          setI18nReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

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
    setSeedOnCompleteRequested(false);
    setPostOnboardingInitialTab("Dashboard");
    void setOnboardingCompleted(true);
    setOnboardingCompletedState(true);
  }, []);

  const handleOnboardingSkip = useCallback(() => {
    setManualOnboarding(false);
    setSeedOnCompleteRequested(false);
    setPostOnboardingInitialTab("Dashboard");
    void setOnboardingCompleted(true);
    setOnboardingCompletedState(true);
  }, []);

  const requestManualOnboarding = useCallback((options?: { seed?: boolean }) => {
    setManualOnboarding(true);
    setSeedOnCompleteRequested(Boolean(options?.seed));
  }, []);

  const [securityReady, setSecurityReady] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const splashHiddenRef = useRef(false);

  useEffect(() => {
    let active = true;
    getSecurityConfig()
      .then(() => {
        if (active) {
          setSecurityReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setSecurityReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Show the lock/loading screen even if database initialization is slow or fails.
  const appReady = i18nReady && securityReady;
  useEffect(() => {
    if (!appReady || !overlayVisible) {
      return;
    }
    let active = true;

    const revealApp = async () => {
      if (!splashHiddenRef.current) {
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.warn("Failed to hide native splash screen:", error);
        } finally {
          splashHiddenRef.current = true;
        }
      }

      if (active) {
        setOverlayActive(true);
      }
    };

    void revealApp();

    return () => {
      active = false;
    };
  }, [appReady, overlayVisible]);

  const handleSplashComplete = useCallback(() => {
    setOverlayActive(false);
    setOverlayVisible(false);
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
  const isFirstOnboarding = onboardingCompleted !== true && !manualOnboarding;
  const shouldSeedOnComplete = isFirstOnboarding || seedOnCompleteRequested;

  if (!i18nReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContext.Provider value={{ mode: themeMode, setMode: setThemeMode }}>
        <PaperProvider theme={paperTheme}>
          <View style={{ flex: 1 }}>
            <SecurityGate allowAutoBiometry={!overlayVisible}>
              <DashboardThemeProvider isDark={paperTheme.dark}>
                <AppBackground>
                    <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
                    {!ready ? (
                      <AppBootScreen status="loading" />
                    ) : error ? (
                      <AppBootScreen status="error" error={error} onRetry={retry} />
                    ) : (
                      <SettingsProvider>
                        <OnboardingFlowProvider value={{ requestReplay: requestManualOnboarding }}>
                          <NavigationContainer theme={navTheme}>
                          <RootStack.Navigator screenOptions={{ headerShown: false }}>
                            <RootStack.Screen name="MainContent">
                              {() =>
                                !onboardingCompleted || manualOnboarding ? (
                                  <OnboardingNavigator
                                    onComplete={handleOnboardingComplete}
                                    onSkip={handleOnboardingSkip}
                                    shouldSeedOnComplete={shouldSeedOnComplete}
                                  />
                                ) : (
                                  <BalanceProProvider>
                                    <TabTransitionProvider>
                                    <Tab.Navigator
                                      key={`main-tabs-${postOnboardingInitialTab}`}
                                      initialRouteName={postOnboardingInitialTab}
                                      screenOptions={({ route, navigation }) => ({
                                        header: () => (
                                          <AppHeader
                                            routeName={route.name}
                                            onOpenDashboard={() => navigation.navigate("Dashboard")}
                                            onOpenNews={() => navigation.navigate("News")}
                                            onOpenSettings={() => navigation.navigate("Impostazioni")}
                                          />
                                        ),
                                        tabBarStyle: { display: "none" },
                                      })}
                                      tabBar={(props) => <GlassTabBar {...props} />}
                                    >
                                      <Tab.Screen name="Dashboard" component={DashboardTab} options={{ lazy: false, headerShown: false }} />
                                      <Tab.Screen name="Snapshot" component={SnapshotTab} options={{ lazy: false }} />
                                      <Tab.Screen
                                        name="Balance"
                                        component={EntriesTab}
                                        options={{
                                          lazy: false,
                                          tabBarLabel: i18n.t("navigation.tabEntries", { defaultValue: "Cashflow" }),
                                          title: i18n.t("navigation.tabEntries", { defaultValue: "Cashflow" }),
                                        }}
                                      />
                                      <Tab.Screen name="Wallet" component={WalletTab} options={{ lazy: false }} />
                                      <Tab.Screen
                                        name="News"
                                        component={NewsTab}
                                        options={{
                                          tabBarButton: () => null,
                                        }}
                                      />
                                      <Tab.Screen
                                        name="Impostazioni"
                                        component={SettingsTab}
                                        options={{
                                          tabBarButton: () => null,
                                          title: i18n.t("settings.title", { defaultValue: "Account" }),
                                        }}
                                      />
                                    </Tab.Navigator>
                                    </TabTransitionProvider>
                                  </BalanceProProvider>
                                )
                              }
                            </RootStack.Screen>
                            <RootStack.Group screenOptions={{ presentation: "modal", headerShown: false }}>
                              <RootStack.Screen name="SetPinModal" component={SetPinModal} />
                              <RootStack.Screen name="VerifyPinModal" component={VerifyPinModal} />
                            </RootStack.Group>
                          </RootStack.Navigator>
                          </NavigationContainer>
                        </OnboardingFlowProvider>
                      </SettingsProvider>
                    )}
                </AppBackground>
              </DashboardThemeProvider>
            </SecurityGate>
            <AnimatedSplashOverlay
              visible={overlayVisible}
              active={overlayActive}
              onAnimationComplete={handleSplashComplete}
            />
          </View>
        </PaperProvider>
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}
