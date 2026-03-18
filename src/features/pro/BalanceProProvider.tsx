import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import type {
  ActiveSubscription,
  ProductSubscription,
  Purchase,
  PurchaseError,
  RenewalInfoIOS,
} from "expo-iap";
import { getPreference, setPreference } from "@/repositories/preferencesRepo";
import {
  BALANCE_PRO_PRODUCT_ID_BY_PLAN,
  BALANCE_PRO_PRODUCT_IDS,
  FREE_WALLET_LIMIT,
  type BalanceProPlanId,
} from "@/config/entitlements";

const SUBSCRIPTION_STATE_PREFERENCE_KEY = "entitlements.balancePro.subscriptionState";
const LEGACY_IS_PRO_PREFERENCE_KEY = "entitlements.balancePro.isPro";
const FALLBACK_ENTITLEMENT_CACHE_MS = 24 * 60 * 60 * 1000;
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
  | { status: "success" }
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

export type BalanceProAvailablePlan = {
  planId: BalanceProPlanId;
  productId: string;
  product: ProductSubscription | null;
  displayPrice: string | null;
  isBestValue: boolean;
};

type BalanceProContextValue = {
  isPro: boolean;
  activePlan: BalanceProPlanId | null;
  hasActiveSubscription: boolean;
  isReady: boolean;
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
};

const BalanceProContext = createContext<BalanceProContextValue | null>(null);

type BalanceProProviderProps = {
  children: React.ReactNode;
};

type PersistedSubscriptionState = {
  version: 2;
  activePlan: BalanceProPlanId | null;
  productId: string | null;
  expiresAt: number | null;
  hasActiveSubscription: boolean;
  lastValidatedAt: number;
};

type ExpoIapRuntime = typeof import("expo-iap");

type ProductMap = Record<BalanceProPlanId, ProductSubscription | null>;

const EMPTY_PRODUCT_MAP: ProductMap = {
  monthly: null,
  yearly: null,
};

const EMPTY_SUBSCRIPTION_STATE: PersistedSubscriptionState = {
  version: 2,
  activePlan: null,
  productId: null,
  expiresAt: null,
  hasActiveSubscription: false,
  lastValidatedAt: 0,
};

function getExpoIapRuntime(): ExpoIapRuntime | null {
  if (Platform.OS !== "ios") {
    return null;
  }

  const nativeModule = requireOptionalNativeModule("ExpoIap");
  if (!nativeModule) {
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

function createPersistedState(params: {
  productId: string | null;
  activePlan: BalanceProPlanId | null;
  hasActiveSubscription: boolean;
  expiresAt: number | null;
  lastValidatedAt?: number;
}): PersistedSubscriptionState {
  return {
    version: 2,
    productId: params.productId,
    activePlan: params.activePlan,
    hasActiveSubscription: params.hasActiveSubscription,
    expiresAt: params.expiresAt,
    lastValidatedAt: params.lastValidatedAt ?? Date.now(),
  };
}

function createStateFromPurchase(purchase: Purchase): PersistedSubscriptionState {
  if (!isBalanceProPurchase(purchase)) {
    return EMPTY_SUBSCRIPTION_STATE;
  }

  const activePlan = getPlanFromProductId(purchase.productId);
  const expirationDateIOS = "expirationDateIOS" in purchase ? purchase.expirationDateIOS : null;
  const renewalInfoIOS = "renewalInfoIOS" in purchase ? purchase.renewalInfoIOS : null;
  return createPersistedState({
    productId: purchase.productId,
    activePlan,
    hasActiveSubscription: purchase.purchaseState !== "pending" && activePlan !== null,
    expiresAt:
      purchase.purchaseState === "pending"
        ? null
        : resolveEntitlementExpiry({
            expirationDateIOS,
            renewalInfoIOS,
            transactionDate: purchase.transactionDate,
          }),
  });
}

function createStateFromSubscription(subscription: ActiveSubscription): PersistedSubscriptionState {
  const activePlan = getPlanFromProductId(subscription.currentPlanId ?? subscription.productId);
  const productId = isBalanceProProductId(subscription.currentPlanId)
    ? subscription.currentPlanId
    : isBalanceProProductId(subscription.productId)
    ? subscription.productId
    : null;

  return createPersistedState({
    productId,
    activePlan,
    hasActiveSubscription: subscription.isActive && activePlan !== null,
    expiresAt: resolveEntitlementExpiry({
      expirationDateIOS: subscription.expirationDateIOS,
      renewalInfoIOS: subscription.renewalInfoIOS,
      transactionDate: subscription.transactionDate,
    }),
  });
}

function readCachedEntitlement(state: PersistedSubscriptionState): { isPro: boolean; activePlan: BalanceProPlanId | null } {
  if (!state.hasActiveSubscription || !state.activePlan || !isBalanceProProductId(state.productId)) {
    return { isPro: false, activePlan: null };
  }

  if (!state.expiresAt || state.expiresAt <= Date.now()) {
    return { isPro: false, activePlan: null };
  }

  return { isPro: true, activePlan: state.activePlan };
}

function parsePersistedState(value: string | null | undefined): PersistedSubscriptionState {
  if (!value) {
    return EMPTY_SUBSCRIPTION_STATE;
  }

  try {
    const parsed = JSON.parse(value) as Partial<PersistedSubscriptionState>;
    const productId = isBalanceProProductId(parsed.productId ?? null) ? parsed.productId ?? null : null;
    const activePlan = parsed.activePlan === "monthly" || parsed.activePlan === "yearly" ? parsed.activePlan : null;
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : null;
    const hasActiveSubscription = parsed.hasActiveSubscription === true;
    const lastValidatedAt = typeof parsed.lastValidatedAt === "number" ? parsed.lastValidatedAt : 0;

    return {
      version: 2,
      productId,
      activePlan,
      expiresAt,
      hasActiveSubscription,
      lastValidatedAt,
    };
  } catch (error) {
    logBalanceProWarn("Failed to parse Balance Pro entitlement cache", error);
    return EMPTY_SUBSCRIPTION_STATE;
  }
}

async function readPersistedSubscriptionState(): Promise<PersistedSubscriptionState> {
  const subscriptionState = await getPreference(SUBSCRIPTION_STATE_PREFERENCE_KEY);
  if (subscriptionState?.value) {
    return parsePersistedState(subscriptionState.value);
  }

  // The legacy key represented a permanent non-consumable unlock. Ignore it so
  // deprecated local state does not silently grant subscription access.
  const legacyFlag = await getPreference(LEGACY_IS_PRO_PREFERENCE_KEY);
  if (legacyFlag?.value) {
    return EMPTY_SUBSCRIPTION_STATE;
  }

  return EMPTY_SUBSCRIPTION_STATE;
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

function createPlanEntries(products: ProductMap): BalanceProAvailablePlan[] {
  return (["yearly", "monthly"] as const).map((planId) => ({
    planId,
    productId: BALANCE_PRO_PRODUCT_ID_BY_PLAN[planId],
    product: products[planId],
    displayPrice: products[planId]?.displayPrice ?? null,
    isBestValue: planId === "yearly",
  }));
}

export function BalanceProProvider({ children }: BalanceProProviderProps): React.ReactElement {
  const [isPro, setIsPro] = useState(false);
  const [activePlan, setActivePlan] = useState<BalanceProPlanId | null>(null);
  const [isReady, setIsReady] = useState(false);
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
  const handledTransactionsRef = useRef(new Set<string>());
  const purchaseResolverRef = useRef<((result: PurchaseProResult) => void) | null>(null);
  const purchaseSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const purchaseErrorSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);

  const persistEntitlementState = useCallback(async (nextState: PersistedSubscriptionState) => {
    const cachedEntitlement = readCachedEntitlement(nextState);
    setIsPro(cachedEntitlement.isPro);
    setActivePlan(cachedEntitlement.activePlan);
    isProRef.current = cachedEntitlement.isPro;
    await setPreference(SUBSCRIPTION_STATE_PREFERENCE_KEY, JSON.stringify(nextState));
  }, []);

  const settlePurchase = useCallback((result: PurchaseProResult) => {
    setIsPurchasePending(false);
    const resolver = purchaseResolverRef.current;
    purchaseResolverRef.current = null;
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
      matchedProductIds: Object.values(nextProducts)
        .map((item) => item?.id ?? null)
        .filter((item): item is string => Boolean(item)),
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
    const nextState = activePurchase ? createStateFromPurchase(activePurchase) : EMPTY_SUBSCRIPTION_STATE;
    await persistEntitlementState(nextState);
    return nextState.hasActiveSubscription;
  }, [getIapRuntime, persistEntitlementState]);

  const refreshProStatusInternal = useCallback(async (runtime: ExpoIapRuntime): Promise<boolean> => {
    try {
      const subscriptions = await runtime.getActiveSubscriptions([...BALANCE_PRO_PRODUCT_IDS]);
      const activeSubscription = sortActiveSubscriptions(
        subscriptions.filter((subscription) => isBalanceProProductId(subscription.currentPlanId ?? subscription.productId))
      )[0];
      const nextState = activeSubscription ? createStateFromSubscription(activeSubscription) : EMPTY_SUBSCRIPTION_STATE;
      await persistEntitlementState(nextState);
      return nextState.hasActiveSubscription;
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
        settlePurchase({ status: "success" });
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

      const optimisticState = createStateFromPurchase(purchase);
      await persistEntitlementState(optimisticState);
      const hasActiveSubscription = await refreshProStatusInternal(iap);
      logBalanceProInfo("Balance Pro purchase processed", {
        productId: purchase.productId,
        transactionId: purchase.transactionId ?? purchase.id ?? null,
        purchaseState: purchase.purchaseState,
        hasActiveSubscription,
      });
      settlePurchase(hasActiveSubscription || optimisticState.hasActiveSubscription ? { status: "success" } : { status: "error" });
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
        settlePurchase(hasBalancePro ? { status: "success" } : { status: "error", message: error.message });
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

  const prepareStore = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "ios") {
      return false;
    }

    setIsStoreLoading(true);
    try {
      const runtime = await connectStore();
      if (!runtime) {
        return false;
      }

      const hasProducts = await loadStoreCatalog(runtime);
      await refreshProStatusInternal(runtime);
      return hasProducts;
    } finally {
      setIsStoreLoading(false);
    }
  }, [connectStore, loadStoreCatalog, refreshProStatusInternal]);

  useEffect(() => {
    let active = true;

    readPersistedSubscriptionState()
      .then((value) => {
        if (!active) {
          return;
        }

        const cachedEntitlement = readCachedEntitlement(value);
        setIsPro(cachedEntitlement.isPro);
        setActivePlan(cachedEntitlement.activePlan);
        isProRef.current = cachedEntitlement.isPro;
      })
      .catch((error) => {
        logBalanceProWarn("Failed to read Balance Pro state", error);
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios" || !isStoreConnected) {
      return undefined;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void prepareStore();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isStoreConnected, prepareStore]);

  const refreshProStatus = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "ios") {
      return isProRef.current;
    }

    const iap = await connectStore();
    if (!iap) {
      return isProRef.current;
    }

    return refreshProStatusInternal(iap);
  }, [connectStore, refreshProStatusInternal]);

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

  return (
    <BalanceProContext.Provider
      value={{
        isPro,
        activePlan,
        hasActiveSubscription: isPro,
        isReady,
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
      }}
    >
      {children}
    </BalanceProContext.Provider>
  );
}

export function useBalancePro(): BalanceProContextValue {
  const context = useContext(BalanceProContext);
  if (!context) {
    throw new Error("useBalancePro must be used within a BalanceProProvider");
  }
  return context;
}
