import { Alert } from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import type { SecurityModalStackParamList } from "./securityFlowsTypes";
import { setBiometryEnabled, setSecurityEnabled } from "@/security/securityStorage";

type SecurityFlowsStack = Pick<SecurityModalStackParamList, "VerifyPinModal">;

async function showConfirmation(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Disattivare il codice?",
      "Perderai la protezione all’avvio.",
      [
        { text: "Annulla", style: "cancel", onPress: () => resolve(false) },
        { text: "Disattiva", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true }
    );
  });
}

export async function disableSecurityFlow(navigation: NavigationProp<SecurityFlowsStack>) {
  const confirmed = await showConfirmation();
  if (!confirmed) {
    return;
  }
  navigation.navigate("VerifyPinModal", {
    onVerified: () => {
      void setSecurityEnabled(false);
      void setBiometryEnabled(false);
    },
  });
}
