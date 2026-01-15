import React, { createContext, useContext } from "react";

type OnboardingFlowContextValue = {
  requestReplay: () => void;
};

const OnboardingFlowContext = createContext<OnboardingFlowContextValue | undefined>(undefined);

type Props = {
  value: OnboardingFlowContextValue;
  children: React.ReactNode;
};

export function OnboardingFlowProvider({ children, value }: Props): JSX.Element {
  return <OnboardingFlowContext.Provider value={value}>{children}</OnboardingFlowContext.Provider>;
}

export function useOnboardingFlow(): OnboardingFlowContextValue {
  const context = useContext(OnboardingFlowContext);
  if (!context) {
    throw new Error("useOnboardingFlow must be used inside OnboardingFlowProvider");
  }
  return context;
}
