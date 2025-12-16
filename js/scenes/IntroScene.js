/**
 * IntroScene - Game Introduction Sequence
 * 
 * Phase 2: Intro Scene (01-intro.txt)
 * - Logo screen with fade-in animation
 * - Story setup with typewriter effect
 * - Tank conflict visual demo
 * - Start Game screen with call-to-action
 * - Skippable at any time (click anywhere)
 * 
 * Total duration: ~10-15 seconds (skippable)
 */

window.IntroScene = class IntroScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IntroScene' });

        // Intro state
        this.currentPhase = 0; // 0: logo, 1: story, 2: conflict, 3: start
        this.isTransitioning = false;
        this.skipText = null;

        // Story text
        this.storyLines = [
            '"In a world where gravity is unstable,',
            'tanks no longer roll...',
            'They fly.',
            'And they fight for dominance."'
        ];
        this.currentLineIndex = 0;
        this.currentCharIndex = 0;
        this.typewriterTimer = null;

        // Demo tank references
        this.demoTankA = null;
        this.demoTankB = null;
        this.demoProjectile = null;
    }

    preload() {
        console.log('IntroScene: Preloading assets...');
        // No external assets - using graphics primitives
    }

    create() {
        console.log('IntroScene: Creating intro sequence...');

        // Create static battlefield silhouette background
        this.createBackground();

        // Create skip text (always visible)
        this.skipText = this.add.text(640, 680, 'Click anywhere to skip', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#ffffff',
            alpha: 0.6
        }).setOrigin(0.5).setDepth(100);

        // Pulse animation for skip text
        this.tweens.add({
            targets: this.skipText,
            alpha: { from: 0.3, to: 0.8 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // Setup skip input
        this.input.on('pointerdown', this.onSkip, this);
        this.input.keyboard.on('keydown', this.onSkip, this);

        // Start with logo phase
        this.showLogoPhase();
    }

    createBackground() {
        // Dark battlefield silhouette background
        const bg = this.add.graphics();

        // Dark sky gradient
        bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x2d2d44, 0x2d2d44);
        bg.fillRect(0, 0, 1280, 720);

        // Distant mountains silhouette
        bg.fillStyle(0x15152a);
        bg.beginPath();
        bg.moveTo(0, 600);
        bg.lineTo(100, 520);
        bg.lineTo(200, 560);
        bg.lineTo(350, 480);
        bg.lineTo(500, 540);
        bg.lineTo(650, 450);
        bg.lineTo(800, 520);
        bg.lineTo(950, 470);
        bg.lineTo(1100, 530);
        bg.lineTo(1200, 490);
        bg.lineTo(1280, 520);
        bg.lineTo(1280, 720);
        bg.lineTo(0, 720);
        bg.closePath();
        bg.fillPath();

        // Ground silhouette
        bg.fillStyle(0x0d0d1a);
        bg.fillRect(0, 600, 1280, 120);

        // Add some stars
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, 1280);
            const y = Phaser.Math.Between(0, 400);
            const size = Phaser.Math.FloatBetween(1, 3);
            const alpha = Phaser.Math.FloatBetween(0.3, 1);

            const star = this.add.circle(x, y, size, 0xffffff, alpha);

            // Twinkle animation
            this.tweens.add({
                targets: star,
                alpha: { from: alpha * 0.3, to: alpha },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000)
            });
        }
    }

    // ==========================================
    // PHASE 0: Logo Screen
    // ==========================================
    showLogoPhase() {
        this.currentPhase = 0;
        console.log('IntroScene: Phase 0 - Logo');

        // Create logo container
        this.logoContainer = this.add.container(640, 300);

        // Game title with glow effect
        const titleGlow = this.add.text(0, 0, 'WORLD WAR TANKS', {
            fontSize: '72px',
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: '#ff6600',
            stroke: '#ff3300',
            strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0.5);

        const title = this.add.text(0, 0, 'WORLD WAR TANKS', {
            fontSize: '72px',
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: '#ffcc00',
            stroke: '#ff6600',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Subtitle
        const subtitle = this.add.text(0, 60, 'The Antigravity Conflict', {
            fontSize: '24px',
            fontFamily: 'Georgia, serif',
            color: '#88ccff',
            fontStyle: 'italic'
        }).setOrigin(0.5).setAlpha(0);

        // Tank silhouettes
        const tankLeftSil = this.createTankSilhouette(-250, 150, true);
        const tankRightSil = this.createTankSilhouette(250, 150, false);

        this.logoContainer.add([titleGlow, title, subtitle, tankLeftSil, tankRightSil]);
        this.logoContainer.setAlpha(0);

        // Glow pulse animation
        this.tweens.add({
            targets: titleGlow,
            scaleX: { from: 1, to: 1.02 },
            scaleY: { from: 1, to: 1.02 },
            alpha: { from: 0.3, to: 0.7 },
            duration: 1500,
            yoyo: true,
            repeat: -1
        });

        // Fade in logo
        this.tweens.add({
            targets: this.logoContainer,
            alpha: { from: 0, to: 1 },
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                // Fade in subtitle
                this.tweens.add({
                    targets: subtitle,
                    alpha: { from: 0, to: 1 },
                    duration: 800
                });
            }
        });

        // Soft engine hum sound effect (visual representation - particles)
        this.createEngineParticles();

        // Auto-advance after 4 seconds
        this.time.delayedCall(4000, () => {
            if (this.currentPhase === 0) {
                this.transitionToPhase(1);
            }
        });
    }

    createTankSilhouette(x, y, facingRight) {
        const tank = this.add.graphics();
        const flip = facingRight ? 1 : -1;

        tank.fillStyle(0x333344);
        // Body
        tank.fillRoundedRect(-40, -15, 80, 30, 5);
        // Turret
        tank.fillCircle(0, -15, 15);
        // Barrel
        tank.fillRect(flip > 0 ? 0 : -40, -18, 40, 6);
        // Treads
        tank.fillRect(-42, 15, 84, 10);

        tank.x = x;
        tank.y = y;

        return tank;
    }

    createEngineParticles() {
        // Create subtle floating particles for atmosphere
        for (let i = 0; i < 20; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, 1280),
                Phaser.Math.Between(400, 600),
                Phaser.Math.Between(1, 3),
                0xff6600,
                Phaser.Math.FloatBetween(0.1, 0.3)
            );

            this.tweens.add({
                targets: particle,
                y: particle.y - 100,
                alpha: 0,
                duration: Phaser.Math.Between(2000, 4000),
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000)
            });
        }
    }

    // ==========================================
    // PHASE 1: Story Setup Screen
    // ==========================================
    showStoryPhase() {
        this.currentPhase = 1;
        console.log('IntroScene: Phase 1 - Story');

        // Fade out logo
        if (this.logoContainer) {
            this.tweens.add({
                targets: this.logoContainer,
                alpha: 0,
                duration: 500,
                onComplete: () => this.logoContainer.destroy()
            });
        }

        // Create story container
        this.storyContainer = this.add.container(640, 300);
        this.storyContainer.setAlpha(0);

        // Story text elements
        this.storyTextObjects = [];

        for (let i = 0; i < this.storyLines.length; i++) {
            const lineText = this.add.text(0, i * 50, '', {
                fontSize: '28px',
                fontFamily: 'Georgia, serif',
                color: '#ffffff',
                fontStyle: 'italic'
            }).setOrigin(0.5);

            this.storyTextObjects.push(lineText);
            this.storyContainer.add(lineText);
        }

        // Fade in container
        this.tweens.add({
            targets: this.storyContainer,
            alpha: 1,
            duration: 500,
            onComplete: () => {
                // Start typewriter effect
                this.startTypewriter();
            }
        });
    }

    startTypewriter() {
        this.currentLineIndex = 0;
        this.currentCharIndex = 0;

        this.typewriterTimer = this.time.addEvent({
            delay: 50, // Speed of typewriter
            callback: this.typeNextChar,
            callbackScope: this,
            loop: true
        });
    }

    typeNextChar() {
        if (this.currentLineIndex >= this.storyLines.length) {
            // All lines complete
            this.typewriterTimer.destroy();

            // Wait then advance
            this.time.delayedCall(2000, () => {
                if (this.currentPhase === 1) {
                    this.transitionToPhase(2);
                }
            });
            return;
        }

        const currentLine = this.storyLines[this.currentLineIndex];
        const textObject = this.storyTextObjects[this.currentLineIndex];

        if (this.currentCharIndex < currentLine.length) {
            textObject.setText(currentLine.substring(0, this.currentCharIndex + 1));
            this.currentCharIndex++;
        } else {
            // Line complete, move to next
            this.currentLineIndex++;
            this.currentCharIndex = 0;

            // Small pause between lines
            this.typewriterTimer.paused = true;
            this.time.delayedCall(300, () => {
                if (this.typewriterTimer) {
                    this.typewriterTimer.paused = false;
                }
            });
        }
    }

    // ==========================================
    // PHASE 2: Conflict Visual Screen
    // ==========================================
    showConflictPhase() {
        this.currentPhase = 2;
        console.log('IntroScene: Phase 2 - Conflict Demo');

        // Clear story
        if (this.storyContainer) {
            this.tweens.add({
                targets: this.storyContainer,
                alpha: 0,
                duration: 500,
                onComplete: () => this.storyContainer.destroy()
            });
        }

        // Create demo tanks
        this.time.delayedCall(600, () => {
            this.createDemoTanks();
        });
    }

    createDemoTanks() {
        // Demo Tank A (left)
        this.demoTankA = this.createDemoTank(200, 530, 0x556B2F, true);
        this.demoTankA.container.setAlpha(0);

        // Demo Tank B (right)
        this.demoTankB = this.createDemoTank(1080, 530, 0x8B7355, false);
        this.demoTankB.container.setAlpha(0);

        // "VS" text
        this.vsText = this.add.text(640, 400, 'VS', {
            fontSize: '64px',
            fontFamily: 'Impact, Arial Black',
            color: '#ff4400',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0);

        // Animate tanks appearing
        this.tweens.add({
            targets: this.demoTankA.container,
            alpha: 1,
            x: { from: -100, to: 200 },
            duration: 800,
            ease: 'Power2'
        });

        this.tweens.add({
            targets: this.demoTankB.container,
            alpha: 1,
            x: { from: 1380, to: 1080 },
            duration: 800,
            ease: 'Power2'
        });

        // Show VS
        this.time.delayedCall(900, () => {
            this.tweens.add({
                targets: this.vsText,
                alpha: 1,
                scale: { from: 2, to: 1 },
                duration: 300,
                ease: 'Back.out'
            });
        });

        // Fire demo shot
        this.time.delayedCall(1500, () => {
            this.fireDemoShot();
        });
    }

    createDemoTank(x, y, color, facingRight) {
        const container = this.add.container(x, y);

        // Tank body
        const body = this.add.rectangle(0, 0, 80, 35, color);
        body.setStrokeStyle(2, 0x000000);

        // Turret
        const turret = this.add.circle(0, -15, 15, color);
        turret.setStrokeStyle(2, 0x000000);

        // Barrel
        const barrel = this.add.rectangle(facingRight ? 25 : -25, -15, 40, 8, 0x333333);
        barrel.setStrokeStyle(1, 0x000000);
        barrel.setOrigin(0, 0.5);
        if (facingRight) {
            barrel.setAngle(-30);
        } else {
            barrel.setAngle(-150);
        }

        // Treads
        const treads = this.add.rectangle(0, 18, 85, 10, 0x222222);
        treads.setStrokeStyle(1, 0x000000);

        container.add([treads, body, turret, barrel]);

        return { container, body, turret, barrel };
    }

    fireDemoShot() {
        // Create projectile from Tank A
        const startX = 240;
        const startY = 500;

        this.demoProjectile = this.add.circle(startX, startY, 10, 0x333333);
        this.demoProjectile.setStrokeStyle(2, 0x000000);

        // Animate projectile in arc
        const endX = 1050;
        const endY = 530;
        const peakY = 200;

        // Create trail effect
        this.projectileTrail = [];

        this.tweens.add({
            targets: this.demoProjectile,
            x: endX,
            duration: 1500,
            ease: 'Linear',
            onUpdate: () => {
                // Create trail dot
                const trailDot = this.add.circle(
                    this.demoProjectile.x,
                    this.demoProjectile.y,
                    5,
                    0x666666,
                    0.5
                );
                this.projectileTrail.push(trailDot);

                // Fade out trail
                this.tweens.add({
                    targets: trailDot,
                    alpha: 0,
                    scale: 0.5,
                    duration: 300,
                    onComplete: () => trailDot.destroy()
                });
            }
        });

        // Parabolic Y movement
        this.tweens.add({
            targets: this.demoProjectile,
            y: peakY,
            duration: 750,
            ease: 'Sine.out',
            yoyo: true,
            onComplete: () => {
                // Create explosion on impact
                this.createDemoExplosion(endX, endY);
            }
        });
    }

    createDemoExplosion(x, y) {
        // Destroy projectile
        if (this.demoProjectile) {
            this.demoProjectile.destroy();
        }

        // Create big explosion
        const explosion = this.add.circle(x, y, 50, 0xff4400, 0.9);
        explosion.setStrokeStyle(4, 0xff0000);

        const innerExplosion = this.add.circle(x, y, 25, 0xffff00, 1);

        // Screen shake
        this.cameras.main.shake(200, 0.02);

        // Flash Tank B
        if (this.demoTankB) {
            this.demoTankB.body.setFillStyle(0xff0000);
            this.time.delayedCall(200, () => {
                if (this.demoTankB) {
                    this.demoTankB.body.setFillStyle(0x8B7355);
                }
            });
        }

        // Animate explosion
        this.tweens.add({
            targets: [explosion, innerExplosion],
            scale: { from: 1, to: 3 },
            alpha: { from: 1, to: 0 },
            duration: 500,
            onComplete: () => {
                explosion.destroy();
                innerExplosion.destroy();

                // Advance to start screen
                this.time.delayedCall(500, () => {
                    if (this.currentPhase === 2) {
                        this.transitionToPhase(3);
                    }
                });
            }
        });
    }

    // ==========================================
    // PHASE 3: Start Game Screen
    // ==========================================
    showStartPhase() {
        this.currentPhase = 3;
        console.log('IntroScene: Phase 3 - Start Screen');

        // Clean up demo
        if (this.demoTankA) this.demoTankA.container.destroy();
        if (this.demoTankB) this.demoTankB.container.destroy();
        if (this.vsText) this.vsText.destroy();

        // Update skip text
        this.skipText.setText('');

        // Create start screen container
        this.startContainer = this.add.container(640, 360);
        this.startContainer.setAlpha(0);

        // Title
        const title = this.add.text(0, -120, 'WORLD WAR TANKS', {
            fontSize: '64px',
            fontFamily: 'Impact, Arial Black, sans-serif',
            color: '#ffcc00',
            stroke: '#ff6600',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Start button background
        const buttonBg = this.add.rectangle(0, 30, 280, 70, 0x336633);
        buttonBg.setStrokeStyle(4, 0x44aa44);
        buttonBg.setInteractive({ useHandCursor: true });

        // Button hover effects
        buttonBg.on('pointerover', () => {
            buttonBg.setFillStyle(0x448844);
            buttonBg.setScale(1.05);
        });
        buttonBg.on('pointerout', () => {
            buttonBg.setFillStyle(0x336633);
            buttonBg.setScale(1);
        });
        buttonBg.on('pointerdown', () => {
            this.startGame();
        });

        // Start button text
        const buttonText = this.add.text(0, 30, '⚔️ START BATTLE ⚔️', {
            fontSize: '28px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Controls hint
        const hint = this.add.text(0, 130, 'Click and drag to aim. Release to fire.', {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#aaaaaa',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Decorative tanks
        const leftTank = this.createTankSilhouette(-300, 80, true);
        const rightTank = this.createTankSilhouette(300, 80, false);

        this.startContainer.add([leftTank, rightTank, title, buttonBg, buttonText, hint]);

        // Fade in
        this.tweens.add({
            targets: this.startContainer,
            alpha: 1,
            duration: 500
        });

        // Button pulse effect
        this.tweens.add({
            targets: buttonBg,
            scaleX: { from: 1, to: 1.02 },
            scaleY: { from: 1, to: 1.02 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        // Also allow clicking anywhere to start (after button is shown)
        this.time.delayedCall(500, () => {
            // Only process start on direct click (not on button)
            this.input.off('pointerdown', this.onSkip, this);
        });
    }

    // ==========================================
    // Transition Functions
    // ==========================================
    transitionToPhase(phase) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        // Brief transition delay
        this.time.delayedCall(100, () => {
            this.isTransitioning = false;

            switch (phase) {
                case 1:
                    this.showStoryPhase();
                    break;
                case 2:
                    this.showConflictPhase();
                    break;
                case 3:
                    this.showStartPhase();
                    break;
            }
        });
    }

    onSkip() {
        // Skip to start screen
        if (this.currentPhase < 3) {
            console.log('IntroScene: Skipping to start screen');

            // Clean up current phase
            if (this.typewriterTimer) {
                this.typewriterTimer.destroy();
                this.typewriterTimer = null;
            }

            // Clear all animations and go to start
            this.tweens.killAll();

            // Clean up elements
            if (this.logoContainer) this.logoContainer.destroy();
            if (this.storyContainer) this.storyContainer.destroy();
            if (this.demoTankA) this.demoTankA.container.destroy();
            if (this.demoTankB) this.demoTankB.container.destroy();
            if (this.vsText) this.vsText.destroy();
            if (this.demoProjectile) this.demoProjectile.destroy();

            // Recreate background (tweens were killed)
            this.children.removeAll();
            this.createBackground();

            // Recreate skip text
            this.skipText = this.add.text(640, 680, '', {
                fontSize: '16px',
                fontFamily: 'Arial',
                color: '#ffffff'
            }).setOrigin(0.5).setDepth(100);

            this.showStartPhase();
        }
    }

    startGame() {
        console.log('IntroScene: Starting game!');

        // Quick flash transition
        const flash = this.add.rectangle(640, 360, 1280, 720, 0xFFFFFF, 0);
        flash.setDepth(1000);

        this.tweens.add({
            targets: flash,
            alpha: { from: 0, to: 1 },
            duration: 200,
            yoyo: true,
            onComplete: () => {
                // Direct scene transition - no camera fade
                this.scene.start('GameScene');
            }
        });
    }
}
