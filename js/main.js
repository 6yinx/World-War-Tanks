/**
 * World War Tanks - Main Game Configuration
 * 
 * Phase 0: Project Setup (Foundation)
 * - Engine: Phaser 3 (Web, JS)
 * - Fixed resolution: 1280x720
 * - Locked camera (no movement)
 * - Physics: Arcade Physics enabled
 * - Gravity: Y-axis only
 * 
 * Phase 2: Intro Scene
 * - IntroScene plays first
 * - Logo, story, conflict demo, start screen
 * - Transitions to GameScene
 */

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#1a1a2e', // Dark background for intro
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 500 }, // Y-axis gravity for projectile arcs
            debug: false // Disabled for cleaner visuals
        }
    },
    scene: [IntroScene, GameScene], // IntroScene starts first
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Initialize the game
const game = new Phaser.Game(config);

console.log('World War Tanks initialized');
console.log('Resolution: 1280x720');
console.log('Physics: Arcade with Y-gravity (500)');
console.log('Camera: Fixed (no movement)');
console.log('Scene Flow: IntroScene → GameScene');
