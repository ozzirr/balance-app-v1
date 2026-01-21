import * as SecureStore from "expo-secure-store";
import type { SecurityConfig, SecurityState } from "@/security/securityTypes";

const SECURITY_ENABLED_KEY = "securityEnabled";
const PIN_HASH_KEY = "pinHash";
const BIOMETRY_ENABLED_KEY = "biometryEnabled";
const AUTO_LOCK_ENABLED_KEY = "autoLockEnabled";

export async function getSecurityEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(SECURITY_ENABLED_KEY);
  return value === "true";
}

export async function setSecurityEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(SECURITY_ENABLED_KEY, enabled ? "true" : "false");
}

export async function getBiometryEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRY_ENABLED_KEY);
  return value === "true";
}

export async function setBiometryEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRY_ENABLED_KEY, enabled ? "true" : "false");
}

export async function getAutoLockEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(AUTO_LOCK_ENABLED_KEY);
  return value === "true";
}

export async function setAutoLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(AUTO_LOCK_ENABLED_KEY, enabled ? "true" : "false");
}

export async function getPinHash(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_HASH_KEY);
}

export async function setPinHash(hash: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
}

export async function hasPin(): Promise<boolean> {
  const hash = await getPinHash();
  return Boolean(hash);
}

export async function getAllSecurityState(): Promise<SecurityState> {
  const [securityEnabled, biometryEnabled, pinHash, autoLockEnabled] = await Promise.all([
    getSecurityEnabled(),
    getBiometryEnabled(),
    getPinHash(),
    getAutoLockEnabled(),
  ]);
  return {
    securityEnabled,
    biometryEnabled,
    hasPin: Boolean(pinHash),
    autoLockEnabled,
  };
}

export async function getSecurityConfig(): Promise<SecurityConfig> {
  const [securityEnabled, biometryEnabled, pinHash, autoLockEnabled] = await Promise.all([
    getSecurityEnabled(),
    getBiometryEnabled(),
    getPinHash(),
    getAutoLockEnabled(),
  ]);
  return {
    securityEnabled,
    biometryEnabled,
    pinHash,
    autoLockEnabled,
  };
}
