import { Linking, Platform } from "react-native";
import i18n from "i18next";

export const PRO_WAITLIST_URL = "https://ozzirr.github.io/balance/pro-waitlist.html";
export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || "https://ozzirr.github.io/balance/privacy-policy.html";
export const APPLE_STANDARD_TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

function resolveLocaleParam(): "it" | "en" | "pt" {
  const language = i18n.resolvedLanguage ?? i18n.language ?? "it";
  const normalized = String(language).toLowerCase();
  if (normalized.startsWith("en")) {
    return "en";
  }
  if (normalized.startsWith("pt")) {
    return "pt";
  }
  return "it";
}

function buildProWaitlistUrl(): string {
  const locale = resolveLocaleParam();
  const params = [
    "src=app",
    "screen=wallet_limit",
    "variant=free",
    `platform=${Platform.OS}`,
    `locale=${locale}`,
  ].join("&");
  return `${PRO_WAITLIST_URL}?${params}`;
}

async function openExternalLink(url: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error(`Unsupported URL: ${url}`);
  }
  await Linking.openURL(url);
}

export async function openProWaitlistLink(): Promise<void> {
  await openExternalLink(buildProWaitlistUrl());
}

export async function openPrivacyPolicyLink(): Promise<void> {
  await openExternalLink(PRIVACY_POLICY_URL);
}

export async function openTermsOfUseLink(): Promise<void> {
  await openExternalLink(APPLE_STANDARD_TERMS_OF_USE_URL);
}
