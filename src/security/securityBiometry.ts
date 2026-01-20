import * as LocalAuthentication from "expo-local-authentication";

export async function isBiometryAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}

export async function authenticateForUnlock(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Sblocca OpenMoney",
      cancelLabel: "Annulla",
      disableDeviceFallback: true,
      fallbackLabel: "",
    });
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.errorCode ?? "authentication_failed" };
  } catch (error) {
    return { success: false, error: (error as Error).message ?? "authentication_error" };
  }
}
