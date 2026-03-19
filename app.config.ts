import type { ConfigContext, ExpoConfig } from "@expo/config";

// Installed app name shown under the icon. Store listing name stays in App Store Connect.
const APP_NAME = "Balance";
const APP_SCHEME = "balance";
const IOS_BUNDLE_IDENTIFIER = "com.andrearizzo.balance";
const ANDROID_PACKAGE = "com.andrearizzo.balance";
const IS_STORE_PROFILE = process.env.EAS_BUILD_PROFILE === "production";

// Added "expo-font" to satisfy @expo/vector-icons peer dependency for standalone builds.
const BASE_PLUGINS = ["expo-sqlite", "@react-native-community/datetimepicker", "expo-font", "expo-iap"];

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
    version: "1.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
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
