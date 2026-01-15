import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@openmoney/onboardingCompleted";

export async function getOnboardingCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return value === "true";
}

export async function setOnboardingCompleted(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, value ? "true" : "false");
}
