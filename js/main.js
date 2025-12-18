/*
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

// Initialize the game
window.onload = () => {
    if (typeof window.IntroScene === 'undefined' || typeof window.GameScene === 'undefined') {
        console.error('Scenes not loaded!');
        return;
    }

    const config = {
        type: Phaser.AUTO,
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: 'game-container',
            width: 1280,
            height: 720
        },
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 500 },
                debug: false
            }
        },
        backgroundColor: '#1a1a2e',
        scene: [window.IntroScene, window.GameScene]
    };

    const game = new Phaser.Game(config);
};

console.log('World War Tanks initialized');
console.log('Resolution: Dynamic (Resize)');
console.log('Physics: Arcade with Y-gravity (500)');
console.log('Camera: Fixed (no movement)');
console.log('Scene Flow: IntroScene → GameScene');
