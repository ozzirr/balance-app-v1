import { Linking, Platform } from "react-native";
import i18n from "i18next";
import { resolveSupportedLanguage } from "@/i18n";

export const PRO_WAITLIST_URL = "https://ctrlbalance.com/pro-waitlist.html";
export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || "https://ctrlbalance.com/privacy.html";
export const APPLE_STANDARD_TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

function resolveLocaleParam(): "it" | "en" | "pt" {
  return resolveSupportedLanguage(i18n.resolvedLanguage ?? i18n.language ?? "en");
}

function appendQueryParams(url: string, params: Record<string, string>): string {
  const [base, hash = ""] = url.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${base}${separator}${query}${hash ? `#${hash}` : ""}`;
}

function buildProWaitlistUrl(): string {
  const locale = resolveLocaleParam();
  return appendQueryParams(PRO_WAITLIST_URL, {
    src: "app",
    screen: "wallet_limit",
    variant: "free",
    platform: Platform.OS,
    locale: locale,
    lang: locale,
  });
}

function buildPrivacyPolicyUrl(): string {
  const locale = resolveLocaleParam();
  return appendQueryParams(PRIVACY_POLICY_URL, { lang: locale });
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
  await openExternalLink(buildPrivacyPolicyUrl());
}

export async function openTermsOfUseLink(): Promise<void> {
  await openExternalLink(APPLE_STANDARD_TERMS_OF_USE_URL);
}
