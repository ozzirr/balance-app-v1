import type { NavigationProp } from "@react-navigation/native";
import type { SecurityModalStackParamList } from "./securityFlowsTypes";
import { hasPin } from "@/security/securityStorage";

type SecurityFlowsStack = SecurityModalStackParamList;

export async function openSetOrChangePinFlow(navigation: NavigationProp<SecurityFlowsStack>) {
  const pinExists = await hasPin();
  if (!pinExists) {
    navigation.navigate("SetPinModal", {
      mode: "create",
      onPinSet: () => {},
    });
    return;
  }
  navigation.navigate("VerifyPinModal", {
    onVerified: () => {
      navigation.navigate("SetPinModal", {
        mode: "change",
        onPinSet: () => {},
      });
    },
  });
}
