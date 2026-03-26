/**
 * Platform abstraction layer.
 * Wrap each platform's SDK behind this interface so game code stays platform-agnostic.
 *
 * Usage:
 *   import { platform } from './platform';
 *   platform.showAd('rewarded', () => { /* give reward * / });
 */

export interface PlatformAPI {
  /** Platform name for logging */
  readonly name: string;

  /** Called once after game init. Set up SDK listeners, etc. */
  init(): Promise<void>;

  /** Show an ad. Returns true if shown, false if unavailable/skipped. */
  showAd(type: 'interstitial' | 'rewarded', onRewarded?: () => void, onClose?: () => void): Promise<boolean>;

  /** Save data to platform cloud (if available), fall back to localStorage. */
  saveCloud(key: string, data: string): Promise<void>;

  /** Load data from platform cloud, fall back to localStorage. */
  loadCloud(key: string): Promise<string | null>;

  /** Report a leaderboard score. */
  postScore(leaderboard: string, score: number): Promise<void>;

  /** Track a gameplay event for analytics. */
  trackEvent(event: string, params?: Record<string, string | number>): void;

  /** Notify platform that loading is complete (some platforms require this). */
  gameReady(): void;

  /** Notify platform that gameplay has started (for analytics). */
  gameplayStart(): void;

  /** Notify platform that gameplay has stopped (for analytics / ad timing). */
  gameplayStop(): void;

  /** Show platform's pause overlay (some platforms require this on blur). */
  pauseGame(): void;

  /** Resume after platform pause. */
  resumeGame(): void;
}

/** No-op platform for desktop/web builds */
class WebPlatform implements PlatformAPI {
  readonly name = 'web';

  async init(): Promise<void> {
    console.log('[Platform] Web — no SDK');
  }

  async showAd(_type: string, onRewarded?: () => void, onClose?: () => void): Promise<boolean> {
    onRewarded?.();
    onClose?.();
    return false;
  }

  async saveCloud(key: string, data: string): Promise<void> {
    try { localStorage.setItem(key, data); } catch { /* noop */ }
  }

  async loadCloud(key: string): Promise<string | null> {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  async postScore(_leaderboard: string, _score: number): Promise<void> {
    // no-op on web
  }

  trackEvent(event: string, params?: Record<string, string | number>): void {
    console.log(`[Analytics] ${event}`, params ?? '');
  }

  gameReady(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  pauseGame(): void {}
  resumeGame(): void {}
}

/** Yandex Games SDK integration */
class YandexPlatform implements PlatformAPI {
  readonly name = 'yandex';

  private ysdk: any = null;

  async init(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.ysdk = await (window as any).YaGames.init();
      console.log('[Platform] Yandex Games SDK initialized');

      // Pause / Resume events from platform
      this.ysdk.on('game_api_pause', () => {
        const game = (window as any).__PHASER_GAME__;
        if (game?.scene?.scenes) {
          const active = game.scene.scenes.find((s: any) => s.scene?.isActive());
          if (active?.scene?.key === 'GameScene') active.scene.pause?.();
        }
      });

      this.ysdk.on('game_api_resume', () => {
        const game = (window as any).__PHASER_GAME__;
        if (game?.scene?.scenes) {
          const active = game.scene.scenes.find((s: any) => s.scene?.isPaused());
          if (active?.scene?.key === 'GameScene') active.scene.resume?.();
        }
      });
    } catch (e) {
      console.warn('[Platform] Failed to init Yandex SDK:', e);
    }
  }

  async showAd(type: string, onRewarded?: () => void, onClose?: () => void): Promise<boolean> {
    if (!this.ysdk) return false;
    try {
      this.gameplayStop();
      if (type === 'rewarded') {
        await this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => { this.gameplayStart(); onRewarded?.(); },
            onClose: () => { this.gameplayStart(); onClose?.(); },
            onError: () => { this.gameplayStart(); },
          },
        });
      } else {
        await this.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: () => { this.gameplayStart(); onClose?.(); },
            onOpen: () => {},
            onError: () => { this.gameplayStart(); },
          },
        });
      }
      return true;
    } catch {
      this.gameplayStart();
      return false;
    }
  }

  async saveCloud(key: string, data: string): Promise<void> {
    try { localStorage.setItem(key, data); } catch { /* noop */ }
  }

  async loadCloud(key: string): Promise<string | null> {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  async postScore(leaderboard: string, score: number): Promise<void> {
    if (!this.ysdk) return;
    try {
      const lb = this.ysdk.getLeaderboards();
      await lb.setLeaderboardScore(leaderboard, score);
    } catch (e) {
      console.warn('[Platform] Failed to post score:', e);
    }
  }

  trackEvent(event: string, params?: Record<string, string | number>): void {
    console.log(`[Yandex] ${event}`, params ?? '');
  }

  gameReady(): void {
    if (!this.ysdk) return;
    try { this.ysdk.features.LoadingAPI.ready(); } catch { /* noop */ }
  }

  gameplayStart(): void {
    if (!this.ysdk) return;
    try { this.ysdk.features.GameplayAPI.start(); } catch {}
  }

  gameplayStop(): void {
    if (!this.ysdk) return;
    try { this.ysdk.features.GameplayAPI.stop(); } catch {}
  }

  pauseGame(): void {}

  resumeGame(): void {}
}

/** VK Play SDK integration (placeholder) */
class VKPlayPlatform implements PlatformAPI {
  readonly name = 'vkplay';

  async init(): Promise<void> {
    console.log('[Platform] VK Play SDK — placeholder');
  }

  async showAd(_type: string, onRewarded?: () => void, onClose?: () => void): Promise<boolean> {
    onRewarded?.();
    onClose?.();
    return false;
  }

  async saveCloud(key: string, data: string): Promise<void> {
    try { localStorage.setItem(key, data); } catch { /* noop */ }
  }

  async loadCloud(key: string): Promise<string | null> {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  async postScore(_leaderboard: string, _score: number): Promise<void> {}

  trackEvent(event: string, params?: Record<string, string | number>): void {
    console.log(`[VKPlay] ${event}`, params ?? '');
  }

  gameReady(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  pauseGame(): void {}
  resumeGame(): void {}
}

/**
 * Detect platform from URL or environment, create appropriate API.
 */
function detectPlatform(): PlatformAPI {
  // Check for Yandex Games
  if (typeof window !== 'undefined') {
    const href = window.location.href;
    if (href.includes('yandex.') || href.includes('games.s3.yandex.net')) {
      return new YandexPlatform();
    }
    // VK Play detection
    if (href.includes('vkplay.') || href.includes('vk.com')) {
      return new VKPlayPlatform();
    }
    // Check for query param override (useful for testing)
    const params = new URLSearchParams(href.split('?')[1] || '');
    const platformParam = params.get('platform');
    if (platformParam === 'yandex') return new YandexPlatform();
    if (platformParam === 'vkplay') return new VKPlayPlatform();
  }

  return new WebPlatform();
}

/** Singleton platform instance */
export const platform: PlatformAPI = detectPlatform();
