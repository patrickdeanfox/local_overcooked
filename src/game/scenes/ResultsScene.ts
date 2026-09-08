import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE } from '../../config';

export interface ResultsSceneData { levelId: string; score: number; stars: number; }

// STUB: presentation agent replaces this.
export class ResultsScene extends Phaser.Scene {
  constructor() { super(SCENE.RESULTS); }
  create(data: ResultsSceneData): void {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Level ${data.levelId}\nScore ${data.score}  Stars ${data.stars}\nSpace: title`, { fontSize: '32px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    this.input.keyboard?.once('keydown-SPACE', () => this.scene.start(SCENE.TITLE));
  }
}
