import type { ConfigContext, ExpoConfig } from "@expo/config";

type AppVariant = "free" | "pro";

type VariantLimits = {
  liquidityWallets: number | null;
  investmentWallets: number | null;
};

const APP_VARIANT: AppVariant = process.env.APP_VARIANT === "pro" ? "pro" : "free";
const IS_STORE_PROFILE = process.env.EAS_BUILD_PROFILE === "freeStore" || process.env.EAS_BUILD_PROFILE === "proStore";

const VARIANT_LIMITS: Record<AppVariant, VariantLimits> = {
  free: {
    liquidityWallets: 2,
    investmentWallets: 1,
  },
  pro: {
    liquidityWallets: null,
    investmentWallets: null,
  },
};

const GLOBAL_SLUG = "balance";

const VARIANT_CONFIG: Record<
  AppVariant,
  {
    name: string;
    scheme: string;
    iosBundleIdentifier: string;
    androidPackage: string;
  }
> = {
  free: {
    name: "Balance",
    scheme: "balance",
    iosBundleIdentifier: "com.andrearizzo.balance",
    androidPackage: "com.andrearizzo.balance",
  },
  pro: {
    name: "Balance",
    scheme: "balancepro",
    iosBundleIdentifier: "com.andrearizzo.balance.pro",
    androidPackage: "com.andrearizzo.balance.pro",
  },
};

// Added "expo-font" to satisfy @expo/vector-icons peer dependency for standalone builds
const BASE_PLUGINS = ["expo-sqlite", "@react-native-community/datetimepicker", "expo-font"];

const FACE_ID_USAGE_DESCRIPTION = "Usiamo Face ID per proteggere l'accesso a Balance.";

export default function ({ config }: ConfigContext): ExpoConfig {
  const variant = VARIANT_CONFIG[APP_VARIANT];

  // Merge plugins from app.json/app.config defaults + our base plugins, without duplicates
  const mergedPlugins = Array.from(new Set([...(config.plugins ?? []), ...BASE_PLUGINS]));

  const variantLimits = VARIANT_LIMITS[APP_VARIANT];

  const iosConfig = config.ios ?? {};
  const { infoPlist: iosInfoPlist = {}, ...iosRest } = iosConfig;

  // Ensure we control NSFaceIDUsageDescription, avoid double-definition
  const iosInfoPlistRest = { ...iosInfoPlist };
  delete iosInfoPlistRest.NSFaceIDUsageDescription;

  const androidConfig = config.android ?? {};
  const { versionCode: _ignoredVersionCode, ...androidRest } = androidConfig;

  return {
    ...config,
    name: variant.name,
    slug: GLOBAL_SLUG,
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    scheme: variant.scheme,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0B0E1A",
    },
    ios: {
      ...iosRest,
      supportsTablet: true,
      bundleIdentifier: variant.iosBundleIdentifier,
      // Keep a dev fallback; store builds rely on EAS remote auto-increment.
      ...(IS_STORE_PROFILE ? {} : { buildNumber: "1" }),
      infoPlist: {
        ...iosInfoPlistRest,
        NSFaceIDUsageDescription: FACE_ID_USAGE_DESCRIPTION,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...androidRest,
      package: variant.androidPackage,
      // versionCode intentionally omitted because EAS version source is "remote"
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
      appVariant: APP_VARIANT,
      limits: {
        liquidityWallets: variantLimits.liquidityWallets,
        investmentWallets: variantLimits.investmentWallets,
      },
      eas: {
        ...(config.extra?.eas ?? {}),
        projectId: "9088422a-c41c-46ed-80bd-bd8ece996082",
      },
    },
  };
}
