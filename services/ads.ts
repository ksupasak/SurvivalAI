import Constants from 'expo-constants';
import { Platform } from 'react-native';

const TEST_INTERSTITIAL_UNIT_IDS = {
  android: 'ca-app-pub-3940256099942544/1033173712',
  ios: 'ca-app-pub-3940256099942544/4411468910',
} as const;

const SOS_INTERSTITIAL_UNIT_IDS = {
  android: 'ca-app-pub-6925350052022587/2418740467',
  ios: 'ca-app-pub-6925350052022587/7296137987',
} as const;

type MobileAdsModule = typeof import('react-native-google-mobile-ads');
type InterstitialAdInstance = ReturnType<MobileAdsModule['InterstitialAd']['createForAdRequest']>;

let modulePromise: Promise<MobileAdsModule> | null = null;
let initializePromise: Promise<boolean> | null = null;
let interstitial: InterstitialAdInstance | null = null;
let isLoaded = false;
let isLoading = false;
let hasAttachedCoreListeners = false;
let lastErrorMessage = '';

export type ShowSosInterstitialResult = {
  shown: boolean;
  reason:
    | 'shown'
    | 'unsupported-build'
    | 'initialization-failed'
    | 'creation-failed'
    | 'load-timeout'
    | 'show-failed';
  detail?: string;
};

function canUseNativeAds(): boolean {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }

  // Expo Go does not include the native Google Mobile Ads module.
  if (Constants.executionEnvironment === 'storeClient') {
    return false;
  }

  return true;
}

function getInterstitialUnitId(): string | null {
  if (__DEV__) {
    if (Platform.OS === 'android') return TEST_INTERSTITIAL_UNIT_IDS.android;
    if (Platform.OS === 'ios') return TEST_INTERSTITIAL_UNIT_IDS.ios;
    return null;
  }

  if (Platform.OS === 'android') return SOS_INTERSTITIAL_UNIT_IDS.android;
  if (Platform.OS === 'ios') return SOS_INTERSTITIAL_UNIT_IDS.ios;
  return null;
}

async function getMobileAdsModule(): Promise<MobileAdsModule | null> {
  if (!canUseNativeAds()) {
    return null;
  }

  if (!modulePromise) {
    modulePromise = import('react-native-google-mobile-ads').catch((error) => {
      modulePromise = null;
      console.warn('Google Mobile Ads native module is unavailable in this build.', error);
      throw error;
    });
  }

  try {
    return await modulePromise;
  } catch {
    return null;
  }
}

async function ensureAdsInitialized(): Promise<MobileAdsModule | null> {
  const mobileAdsModule = await getMobileAdsModule();

  if (!mobileAdsModule) {
    return null;
  }

  if (!initializePromise) {
    initializePromise = mobileAdsModule
      .default()
      .initialize()
      .then(() => true)
      .catch((error) => {
        initializePromise = null;
        console.warn('Google Mobile Ads SDK failed to initialize.', error);
        return false;
      });
  }

  const initialized = await initializePromise;
  return initialized ? mobileAdsModule : null;
}

async function ensureInterstitial(): Promise<InterstitialAdInstance | null> {
  if (interstitial) {
    return interstitial;
  }

  const mobileAdsModule = await ensureAdsInitialized();
  const unitId = getInterstitialUnitId();

  if (!mobileAdsModule || !unitId) {
    return null;
  }

  interstitial = mobileAdsModule.InterstitialAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  if (!hasAttachedCoreListeners) {
    hasAttachedCoreListeners = true;

    interstitial.addAdEventListener(mobileAdsModule.AdEventType.LOADED, () => {
      isLoaded = true;
      isLoading = false;
      lastErrorMessage = '';
    });

    interstitial.addAdEventListener(mobileAdsModule.AdEventType.CLOSED, () => {
      isLoaded = false;
      isLoading = false;
      void primeSosInterstitial();
    });

    interstitial.addAdEventListener(mobileAdsModule.AdEventType.ERROR, (error) => {
      isLoaded = false;
      isLoading = false;
      lastErrorMessage = error?.message || 'Unknown ad load error';
      setTimeout(() => {
        void primeSosInterstitial();
      }, 1500);
    });
  }

  return interstitial;
}

async function waitForInterstitialReady(timeoutMs = 5000): Promise<boolean> {
  const mobileAdsModule = await ensureAdsInitialized();
  const currentInterstitial = await ensureInterstitial();

  if (!mobileAdsModule || !currentInterstitial) {
    return false;
  }

  if (isLoaded) {
    return true;
  }

  return new Promise((resolve) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      finish(false);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutId);
      unsubscribeLoaded();
      unsubscribeError();
    };

    const finish = (ready: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(ready);
    };

    const unsubscribeLoaded = currentInterstitial.addAdEventListener(
      mobileAdsModule.AdEventType.LOADED,
      () => finish(true)
    );

    const unsubscribeError = currentInterstitial.addAdEventListener(
      mobileAdsModule.AdEventType.ERROR,
      () => finish(false)
    );

    if (!isLoading) {
      isLoading = true;
      currentInterstitial.load();
    }
  });
}

export async function primeSosInterstitial(): Promise<void> {
  const currentInterstitial = await ensureInterstitial();

  if (!currentInterstitial || isLoaded || isLoading) {
    return;
  }

  isLoading = true;
  currentInterstitial.load();
}

export async function primeCalculatorInterstitial(): Promise<void> {
  await primeSosInterstitial();
}

export async function primeNotesInterstitial(): Promise<void> {
  await primeSosInterstitial();
}

export async function showSosInterstitial(): Promise<ShowSosInterstitialResult> {
  if (!canUseNativeAds()) {
    return {
      shown: false,
      reason: 'unsupported-build',
      detail: 'AdMob requires a native dev build or release build. Expo Go cannot show this ad.',
    };
  }

  const mobileAdsModule = await ensureAdsInitialized();
  const currentInterstitial = await ensureInterstitial();

  if (!mobileAdsModule || !currentInterstitial) {
    return {
      shown: false,
      reason: mobileAdsModule ? 'creation-failed' : 'initialization-failed',
      detail: lastErrorMessage || 'AdMob SDK is not ready in this build.',
    };
  }

  const ready = await waitForInterstitialReady();

  if (!ready) {
    return {
      shown: false,
      reason: 'load-timeout',
      detail: lastErrorMessage || 'Interstitial ad did not finish loading in time.',
    };
  }

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      unsubscribeClosed();
      unsubscribeError();
    };

    const finish = (shown: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(
        shown
          ? { shown: true, reason: 'shown' }
          : {
              shown: false,
              reason: 'show-failed',
              detail: lastErrorMessage || 'Interstitial ad failed while opening.',
            }
      );
    };

    const unsubscribeClosed = currentInterstitial.addAdEventListener(
      mobileAdsModule.AdEventType.CLOSED,
      () => finish(true)
    );

    const unsubscribeError = currentInterstitial.addAdEventListener(mobileAdsModule.AdEventType.ERROR, (error) => {
      lastErrorMessage = error?.message || 'Unknown ad show error';
      finish(false);
    });

    try {
      currentInterstitial.show();
    } catch {
      finish(false);
    }
  });
}

export async function showCalculatorInterstitial(): Promise<ShowSosInterstitialResult> {
  return showSosInterstitial();
}

export async function showNotesInterstitial(): Promise<ShowSosInterstitialResult> {
  return showSosInterstitial();
}