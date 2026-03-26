/**
 * CampaignScene — chapter select with star progression.
 * Players navigate chapters and levels, see briefing, and launch matches.
 */

import Phaser from 'phaser';
import {
  LEVELS, CHAPTER_INFO, type LevelDef,
} from '../campaign/levels';
import {
  loadSave, writeSave, isLevelUnlocked, getTotalStars,
} from '../campaign/save';
import type { CampaignSave } from '../campaign/save';
import { buildGameConfig } from '../config';
import { AudioManager } from '../audio/AudioManager';

export class CampaignScene extends Phaser.Scene {
  private audio!: AudioManager;
  private save!: CampaignSave;
  private els: Phaser.GameObjects.GameObject[] = [];

  // Scroll
  private scrollY = 0;
  private maxScroll = 0;

  constructor() {
    super({ key: 'CampaignScene' });
  }

  init(): void {
    this.save = loadSave();
    this.audio = new AudioManager();
    this.scrollY = 0;
    this.els = [];
  }

  create(): void {
    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x08080e, 1);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    for (let i = 0; i < 200; i++) {
      bg.fillStyle(0x12121e, 0.15 + Math.random() * 0.15);
      bg.fillRect(Math.floor(Math.random() * this.scale.width), Math.floor(Math.random() * this.scale.height), 1, 1);
    }

    this.buildUI();

    // Scroll with mouse wheel
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gOs: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScroll);
      this.container.y = -this.scrollY;
    });

    // Keyboard
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('MenuScene'));
  }

  private container!: Phaser.GameObjects.Container;

  private buildUI(): void {
    const W = this.scale.width;
    const cx = W / 2;

    // Header
    this.add.text(cx, 30, 'CAMPAIGN', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffd700', fontStyle: 'bold', letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10);

    // Stats bar
    const totalStars = getTotalStars(this.save);
    const maxStars = LEVELS.length * 3;
    this.add.text(cx, 60, `★ ${totalStars} / ${maxStars}   |   Level ${this.save.playerLevel}   |   ${this.save.totalXP} XP`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#555577',
    }).setOrigin(0.5).setDepth(10);

    // Back button
    const backBtn = this.add.text(60, 30, '← BACK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#8888aa',
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#ccccdd'));
    backBtn.on('pointerout', () => backBtn.setColor('#8888aa'));
    backBtn.on('pointerdown', () => { this.audio.playMenuClick(); this.scene.start('MenuScene'); });

    // Scrollable container
    this.container = this.add.container(0, 85);
    this.els = [];

    let y = 0;

    for (let ch = 1; ch <= 5; ch++) {
      const info = CHAPTER_INFO[ch];
      const levels = LEVELS.filter(l => l.chapter === ch);

      // Chapter header
      y += 10;
      const chapterLabel = `${ch}. ${info.name}`;
      const chColor = '#' + info.color.toString(16).padStart(6, '0');

      this.container.add(this.add.text(40, y, chapterLabel, {
        fontFamily: 'monospace', fontSize: '18px', color: chColor, fontStyle: 'bold',
      }));

      this.container.add(this.add.text(W - 40, y, info.subtitle, {
        fontFamily: 'monospace', fontSize: '12px', color: '#444466',
      }).setOrigin(1, 0));

      y += 30;

      // Separator
      const sep = this.add.graphics();
      sep.lineStyle(1, info.color, 0.15);
      sep.lineBetween(40, y, W - 40, y);
      this.container.add(sep);
      y += 15;

      // Level cards
      for (const level of levels) {
        const unlocked = isLevelUnlocked(level.id, this.save);
        const levelData = this.save.levels[level.id];
        const stars = levelData?.stars ?? 0;

        const cardW = W - 80;
        const cardH = 64;
        const cardX = 40;
        const cardY = y;

        // Card background
        const card = this.add.graphics();
        if (unlocked) {
          card.fillStyle(0x12122a, 0.7);
        } else {
          card.fillStyle(0x0c0c18, 0.5);
        }
        card.fillRoundedRect(cardX, cardY, cardW, cardH, 8);
        card.lineStyle(1, unlocked ? 0x333366 : 0x1a1a2a, 0.3);
        card.strokeRoundedRect(cardX, cardY, cardW, cardH, 8);
        this.container.add(card);

        // Lock icon
        if (!unlocked) {
          this.container.add(this.add.text(cardX + 20, cardY + cardH / 2, '🔒', {
            fontSize: '18px',
          }).setOrigin(0.5));
        } else {
          // Level number
          this.container.add(this.add.text(cardX + 20, cardY + cardH / 2, level.id, {
            fontFamily: 'monospace', fontSize: '14px', color: '#555577',
          }).setOrigin(0.5));
        }

        // Level name
        const nameColor = unlocked ? (stars === 3 ? '#ffd700' : '#ccccdd') : '#555577';
        this.container.add(this.add.text(cardX + 70, cardY + 16, level.name, {
          fontFamily: 'monospace', fontSize: '16px', color: nameColor, fontStyle: 'bold',
        }));

        // Objective
        this.container.add(this.add.text(cardX + 70, cardY + 38, level.primary.description, {
          fontFamily: 'monospace', fontSize: '11px', color: unlocked ? '#7777aa' : '#3a3a55',
        }));

        // Best result
        if (levelData?.completed) {
          const bestInfo = `${levelData.bestPct.toFixed(0)}%`;
          if (levelData.bestTime > 0) {
            this.container.add(this.add.text(cardX + 70, cardY + 52, `Best: ${bestInfo} in ${Math.floor(levelData.bestTime)}s`, {
              fontFamily: 'monospace', fontSize: '10px', color: '#3a3a55',
            }));
          } else {
            this.container.add(this.add.text(cardX + 70, cardY + 52, `Best: ${bestInfo}`, {
              fontFamily: 'monospace', fontSize: '10px', color: '#3a3a55',
            }));
          }
        }

        // Stars display
        const starsX = cardX + cardW - 80;
        const starsY = cardY + cardH / 2;
        for (let s = 0; s < 3; s++) {
          const filled = s < stars;
          this.container.add(this.add.text(starsX + s * 22, starsY, '★', {
            fontFamily: 'monospace', fontSize: '18px',
            color: filled ? '#ffd700' : '#2a2a3a',
          }).setOrigin(0.5));
        }

        // Interactive zone (only if unlocked)
        if (unlocked) {
          const zone = this.add.zone(cardX + cardW / 2, cardY + cardH / 2, cardW, cardH)
            .setInteractive({ useHandCursor: true });
          this.container.add(zone);

          const hoverCard = card;
          zone.on('pointerover', () => {
            hoverCard.clear();
            hoverCard.fillStyle(0x1e1e3a, 0.8);
            hoverCard.fillRoundedRect(cardX, cardY, cardW, cardH, 8);
            hoverCard.lineStyle(1, 0x4a4a88, 0.4);
            hoverCard.strokeRoundedRect(cardX, cardY, cardW, cardH, 8);
          });
          zone.on('pointerout', () => {
            hoverCard.clear();
            hoverCard.fillStyle(0x12122a, 0.7);
            hoverCard.fillRoundedRect(cardX, cardY, cardW, cardH, 8);
            hoverCard.lineStyle(1, 0x333366, 0.3);
            hoverCard.strokeRoundedRect(cardX, cardY, cardW, cardH, 8);
          });
          zone.on('pointerdown', () => {
            this.audio.playMenuClick();
            this.startLevel(level);
          });
        }

        y += cardH + 8;
      }

      y += 10;
    }

    this.maxScroll = Math.max(0, y - (this.scale.height - 100));
  }

  private startLevel(level: LevelDef): void {
    const config = buildGameConfig(
      level.difficulty, level.mapKey, level.matchDuration, level.mapTemplate, level.mapSeed,
    );
    config._levelId = level.id;
    this.scene.start('GameScene', { config, levelId: level.id });
  }
}
