import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import {
  BALANCE_PRO_PRODUCT_ID_BY_PLAN,
  BALANCE_PRO_PRODUCT_IDS,
  FREE_WALLET_LIMIT,
  type BalanceProPlanId,
} from "@/config/entitlements";

const ENTITLEMENT_PREFERENCE_KEY = "balance.pro.entitlement";
const LEGACY_SUBSCRIPTION_STATE_PREFERENCE_KEY = "entitlements.balancePro.subscriptionState";
const LEGACY_IS_PRO_PREFERENCE_KEY = "entitlements.balancePro.isPro";
const PRO_WELCOME_SEEN_PREFERENCE_KEY = "entitlements.balancePro.hasSeenWelcome";
const FALLBACK_ENTITLEMENT_CACHE_MS = 24 * 60 * 60 * 1000;
const ENTITLEMENT_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NETWORK_PROBE_TIMEOUT_MS = 4000;
const NETWORK_PROBE_URL = "https://www.apple.com/library/test/success.html";
const ONLINE_SYNC_INTERVAL_MS = 60 * 1000;
const BALANCE_PRO_LOG_PREFIX = "[BalancePro]";

const ERROR_CODES = {
  alreadyOwned: "already-owned",
  billingUnavailable: "billing-unavailable",
  emptyProducts: "empty-products",
  iapNotAvailable: "iap-not-available",
  initConnection: "init-connection",
  itemUnavailable: "item-unavailable",
  networkError: "network-error",
  queryProduct: "query-product",
  runtimeUnavailable: "runtime-unavailable",
  serviceDisconnected: "service-disconnected",
  serviceError: "service-error",
  userCancelled: "user-cancelled",
} as const;

type PurchaseProResult =
  | { status: "success"; showWelcome: boolean }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "product-unavailable" }
  | { status: "store-unavailable" }
  | { status: "error"; message?: string };

type RestorePurchasesResult =
  | { status: "restored" }
  | { status: "nothing-to-restore" }
  | { status: "store-unavailable" }
  | { status: "error"; message?: string };

type EntitlementSource = "store" | "cache";

type RenewalInfoIOS = {
  renewalDate?: number | null;
};

type IntroductoryPaymentModeIOS = "empty" | "free-trial" | "pay-as-you-go" | "pay-up-front";
type SubscriptionPeriodUnitIOS = "day" | "week" | "month" | "year" | "empty";

type BalanceProSubscriptionOffer = {
  displayPrice?: string | null;
  id: string;
  paymentMode?: IntroductoryPaymentModeIOS | null;
  period?: {
    unit?: SubscriptionPeriodUnitIOS | null;
    value?: number | null;
  } | null;
  periodCount?: number | null;
  price?: number | null;
  type?: "introductory" | "promotional" | "win-back" | null;
};

export type BalanceProProduct = {
  currency?: string | null;
  displayPrice?: string | null;
  id: string;
  introductoryPriceAsAmountIOS?: string | null;
  introductoryPriceIOS?: string | null;
  introductoryPriceNumberOfPeriodsIOS?: string | null;
  introductoryPricePaymentModeIOS?: IntroductoryPaymentModeIOS | null;
  introductoryPriceSubscriptionPeriodIOS?: SubscriptionPeriodUnitIOS | null;
  platform?: string | null;
  price?: number | null;
  subscriptionOffers?: BalanceProSubscriptionOffer[] | null;
  subscriptionPeriodNumberIOS?: string | null;
  subscriptionPeriodUnitIOS?: Exclude<SubscriptionPeriodUnitIOS, "empty"> | null;
  type?: string | null;
};

type Purchase = {
  expirationDateIOS?: number | null;
  id?: string | null;
  productId: string;
  purchaseState?: string | null;
  renewalInfoIOS?: RenewalInfoIOS | null;
  transactionDate: number;
  transactionId?: string | null;
};

type ActiveSubscription = {
  currentPlanId?: string | null;
  expirationDateIOS?: number | null;
  isActive: boolean;
  productId: string;
  renewalInfoIOS?: RenewalInfoIOS | null;
  transactionDate: number;
};

type PurchaseError = Error & {
  code?: string;
};

export type BalanceProAvailablePlan = {
  planId: BalanceProPlanId;
  productId: string;
  product: BalanceProProduct | null;
  displayPrice: string | null;
  isBestValue: boolean;
};

type BalanceProContextValue = {
  isPro: boolean;
  activePlan: BalanceProPlanId | null;
  hasActiveSubscription: boolean;
  isReady: boolean;
  entitlementSource: EntitlementSource;
  isEntitlementStale: boolean;
  lastValidatedAt: number;
  isStoreAvailable: boolean;
  isStoreLoading: boolean;
  storeErrorCode: string | null;
  storeErrorMessage: string | null;
  isPurchasePending: boolean;
  isRestorePending: boolean;
  availablePlans: BalanceProAvailablePlan[];
  canCreateWallet: (walletCount: number) => boolean;
  prepareStore: () => Promise<boolean>;
  purchase: (plan: BalanceProPlanId) => Promise<PurchaseProResult>;
  restore: () => Promise<RestorePurchasesResult>;
  refreshProStatus: () => Promise<boolean>;
  markProWelcomeSeen: () => Promise<void>;
};

const BalanceProContext = createContext<BalanceProContextValue | null>(null);

type BalanceProProviderProps = {
  children: React.ReactNode;
};

type PersistedEntitlement = {
  version: 3;
  isPro: boolean;
  activePlan: BalanceProPlanId | null;
  productId: string | null;
  expiresAt: number | null;
  lastValidatedAt: number;
  source: EntitlementSource;
};

type BalanceProEntitlement = {
  isPro: boolean;
  activePlan: BalanceProPlanId | null;
  productId: string | null;
  expiresAt: number | null;
  lastValidatedAt: number;
  source: EntitlementSource;
  isStale: boolean;
};

type ExpoIapRuntime = {
  endConnection: () => Promise<boolean>;
  fetchProducts: (request: { skus: string[]; type: "subs" }) => Promise<BalanceProProduct[] | null | undefined>;
  finishTransaction: (request: { purchase: Purchase; isConsumable: boolean }) => Promise<boolean>;
  getActiveSubscriptions: (productIds: string[]) => Promise<ActiveSubscription[]>;
  getAvailablePurchases: (options: {
    alsoPublishToEventListenerIOS: boolean;
    onlyIncludeActiveItemsIOS: boolean;
  }) => Promise<Purchase[]>;
  initConnection: () => Promise<boolean>;
  purchaseErrorListener: (listener: (error: PurchaseError | Error) => void) => { remove: () => void };
  purchaseUpdatedListener: (listener: (purchase: Purchase) => void) => { remove: () => void };
  requestPurchase: (request: {
    type: "subs";
    request: {
      apple: { sku: string };
      google: { skus: string[] };
    };
  }) => Promise<Purchase | Purchase[] | null>;
  restorePurchases: () => Promise<unknown>;
};

type ProductMap = Record<BalanceProPlanId, BalanceProProduct | null>;

type PendingPurchaseContext = {
  plan: BalanceProPlanId;
  wasProAtStart: boolean;
  allowWelcome: boolean;
};

const EMPTY_PRODUCT_MAP: ProductMap = {
  monthly: null,
  yearly: null,
};

const EMPTY_PERSISTED_ENTITLEMENT: PersistedEntitlement = {
  version: 3,
  isPro: false,
  activePlan: null,
  productId: null,
  expiresAt: null,
  lastValidatedAt: 0,
  source: "cache",
};

let hasWarnedMissingBalanceProProvider = false;

function getExpoIapRuntime(): ExpoIapRuntime | null {
  if (Platform.OS !== "ios") {
    return null;
  }

  try {
    return require("expo-iap") as ExpoIapRuntime;
  } catch (error) {
    console.warn("Failed to load expo-iap runtime", error);
    return null;
  }
}

function isBalanceProProductId(productId: string | null | undefined): productId is (typeof BALANCE_PRO_PRODUCT_IDS)[number] {
  return Boolean(productId && BALANCE_PRO_PRODUCT_IDS.includes(productId as (typeof BALANCE_PRO_PRODUCT_IDS)[number]));
}

function getPlanFromProductId(productId: string | null | undefined): BalanceProPlanId | null {
  if (productId === BALANCE_PRO_PRODUCT_ID_BY_PLAN.monthly) {
    return "monthly";
  }

  if (productId === BALANCE_PRO_PRODUCT_ID_BY_PLAN.yearly) {
    return "yearly";
  }

  return null;
}

function isBalanceProPurchase(purchase: Purchase | null | undefined): purchase is Purchase {
  return isBalanceProProductId(purchase?.productId);
}

function isStoreUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return (
    code === ERROR_CODES.billingUnavailable ||
    code === ERROR_CODES.iapNotAvailable ||
    code === ERROR_CODES.initConnection ||
    code === ERROR_CODES.networkError ||
    code === ERROR_CODES.queryProduct ||
    code === ERROR_CODES.serviceDisconnected ||
    code === ERROR_CODES.serviceError
  );
}

function isProductUnavailableError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === ERROR_CODES.itemUnavailable);
}

function isUserCancelledPurchase(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === ERROR_CODES.userCancelled);
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (!error || typeof error !== "object" || !("message" in error)) {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : null;
}

function logBalanceProInfo(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(BALANCE_PRO_LOG_PREFIX, message, details);
    return;
  }

  console.info(BALANCE_PRO_LOG_PREFIX, message);
}

function logBalanceProWarn(message: string, error?: unknown, details?: Record<string, unknown>): void {
  if (details || error) {
    console.warn(BALANCE_PRO_LOG_PREFIX, message, details ?? {}, error ?? "");
    return;
  }

  console.warn(BALANCE_PRO_LOG_PREFIX, message);
}

function resolveEntitlementExpiry(input: {
  expirationDateIOS?: number | null;
  renewalInfoIOS?: RenewalInfoIOS | null;
  transactionDate: number;
}): number {
  return input.expirationDateIOS ?? input.renewalInfoIOS?.renewalDate ?? input.transactionDate + FALLBACK_ENTITLEMENT_CACHE_MS;
}

function createPersistedEntitlement(params: {
  isPro: boolean;
  productId: string | null;
  activePlan: BalanceProPlanId | null;
  expiresAt: number | null;
  lastValidatedAt?: number;
  source?: EntitlementSource;
}): PersistedEntitlement {
  return {
    version: 3,
    isPro: params.isPro,
    productId: params.productId,
    activePlan: params.activePlan,
    expiresAt: params.expiresAt,
    lastValidatedAt: params.lastValidatedAt ?? Date.now(),
    source: params.source ?? "store",
  };
}

function createEntitlementFromPurchase(purchase: Purchase): PersistedEntitlement {
  if (!isBalanceProPurchase(purchase)) {
    return EMPTY_PERSISTED_ENTITLEMENT;
  }

  const activePlan = getPlanFromProductId(purchase.productId);
  const expirationDateIOS = "expirationDateIOS" in purchase ? purchase.expirationDateIOS : null;
  const renewalInfoIOS = "renewalInfoIOS" in purchase ? purchase.renewalInfoIOS : null;
  return createPersistedEntitlement({
    isPro: purchase.purchaseState !== "pending" && activePlan !== null,
    productId: purchase.productId,
    activePlan,
    expiresAt:
      purchase.purchaseState === "pending"
        ? null
        : resolveEntitlementExpiry({
            expirationDateIOS,
            renewalInfoIOS,
            transactionDate: purchase.transactionDate,
          }),
    source: "store",
  });
}

function createEntitlementFromSubscription(subscription: ActiveSubscription): PersistedEntitlement {
  const activePlan = getPlanFromProductId(subscription.currentPlanId ?? subscription.productId);
  const productId = isBalanceProProductId(subscription.currentPlanId)
    ? subscription.currentPlanId
    : isBalanceProProductId(subscription.productId)
    ? subscription.productId
    : null;

  return createPersistedEntitlement({
    isPro: subscription.isActive && activePlan !== null,
    productId,
    activePlan,
    expiresAt: resolveEntitlementExpiry({
      expirationDateIOS: subscription.expirationDateIOS,
      renewalInfoIOS: subscription.renewalInfoIOS,
      transactionDate: subscription.transactionDate,
    }),
    source: "store",
  });
}

function isEntitlementStale(lastValidatedAt: number): boolean {
  return lastValidatedAt > 0 && Date.now() - lastValidatedAt > ENTITLEMENT_STALE_TTL_MS;
}

function resolveRuntimeEntitlement(
  entitlement: PersistedEntitlement,
  sourceOverride?: EntitlementSource
): BalanceProEntitlement {
  const hasValidProductId = isBalanceProProductId(entitlement.productId);
  const activePlan = entitlement.activePlan === "monthly" || entitlement.activePlan === "yearly" ? entitlement.activePlan : null;
  const isExpired = typeof entitlement.expiresAt === "number" && entitlement.expiresAt <= Date.now();
  const isPro = entitlement.isPro && activePlan !== null && hasValidProductId && !isExpired;

  return {
    isPro,
    activePlan: isPro ? activePlan : null,
    productId: hasValidProductId ? entitlement.productId : null,
    expiresAt: entitlement.expiresAt,
    lastValidatedAt: entitlement.lastValidatedAt,
    source: sourceOverride ?? entitlement.source,
    isStale: isEntitlementStale(entitlement.lastValidatedAt),
  };
}

function parsePersistedEntitlement(value: string | null | undefined): PersistedEntitlement {
  if (!value) {
    return EMPTY_PERSISTED_ENTITLEMENT;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PersistedEntitlement> & {
      hasActiveSubscription?: boolean;
    };
    const productId = isBalanceProProductId(parsed.productId ?? null) ? parsed.productId ?? null : null;
    const activePlan = parsed.activePlan === "monthly" || parsed.activePlan === "yearly" ? parsed.activePlan : null;
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : null;
    const isPro = parsed.isPro === true || parsed.hasActiveSubscription === true;
    const lastValidatedAt = typeof parsed.lastValidatedAt === "number" ? parsed.lastValidatedAt : 0;
    const source = parsed.source === "store" || parsed.source === "cache" ? parsed.source : "cache";

    return {
      version: 3,
      isPro,
      productId,
      activePlan,
      expiresAt,
      lastValidatedAt,
      source,
    };
  } catch (error) {
    logBalanceProWarn("Failed to parse Balance Pro entitlement cache", error);
    return EMPTY_PERSISTED_ENTITLEMENT;
  }
}

async function readPersistedEntitlement(): Promise<PersistedEntitlement> {
  const entitlement = await getPreference(ENTITLEMENT_PREFERENCE_KEY);
  if (entitlement?.value) {
    return parsePersistedEntitlement(entitlement.value);
  }

  const legacySubscriptionState = await getPreference(LEGACY_SUBSCRIPTION_STATE_PREFERENCE_KEY);
  if (legacySubscriptionState?.value) {
    return parsePersistedEntitlement(legacySubscriptionState.value);
  }

  // The legacy key represented a permanent non-consumable unlock. Ignore it so
  // deprecated local state does not silently grant subscription access.
  const legacyFlag = await getPreference(LEGACY_IS_PRO_PREFERENCE_KEY);
  if (legacyFlag?.value) {
    return EMPTY_PERSISTED_ENTITLEMENT;
  }

  return EMPTY_PERSISTED_ENTITLEMENT;
}

function sortActiveSubscriptions(subscriptions: ActiveSubscription[]): ActiveSubscription[] {
  return [...subscriptions].sort((left, right) => right.transactionDate - left.transactionDate);
}

function sortPurchases(purchases: Purchase[]): Purchase[] {
  return [...purchases].sort((left, right) => right.transactionDate - left.transactionDate);
}

function hasLoadedProducts(products: ProductMap): boolean {
  return Object.values(products).some((product) => product !== null);
}

function resolveLocalizedDisplayPrice(product: BalanceProProduct | null): string | null {
  const displayPrice = typeof product?.displayPrice === "string" ? product.displayPrice.trim() : "";
  return displayPrice.length > 0 ? displayPrice : null;
}

function getProductDebugDetails(product: BalanceProProduct | null): Record<string, unknown> {
  if (!product) {
    return {
      returnedProductId: null,
      displayPrice: null,
      currencyCode: null,
      subscriptionPeriodUnit: null,
      subscriptionPeriodCount: null,
    };
  }

  const iosProduct = product.platform === "ios" ? product : null;
  return {
    returnedProductId: product.id,
    displayPrice: resolveLocalizedDisplayPrice(product),
    currencyCode: product.currency ?? null,
    subscriptionPeriodUnit: iosProduct?.subscriptionPeriodUnitIOS ?? null,
    subscriptionPeriodCount: iosProduct?.subscriptionPeriodNumberIOS ?? null,
  };
}

async function readHasSeenProWelcome(): Promise<boolean> {
  const preference = await getPreference(PRO_WELCOME_SEEN_PREFERENCE_KEY);
  return preference?.value === "true";
}

async function checkNetworkAvailability(): Promise<boolean> {
  const abortController = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = setTimeout(() => {
    abortController?.abort();
  }, NETWORK_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(NETWORK_PROBE_URL, {
      method: "HEAD",
      cache: "no-store",
      signal: abortController?.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function createPlanEntries(products: ProductMap): BalanceProAvailablePlan[] {
  return (["yearly", "monthly"] as const).map((planId) => ({
    planId,
    productId: BALANCE_PRO_PRODUCT_ID_BY_PLAN[planId],
    product: products[planId],
    displayPrice: resolveLocalizedDisplayPrice(products[planId]),
    isBestValue: planId === "yearly",
  }));
}

const FALLBACK_BALANCE_PRO_CONTEXT: BalanceProContextValue = {
  isPro: false,
  activePlan: null,
  hasActiveSubscription: false,
  isReady: false,
  entitlementSource: "cache",
  isEntitlementStale: false,
  lastValidatedAt: 0,
  isStoreAvailable: false,
  isStoreLoading: false,
  storeErrorCode: null,
  storeErrorMessage: null,
  isPurchasePending: false,
  isRestorePending: false,
  availablePlans: createPlanEntries(EMPTY_PRODUCT_MAP),
  canCreateWallet: (walletCount: number) => walletCount < FREE_WALLET_LIMIT,
  prepareStore: async () => false,
  purchase: async () => ({ status: "store-unavailable" }),
  restore: async () => ({ status: "store-unavailable" }),
  refreshProStatus: async () => false,
  markProWelcomeSeen: async () => undefined,
};

export function BalanceProProvider({ children }: BalanceProProviderProps): React.ReactElement {
  const [isPro, setIsPro] = useState(false);
  const [activePlan, setActivePlan] = useState<BalanceProPlanId | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [entitlementSource, setEntitlementSource] = useState<EntitlementSource>("cache");
  const [isEntitlementCacheStale, setIsEntitlementCacheStale] = useState(false);
  const [lastValidatedAt, setLastValidatedAt] = useState(0);
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [storeErrorCode, setStoreErrorCode] = useState<string | null>(null);
  const [storeErrorMessage, setStoreErrorMessage] = useState<string | null>(null);
  const [isPurchasePending, setIsPurchasePending] = useState(false);
  const [isRestorePending, setIsRestorePending] = useState(false);
  const [isStoreConnected, setIsStoreConnected] = useState(false);
  const [productsByPlan, setProductsByPlan] = useState<ProductMap>(EMPTY_PRODUCT_MAP);

  const isProRef = useRef(isPro);
  const iapRef = useRef<ExpoIapRuntime | null>(null);
  const initStorePromiseRef = useRef<Promise<boolean> | null>(null);
  const entitlementSyncPromiseRef = useRef<Promise<{ isPro: boolean; hasProducts: boolean }> | null>(null);
  const handledTransactionsRef = useRef(new Set<string>());
  const purchaseResolverRef = useRef<((result: PurchaseProResult) => void) | null>(null);
  const purchaseContextRef = useRef<PendingPurchaseContext | null>(null);
  const purchaseSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const purchaseErrorSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const hasSeenProWelcomeRef = useRef(false);

  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);

  const applyEntitlement = useCallback((nextEntitlement: PersistedEntitlement, sourceOverride?: EntitlementSource) => {
    const runtimeEntitlement = resolveRuntimeEntitlement(nextEntitlement, sourceOverride);
    setIsPro(runtimeEntitlement.isPro);
    setActivePlan(runtimeEntitlement.activePlan);
    setEntitlementSource(runtimeEntitlement.source);
    setIsEntitlementCacheStale(runtimeEntitlement.isStale);
    setLastValidatedAt(runtimeEntitlement.lastValidatedAt);
    isProRef.current = runtimeEntitlement.isPro;
    return runtimeEntitlement;
  }, []);

  const persistEntitlementState = useCallback(async (nextState: PersistedEntitlement, sourceOverride?: EntitlementSource) => {
    const persistedState = sourceOverride && sourceOverride !== nextState.source
      ? { ...nextState, source: sourceOverride }
      : nextState;
    const runtimeEntitlement = applyEntitlement(persistedState, persistedState.source);
    await setPreference(ENTITLEMENT_PREFERENCE_KEY, JSON.stringify(persistedState));
    return runtimeEntitlement;
  }, [applyEntitlement]);

  const settlePurchase = useCallback((result: PurchaseProResult) => {
    setIsPurchasePending(false);
    const resolver = purchaseResolverRef.current;
    purchaseResolverRef.current = null;
    purchaseContextRef.current = null;
    resolver?.(result);
  }, []);

  const getIapRuntime = useCallback((): ExpoIapRuntime | null => {
    if (iapRef.current) {
      return iapRef.current;
    }

    const runtime = getExpoIapRuntime();
    iapRef.current = runtime;
    return runtime;
  }, []);

  const clearStoreError = useCallback(() => {
    setStoreErrorCode(null);
    setStoreErrorMessage(null);
  }, []);

  const loadProducts = useCallback(async (runtime?: ExpoIapRuntime | null): Promise<ProductMap> => {
    const iap = runtime ?? getIapRuntime();
    if (!iap) {
      setProductsByPlan(EMPTY_PRODUCT_MAP);
      return EMPTY_PRODUCT_MAP;
    }

    const products = (await iap.fetchProducts({
      skus: [...BALANCE_PRO_PRODUCT_IDS],
      type: "subs",
    })) ?? [];

    const nextProducts: ProductMap = { monthly: null, yearly: null };
    products.forEach((item) => {
      if (item.type !== "subs" || !isBalanceProProductId(item.id)) {
        return;
      }

      const planId = getPlanFromProductId(item.id);
      if (!planId) {
        return;
      }

      nextProducts[planId] = item;
    });

    logBalanceProInfo("Fetched Balance Pro products", {
      requestedProductIds: [...BALANCE_PRO_PRODUCT_IDS],
      returnedProductIds: products.map((item) => item.id),
      matchedPlans: (["monthly", "yearly"] as const).map((planId) => ({
        planId,
        expectedProductId: BALANCE_PRO_PRODUCT_ID_BY_PLAN[planId],
        ...getProductDebugDetails(nextProducts[planId]),
      })),
    });

    setProductsByPlan(nextProducts);
    return nextProducts;
  }, [getIapRuntime]);

  const loadStoreCatalog = useCallback(async (runtime?: ExpoIapRuntime | null): Promise<boolean> => {
    const iap = runtime ?? getIapRuntime();
    if (!iap) {
      setProductsByPlan(EMPTY_PRODUCT_MAP);
      setStoreErrorCode(ERROR_CODES.runtimeUnavailable);
      setStoreErrorMessage("In-app purchases module unavailable");
      return false;
    }

    try {
      const nextProducts = await loadProducts(iap);
      if (!hasLoadedProducts(nextProducts)) {
        setProductsByPlan(EMPTY_PRODUCT_MAP);
        setStoreErrorCode(ERROR_CODES.emptyProducts);
        setStoreErrorMessage("No subscription products were returned from the App Store");
        logBalanceProWarn("No Balance Pro subscription products returned from fetchProducts", undefined, {
          requestedProductIds: [...BALANCE_PRO_PRODUCT_IDS],
        });
        return false;
      }

      clearStoreError();
      return true;
    } catch (error) {
      setProductsByPlan(EMPTY_PRODUCT_MAP);
      setStoreErrorCode(getErrorCode(error) ?? ERROR_CODES.queryProduct);
      setStoreErrorMessage(getErrorMessage(error) ?? "Failed to load subscription products");
      logBalanceProWarn("Failed to fetch Balance Pro subscriptions", error, {
        requestedProductIds: [...BALANCE_PRO_PRODUCT_IDS],
      });
      return false;
    }
  }, [clearStoreError, getIapRuntime, loadProducts]);

  const refreshFromAvailablePurchases = useCallback(async (runtime?: ExpoIapRuntime | null): Promise<boolean> => {
    const iap = runtime ?? getIapRuntime();
    if (!iap) {
      return isProRef.current;
    }

    const purchases = await iap.getAvailablePurchases({
      alsoPublishToEventListenerIOS: false,
      onlyIncludeActiveItemsIOS: true,
    });
    const activePurchase = sortPurchases(purchases.filter(isBalanceProPurchase)).find(
      (purchase) => purchase.purchaseState !== "pending"
    );
    const nextState = activePurchase ? createEntitlementFromPurchase(activePurchase) : EMPTY_PERSISTED_ENTITLEMENT;
    await persistEntitlementState(nextState);
    return nextState.isPro;
  }, [getIapRuntime, persistEntitlementState]);

  const refreshProStatusInternal = useCallback(async (runtime: ExpoIapRuntime): Promise<boolean> => {
    try {
      const subscriptions = await runtime.getActiveSubscriptions([...BALANCE_PRO_PRODUCT_IDS]);
      const activeSubscription = sortActiveSubscriptions(
        subscriptions.filter((subscription) => isBalanceProProductId(subscription.currentPlanId ?? subscription.productId))
      )[0];
      const nextState = activeSubscription ? createEntitlementFromSubscription(activeSubscription) : EMPTY_PERSISTED_ENTITLEMENT;
      await persistEntitlementState(nextState);
      return nextState.isPro;
    } catch (error) {
      logBalanceProWarn("Failed to refresh Balance Pro subscription status", error);
      try {
        return await refreshFromAvailablePurchases(runtime);
      } catch (fallbackError) {
        logBalanceProWarn("Failed to refresh Balance Pro status from available purchases", fallbackError);
        return isProRef.current;
      }
    }
  }, [persistEntitlementState, refreshFromAvailablePurchases]);

  const handleSuccessfulPurchase = useCallback(
    async (purchase: Purchase) => {
      if (!isBalanceProPurchase(purchase)) {
        return;
      }

      if (purchase.purchaseState === "pending") {
        logBalanceProInfo("Balance Pro purchase pending confirmation", {
          productId: purchase.productId,
        });
        settlePurchase({ status: "pending" });
        return;
      }

      const transactionKey = purchase.transactionId ?? purchase.id;
      if (transactionKey && handledTransactionsRef.current.has(transactionKey)) {
        settlePurchase({ status: "success", showWelcome: false });
        return;
      }

      if (transactionKey) {
        handledTransactionsRef.current.add(transactionKey);
      }

      const iap = getIapRuntime();
      if (!iap) {
        settlePurchase({ status: "store-unavailable" });
        return;
      }

      try {
        await iap.finishTransaction({ purchase, isConsumable: false });
      } catch (error) {
        logBalanceProWarn("Failed to finish Balance Pro subscription transaction", error, {
          productId: purchase.productId,
          transactionId: purchase.transactionId ?? purchase.id ?? null,
        });
      }

      const optimisticState = createEntitlementFromPurchase(purchase);
      await persistEntitlementState(optimisticState);
      const hasActiveSubscription = await refreshProStatusInternal(iap);
      const purchaseContext = purchaseContextRef.current;
      const shouldShowWelcome = Boolean(
        purchaseContext?.allowWelcome &&
          purchaseContext.wasProAtStart === false &&
          (hasActiveSubscription || optimisticState.isPro) &&
          !hasSeenProWelcomeRef.current
      );
      logBalanceProInfo("Balance Pro purchase processed", {
        productId: purchase.productId,
        transactionId: purchase.transactionId ?? purchase.id ?? null,
        purchaseState: purchase.purchaseState,
        hasActiveSubscription,
        showWelcome: shouldShowWelcome,
      });
      settlePurchase(
        hasActiveSubscription || optimisticState.isPro
          ? { status: "success", showWelcome: shouldShowWelcome }
          : { status: "error" }
      );
    },
    [getIapRuntime, persistEntitlementState, refreshProStatusInternal, settlePurchase]
  );

  const handlePurchaseFailure = useCallback(
    async (error: PurchaseError | Error) => {
      logBalanceProWarn("Balance Pro purchase failed", error, {
        code: getErrorCode(error),
        message: getErrorMessage(error),
        isStoreConnected,
      });

      if (isUserCancelledPurchase(error)) {
        settlePurchase({ status: "cancelled" });
        return;
      }

      if (isProductUnavailableError(error)) {
        settlePurchase({ status: "product-unavailable" });
        return;
      }

      if ("code" in error && error.code === ERROR_CODES.alreadyOwned) {
        const iap = getIapRuntime();
        const hasBalancePro = iap && isStoreConnected ? await refreshProStatusInternal(iap) : false;
        settlePurchase(hasBalancePro ? { status: "success", showWelcome: false } : { status: "error", message: error.message });
        return;
      }

      if (isStoreUnavailableError(error)) {
        settlePurchase({ status: "store-unavailable" });
        return;
      }

      settlePurchase({ status: "error", message: error.message });
    },
    [getIapRuntime, isStoreConnected, refreshProStatusInternal, settlePurchase]
  );

  const connectStore = useCallback(async (): Promise<ExpoIapRuntime | null> => {
    if (Platform.OS !== "ios") {
      return null;
    }

    if (initStorePromiseRef.current) {
      const connected = await initStorePromiseRef.current;
      return connected ? getIapRuntime() : null;
    }

    const runtime = getIapRuntime();
    if (!runtime) {
      setIsStoreConnected(false);
      setStoreErrorCode(ERROR_CODES.runtimeUnavailable);
      setStoreErrorMessage("In-app purchases module unavailable");
      logBalanceProWarn("Expo IAP runtime unavailable");
      return null;
    }

    if (isStoreConnected) {
      return runtime;
    }

    const initPromise = (async () => {
      if (!purchaseSubscriptionRef.current) {
        purchaseSubscriptionRef.current = runtime.purchaseUpdatedListener((purchase) => {
          void handleSuccessfulPurchase(purchase);
        });
      }

      if (!purchaseErrorSubscriptionRef.current) {
        purchaseErrorSubscriptionRef.current = runtime.purchaseErrorListener((error) => {
          void handlePurchaseFailure(error);
        });
      }

      try {
        logBalanceProInfo("Initializing in-app purchases connection");
        const connected = await runtime.initConnection();
        setIsStoreConnected(Boolean(connected));
        if (!connected) {
          setStoreErrorCode(ERROR_CODES.initConnection);
          setStoreErrorMessage("Unable to connect to the App Store");
          logBalanceProWarn("In-app purchases connection was not established");
          return false;
        }

        clearStoreError();
        logBalanceProInfo("In-app purchases connection ready");
        return true;
      } catch (error) {
        setIsStoreConnected(false);
        setStoreErrorCode(getErrorCode(error) ?? ERROR_CODES.initConnection);
        setStoreErrorMessage(getErrorMessage(error) ?? "Failed to initialize in-app purchases");
        logBalanceProWarn("Failed to initialize in-app purchases", error);
        return false;
      } finally {
        initStorePromiseRef.current = null;
      }
    })();

    initStorePromiseRef.current = initPromise;
    const connected = await initPromise;
    return connected ? runtime : null;
  }, [
    clearStoreError,
    getIapRuntime,
    handlePurchaseFailure,
    handleSuccessfulPurchase,
    isStoreConnected,
  ]);

  const useCachedEntitlement = useCallback(async (reason: string): Promise<BalanceProEntitlement> => {
    const cachedEntitlement = await readPersistedEntitlement();
    const runtimeEntitlement = applyEntitlement(cachedEntitlement, "cache");
    logBalanceProInfo("Using cached Balance Pro entitlement", {
      reason,
      isPro: runtimeEntitlement.isPro,
      lastValidatedAt: runtimeEntitlement.lastValidatedAt,
      isStale: runtimeEntitlement.isStale,
    });

    if (runtimeEntitlement.isStale) {
      logBalanceProWarn("Balance Pro entitlement cache is stale", undefined, {
        reason,
        lastValidatedAt: runtimeEntitlement.lastValidatedAt,
      });
    }

    return runtimeEntitlement;
  }, [applyEntitlement]);

  const syncEntitlementFromCurrentConnectivity = useCallback(
    async (options?: { reason?: string; loadCatalog?: boolean }): Promise<{ isPro: boolean; hasProducts: boolean }> => {
      if (Platform.OS !== "ios") {
        return { isPro: isProRef.current, hasProducts: false };
      }

      if (entitlementSyncPromiseRef.current) {
        const inFlightResult = await entitlementSyncPromiseRef.current;
        if (!options?.loadCatalog || inFlightResult.hasProducts) {
          return inFlightResult;
        }
      }

      const reason = options?.reason ?? "manual";
      const syncPromise = (async () => {
        const online = await checkNetworkAvailability();
        if (!online) {
          const cachedEntitlement = await useCachedEntitlement(`${reason}:offline`);
          return {
            isPro: cachedEntitlement.isPro,
            hasProducts: hasLoadedProducts(productsByPlan),
          };
        }

        logBalanceProInfo("Fetching Balance Pro entitlement from store", {
          reason,
        });

        const runtime = await connectStore();
        if (!runtime) {
          const cachedEntitlement = await useCachedEntitlement(`${reason}:store-unavailable`);
          return {
            isPro: cachedEntitlement.isPro,
            hasProducts: hasLoadedProducts(productsByPlan),
          };
        }

        const hasProducts = options?.loadCatalog ? await loadStoreCatalog(runtime) : hasLoadedProducts(productsByPlan);
        const hasBalancePro = await refreshProStatusInternal(runtime);
        return {
          isPro: hasBalancePro,
          hasProducts,
        };
      })().finally(() => {
        entitlementSyncPromiseRef.current = null;
      });

      entitlementSyncPromiseRef.current = syncPromise;
      return syncPromise;
    },
    [connectStore, loadStoreCatalog, productsByPlan, refreshProStatusInternal, useCachedEntitlement]
  );

  const prepareStore = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "ios") {
      return false;
    }

    setIsStoreLoading(true);
    try {
      const result = await syncEntitlementFromCurrentConnectivity({
        reason: "prepare-store",
        loadCatalog: true,
      });
      return result.hasProducts;
    } finally {
      setIsStoreLoading(false);
    }
  }, [syncEntitlementFromCurrentConnectivity]);

  useEffect(() => {
    let active = true;

    Promise.all([readPersistedEntitlement(), readHasSeenProWelcome()])
      .then(([value, hasSeenProWelcome]) => {
        if (!active) {
          return;
        }

        applyEntitlement(value, "cache");
        hasSeenProWelcomeRef.current = hasSeenProWelcome;
      })
      .catch((error) => {
        logBalanceProWarn("Failed to read Balance Pro state", error);
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
          void syncEntitlementFromCurrentConnectivity({
            reason: "startup",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [applyEntitlement, syncEntitlementFromCurrentConnectivity]);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return undefined;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncEntitlementFromCurrentConnectivity({
          reason: "app-active",
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncEntitlementFromCurrentConnectivity]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !isReady) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      void syncEntitlementFromCurrentConnectivity({
        reason: "online-sync-interval",
      });
    }, ONLINE_SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isReady, syncEntitlementFromCurrentConnectivity]);

  const refreshProStatus = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "ios") {
      return isProRef.current;
    }

    const result = await syncEntitlementFromCurrentConnectivity({
      reason: "refresh-pro-status",
    });
    return result.isPro;
  }, [syncEntitlementFromCurrentConnectivity]);

  const purchase = useCallback(
    async (plan: BalanceProPlanId): Promise<PurchaseProResult> => {
      if (Platform.OS !== "ios") {
        return { status: "store-unavailable" };
      }

      logBalanceProInfo("Balance Pro purchase requested", {
        plan,
        productId: BALANCE_PRO_PRODUCT_ID_BY_PLAN[plan],
      });

      const hasLoadedCatalog = await prepareStore();
      const iap = getIapRuntime();
      if (!iap) {
        return { status: "store-unavailable" };
      }

      if (isPurchasePending) {
        return { status: "error" };
      }

      if (isProRef.current) {
        logBalanceProInfo("Balance Pro already active before purchase request", {
          plan,
        });
        return { status: "success", showWelcome: false };
      }

      let resolvedProducts = productsByPlan;
      try {
        if (!resolvedProducts[plan] && hasLoadedCatalog) {
          resolvedProducts = await loadProducts(iap);
        }
      } catch (error) {
        logBalanceProWarn("Failed to prepare Balance Pro subscription purchase", error, {
          plan,
        });
        return { status: "store-unavailable" };
      }

      const selectedProduct = resolvedProducts[plan];
      if (!selectedProduct) {
        return hasLoadedCatalog || storeErrorCode === ERROR_CODES.emptyProducts
          ? { status: "product-unavailable" }
          : { status: "store-unavailable" };
      }

      purchaseContextRef.current = {
        plan,
        wasProAtStart: isProRef.current,
        allowWelcome: true,
      };
      logBalanceProInfo("Prepared Balance Pro product for purchase", {
        plan,
        expectedProductId: BALANCE_PRO_PRODUCT_ID_BY_PLAN[plan],
        ...getProductDebugDetails(selectedProduct),
      });

      setIsPurchasePending(true);

      return new Promise((resolve) => {
        purchaseResolverRef.current = resolve;

        void (async () => {
          try {
            const result = await iap.requestPurchase({
              type: "subs",
              request: {
                apple: { sku: selectedProduct.id },
                google: { skus: [selectedProduct.id] },
              },
            });

            const purchaseResult = Array.isArray(result)
              ? result.find((item) => item.productId === selectedProduct.id) ?? null
              : result;
            if (!purchaseResult) {
              logBalanceProInfo("Balance Pro purchase returned no transaction", {
                plan,
                productId: selectedProduct.id,
              });
              settlePurchase({ status: "cancelled" });
              return;
            }

            await handleSuccessfulPurchase(purchaseResult);
          } catch (error) {
            await handlePurchaseFailure(error as PurchaseError | Error);
          }
        })();
      });
    },
    [
      getIapRuntime,
      handlePurchaseFailure,
      handleSuccessfulPurchase,
      isPurchasePending,
      loadProducts,
      prepareStore,
      productsByPlan,
      storeErrorCode,
      settlePurchase,
    ]
  );

  const restore = useCallback(async (): Promise<RestorePurchasesResult> => {
    if (Platform.OS !== "ios") {
      return { status: "store-unavailable" };
    }

    const iap = await connectStore();
    if (!iap) {
      return { status: "store-unavailable" };
    }

    if (isRestorePending) {
      return { status: "error" };
    }

    setIsRestorePending(true);

    try {
      logBalanceProInfo("Restore purchases requested");
      await iap.restorePurchases();
      const hasBalancePro = await refreshProStatus();
      logBalanceProInfo("Restore purchases completed", {
        hasBalancePro,
      });
      return hasBalancePro ? { status: "restored" } : { status: "nothing-to-restore" };
    } catch (error) {
      logBalanceProWarn("Failed to restore Balance Pro subscriptions", error);
      if (isStoreUnavailableError(error)) {
        return { status: "store-unavailable" };
      }
      return {
        status: "error",
        message: error instanceof Error ? error.message : undefined,
      };
    } finally {
      setIsRestorePending(false);
    }
  }, [connectStore, isRestorePending, refreshProStatus]);

  useEffect(() => {
    return () => {
      purchaseSubscriptionRef.current?.remove();
      purchaseErrorSubscriptionRef.current?.remove();
      purchaseSubscriptionRef.current = null;
      purchaseErrorSubscriptionRef.current = null;
      initStorePromiseRef.current = null;
      const iap = iapRef.current;
      iapRef.current = null;
      if (iap) {
        void iap.endConnection().catch((error) => {
          logBalanceProWarn("Failed to close in-app purchases connection", error);
        });
      }
    };
  }, []);

  const canCreateWallet = useCallback(
    (walletCount: number) => isProRef.current || walletCount < FREE_WALLET_LIMIT,
    []
  );

  const availablePlans = useMemo(() => createPlanEntries(productsByPlan), [productsByPlan]);

  const markProWelcomeSeen = useCallback(async (): Promise<void> => {
    await setPreference(PRO_WELCOME_SEEN_PREFERENCE_KEY, "true");
    hasSeenProWelcomeRef.current = true;
  }, []);

  return (
    <BalanceProContext.Provider
      value={{
        isPro,
        activePlan,
        hasActiveSubscription: isPro,
        isReady,
        entitlementSource,
        isEntitlementStale: isEntitlementCacheStale,
        lastValidatedAt,
        isStoreAvailable: Platform.OS === "ios" && isStoreConnected && hasLoadedProducts(productsByPlan),
        isStoreLoading,
        storeErrorCode,
        storeErrorMessage,
        isPurchasePending,
        isRestorePending,
        availablePlans,
        canCreateWallet,
        prepareStore,
        purchase,
        restore,
        refreshProStatus,
        markProWelcomeSeen,
      }}
    >
      {children}
    </BalanceProContext.Provider>
  );
}

export function useBalancePro(): BalanceProContextValue {
  const context = useContext(BalanceProContext);
  if (!context) {
    if (!hasWarnedMissingBalanceProProvider) {
      hasWarnedMissingBalanceProProvider = true;
      console.warn("useBalancePro rendered without BalanceProProvider. Falling back to non-Pro defaults.");
    }
    return FALLBACK_BALANCE_PRO_CONTEXT;
  }
  return context;
}
