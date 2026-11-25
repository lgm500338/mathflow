/**
 * Rewarded-Ad Ready Hint Provider Adapter.
 *
 * Currently runs in 100% offline-free mode (zero API calls, instant hint reveal).
 * When packaging for Google Play Store (Capacitor / TWA / Android WebView),
 * swap `activeHintProvider` with an AdMob Rewarded Ad implementation while
 * keeping all game UI and state logic untouched.
 */

export interface HintRewardResult {
  granted: boolean;
  source: 'offline-free' | 'admob-rewarded';
}

export interface HintProvider {
  requestHintReward(): Promise<HintRewardResult>;
}

class OfflineFreeHintProvider implements HintProvider {
  async requestHintReward(): Promise<HintRewardResult> {
    return { granted: true, source: 'offline-free' };
  }
}

export const hintProvider: HintProvider = new OfflineFreeHintProvider();
