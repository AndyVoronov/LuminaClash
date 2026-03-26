# LuminaClash

**Territory control game.** Move your light orb across a grid — cells you illuminate become yours. Place walls, grab power-ups, outmaneuver AI opponents, and control the most territory before time runs out.

## 🎮 Play

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

## Features

- **Core Gameplay** — real-time territory capture with light/shadow mechanics
- **Advanced AI** — 4 difficulty levels (Easy → Brutal) with strategic bot behaviors
- **Map Generator** — Arena, Maze, Fortress, Random templates with configurable size
- **Power-ups** — Speed boost ⚡, Bomb 💣, Shield 🛡️, Score Multiplier ×2
- **Obstacles** — place walls to block opponents and protect territory
- **Campaign** — 15 levels across 5 chapters with star ratings, unlock chain, objectives
- **Player Progression** — XP, levels, 9 unlockable cosmetic colors
- **Audio** — synthesized sound effects + ambient music via Web Audio API
- **Game Juice** — screen shake, slow-mo, combo counter, vignette, territory milestones
- **Touch Controls** — virtual joystick + action buttons for mobile
- **Responsive** — scales from 360px mobile to 1920px desktop
- **Tutorial** — 6-step guided onboarding (first match only)
- **Localization** — EN, RU, UA, DE
- **Platform SDK** — Yandex Games, VK Play (adapters ready)

## Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Move | WASD / Arrows | Virtual joystick |
| Sprint | Shift | Sprint button |
| Place Wall | Left Click | Wall button |
| Pause | ESC | Pause button |

## Build

```bash
npm run build    # production build → dist/
npm run preview  # preview production build
```

## Tech

- [Phaser 3](https://phaser.io/) (WebGL)
- TypeScript
- Vite
- Web Audio API (synthesized sounds, no audio files)
