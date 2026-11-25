import type { ConfigContext, ExpoConfig } from "@expo/config";

// Installed app name shown under the icon. Store listing name stays in App Store Connect.
const APP_NAME = "Balance";
const APP_SCHEME = "balance";
const IOS_BUNDLE_IDENTIFIER = "com.andrearizzo.balance";
const ANDROID_PACKAGE = "com.andrearizzo.balance";
const IS_LAN_TESTFLIGHT = process.env.BALANCE_TESTFLIGHT_LAN === "1";
const IS_STORE_PROFILE = process.env.EAS_BUILD_PROFILE === "production" || IS_LAN_TESTFLIGHT;

function testFlightLocalNetworkPlist() {
  const address = process.env.EXPO_PUBLIC_NEWS_API_URL;
  if (!IS_LAN_TESTFLIGHT || !address) return {};
  const url = new URL(address);
  const privateAddress = /^(?:10\.\d+|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+$/.test(url.hostname);
  if (url.protocol !== "http:" || !privateAddress) {
    throw new Error("TestFlight LAN requires a private IPv4 HTTP news endpoint");
  }
  return {
    NSLocalNetworkUsageDescription: "Balance usa la rete locale per caricare notizie e quotazioni dal proxy di prova sul Mac.",
    NSAppTransportSecurity: {
      NSAllowsLocalNetworking: true,
      NSExceptionDomains: { [url.hostname]: { NSExceptionAllowsInsecureHTTPLoads: true } },
    },
  };
}

// Added "expo-font" to satisfy @expo/vector-icons peer dependency for standalone builds.
const BASE_PLUGINS = [
  "expo-sqlite",
  "@react-native-community/datetimepicker",
  "expo-font",
  "expo-video",
  "expo-iap",
  "expo-notifications",
  "expo-localization",
  "expo-secure-store",
  "expo-sharing",
  "expo-splash-screen",
  "expo-status-bar",
  "./scripts/with-ios-scene-lifecycle.cjs",
];

const FACE_ID_USAGE_DESCRIPTION = "Usiamo Face ID per proteggere l'accesso a Balance.";

export default function ({ config }: ConfigContext): ExpoConfig {
  const iosConfig = config.ios ?? {};
  const { infoPlist: iosInfoPlist = {}, ...iosRest } = iosConfig;

  const iosInfoPlistRest = { ...iosInfoPlist };
  delete iosInfoPlistRest.NSFaceIDUsageDescription;

  const androidConfig = config.android ?? {};
  const { versionCode: _ignoredVersionCode, ...androidRest } = androidConfig;

  const mergedPlugins = Array.from(new Set([...(config.plugins ?? []), ...BASE_PLUGINS]));

  return {
    ...config,
    name: APP_NAME,
    slug: "balance",
    version: "2.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: APP_SCHEME,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0B0E1A",
    },
    ios: {
      ...iosRest,
      supportsTablet: true,
      bundleIdentifier: IOS_BUNDLE_IDENTIFIER,
      icon: {
        light: "./assets/icon.png",
        dark: "./assets/balance_icon-iOS-Dark-1024x1024@1x.png",
      },
      ...(IS_STORE_PROFILE ? {} : { buildNumber: "1" }),
      infoPlist: {
        ...iosInfoPlistRest,
        ...testFlightLocalNetworkPlist(),
        NSFaceIDUsageDescription: FACE_ID_USAGE_DESCRIPTION,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...androidRest,
      package: ANDROID_PACKAGE,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      ...(config.web ?? {}),
      favicon: "./assets/favicon.png",
    },
    plugins: mergedPlugins,
    extra: {
      ...(config.extra ?? {}),
      eas: {
        ...(config.extra?.eas ?? {}),
        projectId: "9088422a-c41c-46ed-80bd-bd8ece996082",
      },
    },
  };
}
