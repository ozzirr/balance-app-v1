import React from "react";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MD3DarkTheme, MD3LightTheme, Provider as PaperProvider } from "react-native-paper";
import { enableScreens } from "react-native-screens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppBootstrap } from "@/app/useAppBootstrap";
import DashboardScreen from "@/ui/screens/DashboardScreen";
import EntriesScreen from "@/ui/screens/EntriesScreen";
import SnapshotScreen from "@/ui/screens/SnapshotScreen";
import SettingsScreen from "@/ui/screens/SettingsScreen";
import ProfileScreen from "@/ui/screens/ProfileScreen";
import { ThemeContext } from "@/ui/theme";
import GlassTabBar from "@/ui/components/GlassTabBar";
import AppBackground from "@/ui/components/AppBackground";
import AppBootScreen from "@/ui/components/AppBootScreen";
import { DashboardThemeProvider } from "@/ui/dashboard/theme";

enableScreens(false);

const Tab = createBottomTabNavigator();

export default function App(): JSX.Element {
  const { ready, error, themeMode, setThemeMode, retry } = useAppBootstrap();

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
            primary: "#2A7DE1",
            secondary: "#4C8CFF",
          },
        };
  const navTheme = themeMode === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeContext.Provider value={{ mode: themeMode, setMode: setThemeMode }}>
      <PaperProvider theme={paperTheme}>
        <DashboardThemeProvider isDark={paperTheme.dark}>
          <AppBackground>
            {!ready ? (
              <AppBootScreen status="loading" />
            ) : error ? (
              <AppBootScreen status="error" error={error} onRetry={retry} />
            ) : (
              <NavigationContainer theme={navTheme}>
                <Tab.Navigator
                  screenOptions={({ route }) => ({
                  headerTitleAlign: "center",
                  headerStyle: { backgroundColor: navTheme.colors.background },
                    tabBarStyle: { display: "none" },
                  })}
                  tabBar={(props) => <GlassTabBar {...props} />}
                >
                <Tab.Screen name="Dashboard" component={DashboardScreen} />
                <Tab.Screen name="Snapshot" component={SnapshotScreen} />
                <Tab.Screen name="Entrate/Uscite" component={EntriesScreen} />
                <Tab.Screen name="Impostazioni" component={SettingsScreen} />
                <Tab.Screen name="Profilo" component={ProfileScreen} options={{ tabBarButton: () => null }} />
              </Tab.Navigator>
            </NavigationContainer>
          )}
          </AppBackground>
        </DashboardThemeProvider>
      </PaperProvider>
    </ThemeContext.Provider>
  );
}
