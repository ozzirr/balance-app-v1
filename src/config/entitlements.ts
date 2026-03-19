export const BALANCE_PRO_MONTHLY_PRODUCT_ID = "com.andrearizzo.balance.pro.monthly";
export const BALANCE_PRO_YEARLY_PRODUCT_ID = "com.andrearizzo.balance.pro.yearly";

export const BALANCE_PRO_PRODUCT_IDS = [
  BALANCE_PRO_YEARLY_PRODUCT_ID,
  BALANCE_PRO_MONTHLY_PRODUCT_ID,
] as const;

export type BalanceProPlanId = "monthly" | "yearly";

export const BALANCE_PRO_PRODUCT_ID_BY_PLAN: Record<BalanceProPlanId, (typeof BALANCE_PRO_PRODUCT_IDS)[number]> = {
  monthly: BALANCE_PRO_MONTHLY_PRODUCT_ID,
  yearly: BALANCE_PRO_YEARLY_PRODUCT_ID,
};

export const FREE_WALLET_LIMIT = 3;

export const IS_PRO_VARIANT = false;
