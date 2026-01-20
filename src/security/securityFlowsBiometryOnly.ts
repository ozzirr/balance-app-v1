import { Alert } from "react-native";
import { isBiometryAvailable } from "@/security/securityBiometry";
import { setBiometryEnabled } from "@/security/securityStorage";

export async function handleBiometryToggle(nextValue: boolean, securityEnabled: boolean): Promise<boolean> {
  if (!securityEnabled) {
    await setBiometryEnabled(false);
    return false;
  }

  if (nextValue) {
    const available = await isBiometryAvailable();
    if (!available) {
      Alert.alert("Face ID non disponibile");
      await setBiometryEnabled(false);
      return false;
    }
  }

  await setBiometryEnabled(nextValue);
  return nextValue;
}
