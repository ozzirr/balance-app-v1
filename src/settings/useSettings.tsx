import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";

const SHOW_INVESTMENTS_KEY = "settings.showInvestments";
const DEFAULT_SHOW_INVESTMENTS = true;
const SHOW_INVESTMENT_AVAILABILITY_KEY = "settings.showInvestmentAvailability";
const DEFAULT_SHOW_INVESTMENT_AVAILABILITY = true;
const TRACK_PENSION_KEY = "settings.trackPension";
const DEFAULT_TRACK_PENSION = false;
const SCROLL_BOUNCE_KEY = "settings.scrollBounce";
const DEFAULT_SCROLL_BOUNCE = false;

type SettingsContextValue = {
  showInvestments: boolean;
  setShowInvestments: (next: boolean) => Promise<void>;
  showInvestmentAvailability: boolean;
  setShowInvestmentAvailability: (next: boolean) => Promise<void>;
  trackPension: boolean;
  setTrackPension: (next: boolean) => Promise<void>;
  scrollBounceEnabled: boolean;
  setScrollBounceEnabled: (next: boolean) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

type SettingsProviderProps = {
  children: React.ReactNode;
};

export function SettingsProvider({ children }: SettingsProviderProps): JSX.Element {
  const [showInvestments, setShowInvestmentsState] = useState(DEFAULT_SHOW_INVESTMENTS);
  const [showInvestmentAvailability, setShowInvestmentAvailabilityState] = useState(DEFAULT_SHOW_INVESTMENT_AVAILABILITY);
  const [trackPension, setTrackPensionState] = useState(DEFAULT_TRACK_PENSION);
  const [scrollBounceEnabled, setScrollBounceEnabledState] = useState(DEFAULT_SCROLL_BOUNCE);

  useEffect(() => {
    let active = true;
    (async () => {
      const [investmentsPref, availabilityPref, pensionPref, bouncePref] = await Promise.all([
        getPreference(SHOW_INVESTMENTS_KEY),
        getPreference(SHOW_INVESTMENT_AVAILABILITY_KEY),
        getPreference(TRACK_PENSION_KEY),
        getPreference(SCROLL_BOUNCE_KEY),
      ]);
      if (!active) return;
      const investmentsValue = investmentsPref ? investmentsPref.value === "true" : DEFAULT_SHOW_INVESTMENTS;
      const availabilityValue = availabilityPref
        ? availabilityPref.value === "true"
        : DEFAULT_SHOW_INVESTMENT_AVAILABILITY;
      const pensionValue = pensionPref ? pensionPref.value === "true" : DEFAULT_TRACK_PENSION;
      const bounceValue = bouncePref ? bouncePref.value === "true" : DEFAULT_SCROLL_BOUNCE;
      setShowInvestmentsState(investmentsValue);
      setShowInvestmentAvailabilityState(availabilityValue);
      setTrackPensionState(pensionValue);
      setScrollBounceEnabledState(bounceValue);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setShowInvestments = useCallback(async (next: boolean) => {
    await setPreference(SHOW_INVESTMENTS_KEY, next ? "true" : "false");
    setShowInvestmentsState(next);
  }, []);

  const setShowInvestmentAvailability = useCallback(async (next: boolean) => {
    await setPreference(SHOW_INVESTMENT_AVAILABILITY_KEY, next ? "true" : "false");
    setShowInvestmentAvailabilityState(next);
  }, []);

  const setTrackPension = useCallback(async (next: boolean) => {
    await setPreference(TRACK_PENSION_KEY, next ? "true" : "false");
    setTrackPensionState(next);
  }, []);

  const setScrollBounceEnabled = useCallback(async (next: boolean) => {
    await setPreference(SCROLL_BOUNCE_KEY, next ? "true" : "false");
    setScrollBounceEnabledState(next);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        showInvestments,
        setShowInvestments,
        showInvestmentAvailability,
        setShowInvestmentAvailability,
        trackPension,
        setTrackPension,
        scrollBounceEnabled,
        setScrollBounceEnabled,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
