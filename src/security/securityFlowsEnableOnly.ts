import type { NavigationProp } from "@react-navigation/native";
import type { SecurityModalStackParamList } from "./securityFlowsTypes";
import {
  hasPin,
  setBiometryEnabled,
  setSecurityEnabled,
} from "@/security/securityStorage";

type SecurityFlowsStack = Pick<SecurityModalStackParamList, "SetPinModal">;

export async function handleSecurityToggle(
  nextValue: boolean,
  navigation: NavigationProp<SecurityFlowsStack>
): Promise<void> {
  if (nextValue) {
    const pinExists = await hasPin();
    if (pinExists) {
      await setSecurityEnabled(true);
      return;
    }
    navigation.navigate("SetPinModal", {
      mode: "create",
      onPinSet: async () => {
        await setSecurityEnabled(true);
      },
    });
    return;
  }
  await setSecurityEnabled(false);
  await setBiometryEnabled(false);
}
