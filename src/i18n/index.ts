/**
 * i18n system — simple key-value translation lookup.
 * Falls back to English if a key is missing in the active locale.
 */

type Translations = Record<string, string>;

const LOCALES: Record<string, Translations> = {
  en: {
    // Menu
    'menu.title': 'LUMINACLASH',
    'menu.subtitle': 'Territory Control',
    'menu.start': 'START GAME',
    'menu.campaign': 'CAMPAIGN',
    'menu.howto': 'HOW TO PLAY',
    'menu.controls': 'CONTROLS',
    'menu.settings': 'SETTINGS',
    'menu.resume': 'RESUME',
    'menu.quit': 'QUIT',
    'menu.back': 'BACK',

    // Controls
    'controls.move': 'Move',
    'controls.sprint': 'Sprint',
    'controls.wall': 'Place Wall',
    'controls.pause': 'Pause',

    // Settings
    'settings.difficulty': 'DIFFICULTY',
    'settings.map_size': 'MAP SIZE',
    'settings.map_type': 'MAP TYPE',
    'settings.duration': 'TIME LIMIT',
    'settings.bots': 'BOTS',

    // HUD
    'hud.you': 'YOU',
    'hud.obstacles': 'Obstacles',
    'hud.sprint': 'Sprint',

    // Game Over
    'gameover.victory': 'VICTORY!',
    'gameover.defeat': 'DEFEAT',
    'gameover.next_match': 'Next Match',
    'gameover.next_level': 'Next Level',
    'gameover.retry': 'Retry',
    'gameover.menu': 'Menu',
    'gameover.settings': 'Settings',
    'gameover.session': 'Session',
    'gameover.new_best': 'NEW BEST!',

    // Campaign
    'campaign.title': 'CAMPAIGN',
    'campaign.level': 'Level',
    'campaign.locked': 'Locked',
    'campaign.player_level': 'Level',
    'campaign.xp': 'XP',
    'campaign.stars': 'Stars',

    // Touch
    'touch.sprint': 'SPRINT',
    'touch.wall': 'WALL',

    // Tutorial
    'tutorial.move': "Use WASD or Arrow Keys to move your light orb",
    'tutorial.capture': "Cells you illuminate change to your color — that's your territory!",
    'tutorial.sprint': 'Hold SHIFT to sprint — faster capture but uses energy',
    'tutorial.obstacle': 'Click to place walls — block opponents from your territory',
    'tutorial.powerup': 'Grab ⚡ speed, 💣 bombs, and 🛡️ shields when they appear',
    'tutorial.goal': 'Control the most territory before time runs out — good luck!',
    'tutorial.skip': 'Skip ▸',

    // Difficulty
    'diff.easy': 'EASY',
    'diff.medium': 'MEDIUM',
    'diff.hard': 'HARD',
    'diff.brutal': 'BRUTAL',

    // Map type
    'map.arena': 'ARENA',
    'map.maze': 'MAZE',
    'map.fortress': 'FORTRESS',
    'map.random': 'RANDOM',
  },
  ru: {
    'menu.title': 'LUMINACLASH',
    'menu.subtitle': 'Контроль Территории',
    'menu.start': 'НАЧАТЬ ИГРУ',
    'menu.campaign': 'КАМПАНИЯ',
    'menu.howto': 'КАК ИГРАТЬ',
    'menu.controls': 'УПРАВЛЕНИЕ',
    'menu.settings': 'НАСТРОЙКИ',
    'menu.resume': 'ПРОДОЛЖИТЬ',
    'menu.quit': 'ВЫХОД',
    'menu.back': 'НАЗАД',
    'controls.move': 'Движение',
    'controls.sprint': 'Спринт',
    'controls.wall': 'Поставить стену',
    'controls.pause': 'Пауза',
    'hud.you': 'ВЫ',
    'hud.obstacles': 'Препятствия',
    'hud.sprint': 'Спринт',
    'gameover.victory': 'ПОБЕДА!',
    'gameover.defeat': 'ПОРАЖЕНИЕ',
    'gameover.next_match': 'Следующий матч',
    'gameover.next_level': 'Следующий уровень',
    'gameover.retry': 'Повторить',
    'gameover.menu': 'Меню',
    'gameover.settings': 'Настройки',
    'gameover.session': 'Сессия',
    'gameover.new_best': 'НОВЫЙ РЕКОРД!',
    'campaign.title': 'КАМПАНИЯ',
    'campaign.level': 'Уровень',
    'campaign.locked': 'Заблокировано',
    'campaign.player_level': 'Уровень',
    'campaign.xp': 'XP',
    'campaign.stars': 'Звёзды',
    'touch.sprint': 'СПРИНТ',
    'touch.wall': 'СТЕНА',
    'tutorial.move': 'Используйте WASD или стрелки для движения',
    'tutorial.capture': 'Освещённые ячейки становятся вашими — это ваша территория!',
    'tutorial.sprint': 'Зажмите SHIFT для спринта — быстрее захват, но тратит энергию',
    'tutorial.obstacle': 'Кликните, чтобы поставить стену — блокируйте противников',
    'tutorial.powerup': 'Собирайте ⚡ скорость, 💣 бомбы и 🛡️ щиты',
    'tutorial.goal': 'Захватите больше всего территории до конца времени — удачи!',
    'tutorial.skip': 'Пропустить ▸',
    'diff.easy': 'ЛЕГКО',
    'diff.medium': 'СРЕДНЕ',
    'diff.hard': 'СЛОЖНО',
    'diff.brutal': 'БЕЗУМИЕ',
    'map.arena': 'АРЕНА',
    'map.maze': 'ЛАБИРИНТ',
    'map.fortress': 'КРЕПОСТЬ',
    'map.random': 'СЛУЧАЙНО',
  },
  ua: {
    'menu.title': 'LUMINACLASH',
    'menu.subtitle': 'Контроль Території',
    'menu.start': 'ПОЧАТИ ГРУ',
    'menu.campaign': 'КАМПАНІЯ',
    'menu.howto': 'ЯК ГРАТИ',
    'menu.controls': 'КЕРУВАННЯ',
    'menu.settings': 'НАЛАШТУВАННЯ',
    'menu.resume': 'ПРОДОВЖИТИ',
    'menu.quit': 'ВИХІД',
    'menu.back': 'НАЗАД',
    'hud.you': 'ВИ',
    'gameover.victory': 'ПЕРЕМОГА!',
    'gameover.defeat': 'ПОРАЗКА!',
    'gameover.next_match': 'Наступний матч',
    'gameover.next_level': 'Наступний рівень',
    'gameover.retry': 'Повторити',
    'gameover.menu': 'Меню',
    'tutorial.move': 'Використовуйте WASD або стрілки для руху',
    'tutorial.skip': 'Пропустити ▸',
    'diff.easy': 'ЛЕГКО',
    'diff.medium': 'СЕРЕДНЬО',
    'diff.hard': 'СКЛАДНО',
    'diff.brutal': 'БЕЗУМНЯ',
  },
  de: {
    'menu.title': 'LUMINACLASH',
    'menu.subtitle': 'Gebietskontrolle',
    'menu.start': 'SPIEL STARTEN',
    'menu.campaign': 'KAMPAGNE',
    'menu.howto': 'ANLEITUNG',
    'menu.controls': 'STEUERUNG',
    'menu.settings': 'EINSTELLUNGEN',
    'menu.resume': 'FORTSETZEN',
    'menu.quit': 'BEENDEN',
    'menu.back': 'ZURÜCK',
    'hud.you': 'DU',
    'gameover.victory': 'SIEG!',
    'gameover.defeat': 'NIEDERLAGE!',
    'gameover.next_match': 'Nächstes Spiel',
    'gameover.next_level': 'Nächstes Level',
    'gameover.retry': 'Erneut',
    'gameover.menu': 'Menü',
    'tutorial.skip': 'Überspringen ▸',
    'diff.easy': 'LEICHT',
    'diff.medium': 'MITTEL',
    'diff.hard': 'SCHWER',
    'diff.brutal': 'BRUTAL',
  },
};

const SAVE_KEY = 'luminaclash_locale';
const DEFAULT_LOCALE = 'en';

/** Get the user's saved locale preference, or detect from browser */
function detectLocale(): string {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch { /* noop */ }

  // Browser detection
  const browserLang = navigator.language?.split('-')[0] || 'en';
  if (LOCALES[browserLang]) return browserLang;
  return DEFAULT_LOCALE;
}

let currentLocale = detectLocale();

/**
 * Get a translated string by key.
 * Falls back to English, then returns the key itself if not found at all.
 */
export function t(key: string): string {
  const dict = LOCALES[currentLocale] ?? LOCALES.en;
  if (dict[key]) return dict[key];
  // Fallback to English
  if (currentLocale !== 'en' && LOCALES.en[key]) return LOCALES.en[key];
  return key;
}

/** Get the current locale code */
export function getLocale(): string {
  return currentLocale;
}

/** Set locale and persist */
export function setLocale(locale: string): void {
  if (LOCALES[locale]) {
    currentLocale = locale;
    try { localStorage.setItem(SAVE_KEY, locale); } catch { /* noop */ }
  }
}

/** Get all available locale codes */
export function getAvailableLocales(): { code: string; name: string }[] {
  return [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский' },
    { code: 'ua', name: 'Українська' },
    { code: 'de', name: 'Deutsch' },
  ];
}
