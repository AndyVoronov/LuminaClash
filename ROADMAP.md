# LuminaClash — Roadmap

## Текущее состояние

**Что работает:**
- Ядро геймплея: движение, захват территории, raycasting теней
- 2-3 бота с 5-ю AI-состояниями (EXPAND/ATTACK/DEFEND/CLEANSE/RETREAT)
- Все типы препятствий: wall, tower (indestructible, коронка), blinker (warning shimmer), mirror (отражает свет)
- Контестные зоны (shimmer, нейтральные)
- Спринт, частицы, мини-карта, glass HUD
- Визуал: слоистые ячейки, 3D-препятствия, glow-орбы, animated menu
- Power-ups: speed boost, light expand, shield, bomb, steal (5 типов, timed effects)
- Game flow: настройки (difficulty/map/duration), пауза, game over с XP
- Динамические боты (1-3 по сложности Easy/Medium/Hard)

**Что отсутствует или заглушено:**
- Меню: нет tutorial
- Нет звука и музыки
- Нет сохранения прогресса (localStorage)
- Нет мобильного ввода
- Нет онлайна (только local vs bots)
- Нет leaderboards/achievements
- Процедурная генерация карт (пока preset layout)
- Mirror direction player control (пока auto-direction)
- Интеграция с площадками (Yandex Games SDK, и т.д.) не начата

---

## M2: Game Flow & UX (фундамент для всего остального)

> Цель: сделать из прототипа полноценную игру с осмысленным flow — меню → настройки → игра → результаты → повтор.

### S01: Menu & Game Configuration `risk:low` `depends:[]`
- Экран настроек перед матчем:
  - Выбор сложности (Easy/Medium/Hard) — влияет на количество ботов, их reaction delay, скорость, радиус
  - Выбор карты (Small 20×14, Medium 24×18, Large 32×24)
  - Выбор длительности (60s / 120s / 180s / Unlimited)
  - Preview карты с точками спавна
- Back/forward навигация между экранами
- Правильный pointer handling (исправить текущий баг с кликами в меню)

### S02: Pause & Resume `risk:low` `depends:[S01]`
- Пауза по ESC (вместо мгновенного возврата в меню)
- Полупрозрачный overlay с кнопками Resume / Restart / Menu
- Пауза не останавливает визуальные эффекты (частицы, shimmer), но стопит gameplay таймер
- Состояние полностью сохраняется при паузе

### S03: Game Over & Match Flow `risk:low` `depends:[S01]`
- Улучшенный экран результатов: позиции всех игроков с bars, XP/coins earned
- "Next Match" — быстрый рестарт с теми же настройками
- "Change Settings" — возврат в экран конфигурации (без полной перезагрузки)
- XP система: победа = 100 XP, 2 место = 50, 3 = 25, очки за % территории
- Level progression bar в HUD (cosmetic, готовый фундамент для M4)

---

## M3: Gameplay Depth

> Цель: добавить тактическую глубину — новые типы препятствий, power-ups, особые механики.

### S01: Full Obstacle Types `risk:medium` `depends:[]` ✅ DONE
- **Mirror**: отражает свет (увеличивает эффективный радиус в одном направлении)
  - Позиционируется игроком с выбором направления (4 или 8 направлений)
  - Отражённый свет захватывает территорию как обычно, но через "зеркальный" cone
  - Крашится от 2 хитов (постепенный dissolve)
- **Tower**: усиленный wall — не крашится от света, только от прямого столкновения с player orb
  - Визуально выше и массивнее, с крестовым паттерном
  - Боты тоже могут крашить tower-ы, но это стоит им ~2s
- **Blinker**: периодически включается/выключается (уже визуально, но нужно:
  - Настроить blink rate через config
  - Когда включен — блокирует свет, когда выключен — проходимый
  - Мигание видно заранее (пред-warning shimmer перед включением)

### S02: Power-ups on Map `risk:medium` `depends:[M2/S01]` ✅ DONE
- Спавнятся на карте каждые ~15s в случайных нейтральных ячейках
- Типы:
  - **Speed Boost** (жёлтый) — 3s двойная скорость
  - **Light Expand** (голубой) — 5s увеличенный радиус (×1.5)
  - **Shield** (зелёный) — 4s неуязвимость к теням (территория не decay-ится)
  - **Bomb** (красный) — мгновенно разрушает все препятствия в радиусе 3 ячеек
  - **Steal** (фиолетовый) — 3s свет захватывает вражескую территорию напрямую (без decay)
- Визуал: floating orb, additive glow, pick-up анимация
- Боты тоже могут подбирать power-ups (если бот проходит через ячейку)

### S03: Map Generation `risk:medium` `depends:[M2/S01, S01]` ✅ DONE
- Процедурная генерация карт вместо хардкода:
  - Symmetric layouts (для fairness)
  - Preset templates: "Arena" (открытый), "Maze" (много стен), "Fortress" (tower-ы), "Chaos" (blinkers)
  - Количество и расположение initial obstacles зависит от шаблона
  - Validate: все спавн-точки достижимы и не в тени
- Редактор карт (stretch goal — для post-launch)

### S04: Advanced Bot AI `risk:medium` `depends:[S01, S02]` ✅ DONE
- Бот difficulty tiers влияют на реальные параметры:
  - Easy: 1 бот, slow reaction (2s), radius -10%, speed -20%
  - Medium: 2 бота, normal reaction (1.2-1.5s), normal stats
  - Hard: 3 бота, fast reaction (0.6s), radius +10%, speed +10%, smarter obstacle placement
  - Nightmare: 3 бота, reaction 0.3s, aggressive attack bias, targets power-ups
- Боты используют power-ups strategically (не случайно)
- Боты реагируют на mirror-ы (не подходят к ним с той стороны где свет отражается)

---

## M4: Campaign & Progression

> Цель:15 уровней кампании с нарастающей сложностью, уникальными условиями, и meta-progression.

### S01: Level System & Config `risk:low` `depends:[M3/S03]` ✅ DONE
- Структура уровня: map template, bot configs, objectives, unlock conditions
- 15 уровней, 5 глав по 3 уровня (с прогрессией сложности внутри главы)
- Объективы: "Capture 60% territory" / "Survive 90s" / "Destroy all towers" / "Win without placing obstacles"
- Star rating: 1★ = complete, 2★ = time target, 3★ = performance target (% territory / speed)

### S02: Campaign Flow `risk:low` `depends:[S01]` ✅ DONE
- Chapter select screen с star progression
- Уровни открываются последовательно (пройти предыдущий = открыть следующий)
- Briefing перед каждым уровнем: текстовое описание, цель, подсказка
- Victory screen с star animation, XP earned, next level prompt

### S03: Player Progression `risk:low` `depends:[S01]` ✅ DONE
- Persistent save (localStorage):
  - Unlocked levels
  - Stars per level
  - Total XP / player level
  - Player color selection (unlockable colors)
  - Player orb customization (glow intensity, trail shape)
- Level-up unlocks cosmetic rewards (цвета, orb styles, рамки на мини-карте)

---

## M5: Audio & Juice

> Цель: звуковая дизайн, screen shake, combo-система — всё что делает игру "ощутимой".

### S01: Sound Design `risk:low` `depends:[]` ✅ DONE
- Сгенерировать/найти звуковые эффекты (Web Audio API):
  - Territory capture (мягкий chime, pitch varies with territory size)
  - Territory decay (низкий hum)
  - Obstacle placement (твёрдый click)
  - Obstacle dissolve (crumble/rumble)
  - Power-up pick-up (запоминающийся arcadный звук)
  - Power-up activate (WHOOSH)
  - Match start (ascending tone)
  - Victory fanfare / Defeat sting
  - Timer warning (<30s, <10s heartbeat)
  - Menu click / hover
- Фоновая музыка: ambient loop (synth + soft pads), intensifies when match time <30s
- Volume controls (master / music / sfx) — в pause menu

### S02: Game Juice `risk:low` `depends:[M3/S02]` ✅ DONE
- Screen shake при уничтожении tower / bomb power-up
- Slow-motion (time scale 0.3) на 0.5s при pick-up power-up
- Combo counter: быстрые захваты → умножитель, отображается рядом с orb
- Territory capture cascade animation (wave от источника к краям)
- Trail-эффект за orb при спринте (уже частично есть, усилить)
- Vignette effect при low HP / low time
- Death animation для bot orb (при "defeat all towers" objective)

---

## M6: Mobile & Platforms

> Цель: запустить на целевых площадках (Yandex Games, VK Play, CrazyGames, Poki, GameDistribution).

### S01: Touch Controls `risk:high` `depends:[M2/S01]`
- Virtual joystick (left thumb) для движения
- Tap-to-place для препятствий
- Sprint button (right side)
- Pause button (top-right)
- Адаптивная верстка: portrait и landscape
- Gesture: двойной tap = спринт (альтернатива кнопке)

### S02: Responsive Scaling `risk:medium` `depends:[M2/S01]`
- Phaser Scale Manager: Fit mode с letterboxing
- Поддержка: 360×640 (мобильный portrait), 768×1024 (tablet), 1920×1080 (desktop)
- UI elements масштабируются относительно viewport
- Мини-карта адаптируется к размеру экрана

### S03: Platform SDK Integration `risk:high` `depends:[S01, S02]`
- Yandex Games SDK:
  - Auth, advertisements (rewarded = extra time / power-up)
  - Leaderboards (territory %, fastest win)
  - Save sync (Cloud Saves вместо localStorage)
- VK Play SDK: аналогично
- CrazyGames / Poki / GameDistribution:
  - Wrapper API compliance
  - Loading screen
  - Gameplay events tracking
- Build pipeline: единый билд → платформенные обёртки

### S04: Performance Optimization `risk:medium` `depends:[S02]`
- WebGL fallback (Canvas) для слабых устройств
- Graphics batching: уменьшить draw calls (текущие 4+ graphics layers = много)
- Object pooling для частиц
- Reduce grid render: dirty-flag rendering (перерисовывать только изменённые ячейки)
- Target: 60 FPS на Snapdragon 665 / iPhone SE

---

## M7: Polish & Launch

> Цель: финальная полировка, QA, и публикация.

### S01: Tutorial & Onboarding `risk:low` `depends:[M2]`
- Interactive tutorial: первые 30 секунд — guided "move here, capture this, place wall here"
- Tooltip hints в первых 3 матчах
- "How to Play" экран в меню (с анимированными примерами)

### S02: Localization `risk:low` `depends:[M2]`
- i18n система: JSON файлы с переводами
- Языки: EN, RU (приоритет), UA, DE
- Перевод всех UI-строк, tutorial текстов, button labels

### S03: QA & Bug Fixes `risk:low` `depends:[]`
- Edge cases: window resize, tab-switch, memory leaks при scene restart
- Performance profiling на мобильных устройствах
- Обновление после каждого major milestone

---

## Приоритет выполнения

```
M2 (Game Flow)  → M5/S01 (Sound) → M3/S01 (Obstacles) → M3/S02 (Power-ups) → M6/S01-S02 (Mobile)
                                                                                    ↓
M3/S03 (Maps) → M3/S04 (Bot AI) → M4 (Campaign) → M5/S02 (Juice) → M6/S03-S04 (Platforms) → M7 (Launch)
```

**Рекомендация по следующему шагу:** M2 — без нормального game flow (меню, пауза, настройки) всё остальное будет некомфортно тестировать и демонстрировать.
