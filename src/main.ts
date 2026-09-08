import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './game/scenes/BootScene';
import { TitleScene } from './game/scenes/TitleScene';
import { ControllerScene } from './game/scenes/ControllerScene';
import { GameScene } from './game/scenes/GameScene';
import { ResultsScene } from './game/scenes/ResultsScene';

// Owned by the integrator. Scenes register here in flow order.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1210',
  pixelArt: false,
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true, keyboard: true },
  scene: [BootScene, TitleScene, ControllerScene, GameScene, ResultsScene],
});
