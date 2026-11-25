const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const legacyWindowSetup = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

`;

module.exports = function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest ??= {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return config;
  });

  return withAppDelegate(config, (config) => {
    const { contents, language } = config.modResults;
    if (
      contents.includes("ExpoReactNativeFactoryProvider") ||
      contents.includes("configurationForConnecting")
    ) {
      return config;
    }

    const appDelegate = "class AppDelegate: ExpoAppDelegate {";
    if (
      language !== "swift" ||
      !contents.includes(appDelegate) ||
      !contents.includes(legacyWindowSetup)
    ) {
      throw new Error("Unable to migrate the generated AppDelegate to the iOS scene lifecycle.");
    }

    // Expo's scene delegate creates the window and starts the existing factory.
    config.modResults.contents = contents
      .replace(appDelegate, "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {")
      .replace(legacyWindowSetup, "");
    return config;
  });
};
