import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './game/scenes/BootScene';
import { TitleScene } from './game/scenes/TitleScene';
import { ControllerScene } from './game/scenes/ControllerScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { ChefsScene } from './game/scenes/ChefsScene';
import { GameScene } from './game/scenes/GameScene';
import { ResultsScene } from './game/scenes/ResultsScene';
import { installPlayNotes } from './game/playnotes';

// Owned by the integrator. Scenes register here in flow order.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1210',
  transparent: true, // the 3D kitchen renders on a canvas behind this one
  pixelArt: false,
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true, keyboard: true },
  scene: [BootScene, TitleScene, ControllerScene, SettingsScene, ChefsScene, GameScene, ResultsScene],
});

// Bug / idea reporter on every screen (F8 or the corner button).
installPlayNotes(game);
