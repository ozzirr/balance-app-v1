import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type WalletForm = {
  name: string;
  balance: string;
};

export type InvestmentWalletForm = WalletForm & {
  id: string;
};

export type RecurringIncomeForm = {
  name: string;
  amount: string;
  frequency: "monthly";
  nextDate: string;
  walletName: string;
};

export type OnboardingExpenseForm = {
  id: string;
  title: string;
  amount: string;
  category: string;
  wallet: string;
  date: string;
  recurring: boolean;
  nextDate: string;
};

export type OnboardingDraft = {
  liquidityWallet: WalletForm;
  hasInvestments: boolean;
  investmentWallets: InvestmentWalletForm[];
  categories: string[];
  customCategories: string[];
  recurringIncome: RecurringIncomeForm;
  expenses: OnboardingExpenseForm[];
};

const DRAFT_STORAGE_KEY = "@openmoney/onboardingDraft";

type OnboardingContextValue = {
  draft: OnboardingDraft;
  updateLiquidityWallet: (update: Partial<WalletForm>) => void;
  setHasInvestments: (value: boolean) => void;
  addInvestmentWallet: () => void;
  updateInvestmentWallet: (id: string, update: Partial<WalletForm>) => void;
  resetDraft: () => void;
  toggleCategory: (category: string) => void;
  addCustomCategory: (category: string) => void;
  updateRecurringIncome: (update: Partial<RecurringIncomeForm>) => void;
  addExpense: () => void;
  updateExpense: (id: string, update: Partial<OnboardingExpenseForm>) => void;
};

export const defaultCategories = [
  "Casa",
  "Spesa",
  "Trasporti",
  "Svago",
  "Salute",
  "Abbonamenti",
];

const computeNext27Date = (): string => {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth(), 27);

  if (today.getDate() > 27) {
    target.setMonth(target.getMonth() + 1);
  }

  return target.toISOString().split("T")[0];
};

const todayString = () => new Date().toISOString().split("T")[0];

const createDefaultExpense = (index: number): OnboardingExpenseForm => ({
  id: `expense-${index}-${Math.random().toString(36).slice(2)}`,
  title: "",
  amount: "",
  category: defaultCategories[index % defaultCategories.length],
  wallet: "Conto principale",
  date: todayString(),
  recurring: false,
  nextDate: todayString(),
});

const createDefaultDraft = (): OnboardingDraft => ({
  liquidityWallet: {
    name: "Conto principale",
    balance: "",
  },
  hasInvestments: false,
  investmentWallets: [],
  categories: defaultCategories,
  customCategories: [],
  recurringIncome: {
    name: "Stipendio",
    amount: "",
    frequency: "monthly",
    nextDate: computeNext27Date(),
    walletName: "Conto principale",
  },
  expenses: [createDefaultExpense(0), createDefaultExpense(1)],
});

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const [draft, setDraft] = useState<OnboardingDraft>(createDefaultDraft());
  const [isReadyToSave, setIsReadyToSave] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DRAFT_STORAGE_KEY).then((value) => {
      if (cancelled) {
        return;
      }
      if (value) {
        try {
          const parsed = JSON.parse(value) as Partial<OnboardingDraft>;
          setDraft((current) => ({
            ...current,
            ...parsed,
          }));
        } catch (error) {
          console.warn("Invalid onboarding draft in storage, resetting.", error);
          AsyncStorage.removeItem(DRAFT_STORAGE_KEY).catch(() => {});
        }
      }
      setIsReadyToSave(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateLiquidityWallet = useCallback((update: Partial<WalletForm>) => {
    setDraft((current) => ({
      ...current,
      liquidityWallet: {
        ...current.liquidityWallet,
        ...update,
      },
    }));
  }, []);

  const setHasInvestments = useCallback((value: boolean) => {
    setDraft((current) => ({
      ...current,
      hasInvestments: value,
    }));
  }, []);

  const addInvestmentWallet = useCallback(() => {
    setDraft((current) => ({
      ...current,
      investmentWallets: [
        ...current.investmentWallets,
        {
          id: Math.random().toString(36).slice(2),
          name: "",
          balance: "",
        },
      ],
    }));
  }, []);

  const updateInvestmentWallet = useCallback((id: string, update: Partial<WalletForm>) => {
    setDraft((current) => ({
      ...current,
      investmentWallets: current.investmentWallets.map((wallet) =>
        wallet.id === id ? { ...wallet, ...update } : wallet
      ),
    }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(createDefaultDraft());
    AsyncStorage.removeItem(DRAFT_STORAGE_KEY).catch(() => {});
  }, []);

  const updateRecurringIncome = useCallback((update: Partial<RecurringIncomeForm>) => {
    setDraft((current) => ({
      ...current,
      recurringIncome: {
        ...current.recurringIncome,
        ...update,
      },
    }));
  }, []);

  const addExpense = useCallback(() => {
    setDraft((current) => ({
      ...current,
      expenses: [
        ...current.expenses,
        createDefaultExpense(current.expenses.length),
      ],
    }));
  }, []);

  const updateExpense = useCallback((id: string, update: Partial<OnboardingExpenseForm>) => {
    setDraft((current) => ({
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === id ? { ...expense, ...update } : expense
      ),
    }));
  }, []);

  useEffect(() => {
    if (!isReadyToSave) {
      return;
    }

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft)).catch(() => {});
    }, 400);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [draft, isReadyToSave]);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setDraft((current) => {
      const normalized = category.trim();
      if (!normalized) {
        return current;
      }
      if (current.categories.includes(normalized)) {
        return {
          ...current,
          categories: current.categories.filter((item) => item !== normalized),
        };
      }
      return {
        ...current,
        categories: [...current.categories, normalized],
      };
    });
  }, []);

  const addCustomCategory = useCallback((category: string) => {
    const normalized = category.trim();
    if (!normalized) {
      return;
    }
    setDraft((current) => {
      const nextCustom = current.customCategories.includes(normalized)
        ? current.customCategories
        : [...current.customCategories, normalized];
      const nextSelected = current.categories.includes(normalized)
        ? current.categories
        : [...current.categories, normalized];
      return {
        ...current,
        customCategories: nextCustom,
        categories: nextSelected,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      draft,
      updateLiquidityWallet,
      setHasInvestments,
      addInvestmentWallet,
      updateInvestmentWallet,
      resetDraft,
      toggleCategory,
      addCustomCategory,
      updateRecurringIncome,
      addExpense,
      updateExpense,
    }),
    [
      draft,
      updateLiquidityWallet,
      setHasInvestments,
      addInvestmentWallet,
      updateInvestmentWallet,
      resetDraft,
      toggleCategory,
      addCustomCategory,
      updateRecurringIncome,
      addExpense,
      updateExpense,
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export function useOnboardingDraft(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboardingDraft must be used within an OnboardingProvider");
  }
  return context;
}
