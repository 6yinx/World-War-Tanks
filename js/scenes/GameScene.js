/**
 * GameScene - Main gameplay scene
 * 
 * Phase 1: Core Gameplay ✓
 * Phase 3: UI (Turn indicator, Health bars, Restart button, Win UI)
 * Phase 4: Art & Visuals (Tank art, Visual feedback, Explosions)
 * Phase 5: Polish (Optimized, clean, mobile-ready)
 */

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init() {
        // Reset all game state on scene start/restart
        this.tanks = [];
        this.currentPlayerIndex = 0;
        this.projectile = null;
        this.isAiming = false;
        this.canShoot = true;
        this.gameOver = false;
        this.currentPower = 0;

        // Smooth aiming variables
        this.targetAngle = 0;
        this.currentAngle = 0;
        this.targetPower = 0;
        this.smoothPower = 0;
        this.aimLerpSpeed = 0.15; // Smoothing factor

        // Constants - Increased max power for longer shots
        this.TANK_HEALTH = 100;
        this.MAX_POWER = 1200;  // Increased from 800
        this.MIN_POWER = 150;   // Increased minimum too
        this.POWER_MULTIPLIER = 4; // Higher multiplier for distance
        this.DIRECT_HIT_DAMAGE = 35;
        this.NEAR_HIT_DAMAGE = 15;
        this.NEAR_HIT_RADIUS = 80;

        // Initialize audio context for sound effects
        this.initAudio();
    }

    create() {
        // Create environment first
        this.createEnvironment();

        // Create tanks
        this.createTanks();

        // Create UI elements (Phase 3)
        this.createUI();

        // Create aim line graphics
        this.aimLine = this.add.graphics().setDepth(50);

        // Create smooth aim indicator
        this.aimIndicator = this.add.graphics().setDepth(49);

        // Setup input
        this.setupInput();

        // Update UI
        this.updateActiveTank();
        this.updateTurnIndicator();
    }

    // ==========================================
    // AUDIO SYSTEM
    // ==========================================
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
            this.audioContext = null;
        }
    }

    playExplosionSound(isDirect) {
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Create nodes
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Create noise buffer for explosion
        const bufferSize = ctx.sampleRate * 0.5;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        // Filter settings for explosion rumble
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isDirect ? 800 : 500, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

        // Gain envelope
        gainNode.gain.setValueAtTime(isDirect ? 0.8 : 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + (isDirect ? 0.5 : 0.3));

        // Add low frequency oscillator for rumble
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(isDirect ? 80 : 60, now);
        oscillator.frequency.exponentialRampToValueAtTime(20, now + 0.3);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(isDirect ? 0.4 : 0.2, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        // Connect nodes
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.connect(oscGain);
        oscGain.connect(ctx.destination);

        // Play
        noise.start(now);
        noise.stop(now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
    }

    playShootSound() {
        if (!this.audioContext) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        // Create oscillator for "thump"
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        // Add noise burst
        const bufferSize = ctx.sampleRate * 0.1;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        // Connect
        osc.connect(gain);
        gain.connect(ctx.destination);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        // Play
        osc.start(now);
        osc.stop(now + 0.15);
        noise.start(now);
        noise.stop(now + 0.1);
    }

    // ==========================================
    // ENVIRONMENT (Phase 1 + Polish)
    // ==========================================
    createEnvironment() {
        // Beautiful sky gradient
        const skyGradient = this.add.graphics();
        skyGradient.fillGradientStyle(0x4A90D9, 0x4A90D9, 0x87CEEB, 0x87CEEB);
        skyGradient.fillRect(0, 0, 1280, 640);

        // Sun
        const sun = this.add.circle(1100, 80, 50, 0xFFDD44, 0.9);
        this.add.circle(1100, 80, 45, 0xFFFF88, 0.5);

        // Clouds
        this.createCloud(150, 80);
        this.createCloud(400, 120);
        this.createCloud(700, 60);
        this.createCloud(950, 140);

        // Distant hills
        const hills = this.add.graphics();
        hills.fillStyle(0x6B8E23, 0.5);
        hills.beginPath();
        hills.moveTo(0, 640);
        hills.lineTo(200, 580);
        hills.lineTo(400, 610);
        hills.lineTo(600, 560);
        hills.lineTo(800, 600);
        hills.lineTo(1000, 550);
        hills.lineTo(1280, 590);
        hills.lineTo(1280, 640);
        hills.closePath();
        hills.fillPath();

        // Ground (grass) with texture
        const groundGradient = this.add.graphics();
        groundGradient.fillGradientStyle(0x4a7c23, 0x4a7c23, 0x3d6b1c, 0x3d6b1c);
        groundGradient.fillRect(0, 640, 1280, 80);

        // Grass line
        this.add.rectangle(640, 642, 1280, 4, 0x5d9c2f);

        // Physics ground
        this.ground = this.add.rectangle(640, 680, 1280, 80, 0x000000, 0);
        this.physics.add.existing(this.ground, true);

        // World bounds
        this.leftWall = this.add.rectangle(-10, 360, 20, 720, 0x000000, 0);
        this.physics.add.existing(this.leftWall, true);
        this.rightWall = this.add.rectangle(1290, 360, 20, 720, 0x000000, 0);
        this.physics.add.existing(this.rightWall, true);
    }

    createCloud(x, y) {
        const cloud = this.add.graphics();
        cloud.fillStyle(0xFFFFFF, 0.8);
        cloud.fillCircle(x, y, 25);
        cloud.fillCircle(x + 30, y - 5, 20);
        cloud.fillCircle(x + 50, y, 25);
        cloud.fillCircle(x + 25, y + 10, 18);
    }

    // ==========================================
    // TANKS (Phase 1 + Phase 4 Art)
    // ==========================================
    createTanks() {
        const tankA = this.createTank(200, 605, 0x4A6741, 0x5C7D52, 'Player 1', true);
        const tankB = this.createTank(1080, 605, 0x8B6914, 0xA67C00, 'Player 2', false);

        this.tanks = [tankA, tankB];
    }

    createTank(x, y, bodyColor, highlightColor, name, facingRight) {
        const tank = {
            name: name,
            health: this.TANK_HEALTH,
            maxHealth: this.TANK_HEALTH,
            isActive: false,
            bodyColor: bodyColor,
            highlightColor: highlightColor,
            facingRight: facingRight,
            pivotX: x,
            pivotY: y - 20,
            smokeEmitter: null
        };

        // Tank container for grouping
        tank.container = this.add.container(x, y);

        // Treads (bottom layer)
        tank.treads = this.add.graphics();
        tank.treads.fillStyle(0x222222);
        tank.treads.fillRoundedRect(-45, 8, 90, 16, 4);
        // Tread details
        tank.treads.fillStyle(0x333333);
        for (let i = -40; i < 40; i += 10) {
            tank.treads.fillRect(i, 10, 6, 12);
        }
        tank.container.add(tank.treads);

        // Tank body with gradient effect
        tank.bodyGraphics = this.add.graphics();
        this.drawTankBody(tank.bodyGraphics, bodyColor, highlightColor);
        tank.container.add(tank.bodyGraphics);

        // Turret base
        tank.turretBase = this.add.graphics();
        tank.turretBase.fillStyle(bodyColor);
        tank.turretBase.fillCircle(0, -15, 18);
        tank.turretBase.lineStyle(2, 0x000000);
        tank.turretBase.strokeCircle(0, -15, 18);
        tank.container.add(tank.turretBase);

        // Turret top (lighter)
        tank.turretTop = this.add.circle(0, -18, 10, highlightColor);
        tank.turretTop.setStrokeStyle(1, 0x000000);
        tank.container.add(tank.turretTop);

        // Barrel (separate from container for rotation)
        tank.barrel = this.add.graphics();
        tank.barrel.fillStyle(0x444444);
        tank.barrel.fillRoundedRect(0, -4, 45, 8, 2);
        tank.barrel.fillStyle(0x333333);
        tank.barrel.fillRect(40, -5, 8, 10);
        tank.barrel.lineStyle(1, 0x222222);
        tank.barrel.strokeRoundedRect(0, -4, 45, 8, 2);
        tank.barrel.x = x;
        tank.barrel.y = y - 20;
        tank.barrel.setDepth(10);

        // Set initial barrel angle
        tank.barrel.rotation = facingRight ? -0.5 : Math.PI + 0.5;

        // Health bar background
        tank.healthBarBg = this.add.rectangle(x, y - 55, 70, 12, 0x333333);
        tank.healthBarBg.setStrokeStyle(2, 0x000000);
        tank.healthBarBg.setDepth(100);

        // Health bar fill
        tank.healthBarFill = this.add.rectangle(x - 32, y - 55, 64, 8, 0x00FF00);
        tank.healthBarFill.setOrigin(0, 0.5);
        tank.healthBarFill.setDepth(101);

        // Health text
        tank.healthText = this.add.text(x, y - 55, '100', {
            fontSize: '10px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(102);

        // Name label
        tank.nameLabel = this.add.text(x, y - 75, name, {
            fontSize: '14px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(100);

        // Physics body (invisible, for collision)
        tank.physicsBody = this.add.rectangle(x, y, 80, 35, 0x000000, 0);
        this.physics.add.existing(tank.physicsBody, true);

        return tank;
    }

    drawTankBody(graphics, mainColor, lightColor) {
        graphics.clear();

        // Main body
        graphics.fillStyle(mainColor);
        graphics.fillRoundedRect(-40, -10, 80, 30, 5);

        // Top highlight
        graphics.fillStyle(lightColor);
        graphics.fillRoundedRect(-38, -8, 76, 12, 3);

        // Side panels
        graphics.fillStyle(mainColor);
        graphics.fillRect(-42, -5, 5, 20);
        graphics.fillRect(37, -5, 5, 20);

        // Outline
        graphics.lineStyle(2, 0x000000);
        graphics.strokeRoundedRect(-40, -10, 80, 30, 5);
    }

    // ==========================================
    // UI (Phase 3)
    // ==========================================
    createUI() {
        // Top UI bar background
        const uiBar = this.add.graphics();
        uiBar.fillStyle(0x000000, 0.6);
        uiBar.fillRoundedRect(440, 10, 400, 50, 10);
        uiBar.setDepth(200);

        // Turn indicator
        this.turnIndicator = this.add.text(640, 25, '', {
            fontSize: '20px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(201);

        // Turn indicator subtitle
        this.turnSubtext = this.add.text(640, 48, 'Click & Drag near tank to aim', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#aaaaaa'
        }).setOrigin(0.5).setDepth(201);

        // Power indicator (shown during aiming)
        this.powerIndicatorBg = this.add.rectangle(640, 75, 200, 16, 0x333333);
        this.powerIndicatorBg.setStrokeStyle(2, 0x000000);
        this.powerIndicatorBg.setDepth(200);
        this.powerIndicatorBg.setAlpha(0);

        this.powerIndicatorFill = this.add.rectangle(542, 75, 0, 12, 0xFF6600);
        this.powerIndicatorFill.setOrigin(0, 0.5);
        this.powerIndicatorFill.setDepth(201);
        this.powerIndicatorFill.setAlpha(0);

        this.powerText = this.add.text(640, 75, 'POWER', {
            fontSize: '10px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(202);
        this.powerText.setAlpha(0);

        // Restart button
        this.restartBtn = this.add.container(1220, 40);
        const restartBg = this.add.rectangle(0, 0, 80, 35, 0x663333);
        restartBg.setStrokeStyle(2, 0x994444);
        restartBg.setInteractive({ useHandCursor: true });

        const restartText = this.add.text(0, 0, '↻ Restart', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.restartBtn.add([restartBg, restartText]);
        this.restartBtn.setDepth(200);

        restartBg.on('pointerover', () => restartBg.setFillStyle(0x884444));
        restartBg.on('pointerout', () => restartBg.setFillStyle(0x663333));
        restartBg.on('pointerdown', () => this.restartGame());

        // Win overlay (hidden initially)
        this.createWinOverlay();
    }

    createWinOverlay() {
        this.winOverlay = this.add.container(640, 360);
        this.winOverlay.setDepth(500);
        this.winOverlay.setAlpha(0);

        // Dark background
        const bg = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.7);

        // Win panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1a1a2e);
        panel.fillRoundedRect(-250, -100, 500, 200, 20);
        panel.lineStyle(4, 0xFFCC00);
        panel.strokeRoundedRect(-250, -100, 500, 200, 20);

        // Win text
        this.winText = this.add.text(0, -40, '', {
            fontSize: '48px',
            fontFamily: 'Impact, Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Play again button
        const playAgainBg = this.add.rectangle(0, 50, 200, 50, 0x336633);
        playAgainBg.setStrokeStyle(3, 0x44aa44);
        playAgainBg.setInteractive({ useHandCursor: true });

        const playAgainText = this.add.text(0, 50, '🔄 Play Again', {
            fontSize: '20px',
            fontFamily: 'Arial Black',
            color: '#ffffff'
        }).setOrigin(0.5);

        playAgainBg.on('pointerover', () => playAgainBg.setFillStyle(0x448844));
        playAgainBg.on('pointerout', () => playAgainBg.setFillStyle(0x336633));
        playAgainBg.on('pointerdown', () => this.restartGame());

        this.winOverlay.add([bg, panel, this.winText, playAgainBg, playAgainText]);
    }

    updateTurnIndicator() {
        const tank = this.tanks[this.currentPlayerIndex];
        const color = this.currentPlayerIndex === 0 ? '#88FF88' : '#FFAA44';
        this.turnIndicator.setText(`⚔️ ${tank.name}'s Turn ⚔️`);
        this.turnIndicator.setColor(color);
    }

    updateHealthBar(tank) {
        const healthPercent = tank.health / tank.maxHealth;
        const barWidth = 64 * healthPercent;

        // Update fill width
        tank.healthBarFill.width = barWidth;

        // Change color based on health
        let color = 0x00FF00;
        if (healthPercent <= 0.3) color = 0xFF0000;
        else if (healthPercent <= 0.6) color = 0xFFAA00;

        tank.healthBarFill.setFillStyle(color);
        tank.healthText.setText(Math.ceil(tank.health).toString());
    }

    showPowerIndicator(power) {
        const normalizedPower = (power - this.MIN_POWER) / (this.MAX_POWER - this.MIN_POWER);
        const barWidth = 196 * normalizedPower;

        this.powerIndicatorBg.setAlpha(1);
        this.powerIndicatorFill.setAlpha(1);
        this.powerIndicatorFill.width = barWidth;
        this.powerText.setAlpha(1);
        this.powerText.setText(`POWER: ${Math.round(normalizedPower * 100)}%`);

        // Color gradient
        let color;
        if (normalizedPower < 0.5) {
            color = Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 100, g: 200, b: 100 },
                { r: 255, g: 200, b: 0 },
                100,
                normalizedPower * 200
            );
        } else {
            color = Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 255, g: 200, b: 0 },
                { r: 255, g: 50, b: 0 },
                100,
                (normalizedPower - 0.5) * 200
            );
        }
        this.powerIndicatorFill.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    }

    hidePowerIndicator() {
        this.powerIndicatorBg.setAlpha(0);
        this.powerIndicatorFill.setAlpha(0);
        this.powerText.setAlpha(0);
    }

    // ==========================================
    // INPUT & AIMING (Improved Smoothness)
    // ==========================================
    setupInput() {
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
    }

    onPointerDown(pointer) {
        if (!this.canShoot || this.gameOver) return;

        const activeTank = this.tanks[this.currentPlayerIndex];
        const distance = Phaser.Math.Distance.Between(
            pointer.x, pointer.y,
            activeTank.pivotX, activeTank.pivotY
        );

        // Allow aiming from anywhere on screen for easier control
        if (distance < 200) {
            this.isAiming = true;
            this.aimStartX = pointer.x;
            this.aimStartY = pointer.y;

            // Initialize smooth values
            this.targetAngle = activeTank.barrel.rotation;
            this.currentAngle = activeTank.barrel.rotation;
            this.targetPower = this.MIN_POWER;
            this.smoothPower = this.MIN_POWER;

            // Resume audio context on user interaction (browser requirement)
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }
    }

    onPointerMove(pointer) {
        if (!this.isAiming) return;

        const activeTank = this.tanks[this.currentPlayerIndex];

        // Calculate angle from tank to pointer (inverted for pull-back aiming)
        const angle = Phaser.Math.Angle.Between(
            activeTank.pivotX, activeTank.pivotY,
            pointer.x, pointer.y
        );

        // Calculate distance for power (with higher multiplier for longer shots)
        const distance = Phaser.Math.Distance.Between(
            activeTank.pivotX, activeTank.pivotY,
            pointer.x, pointer.y
        );

        // Use higher multiplier for more responsive power scaling
        const rawPower = distance * this.POWER_MULTIPLIER;
        this.targetPower = Phaser.Math.Clamp(rawPower, this.MIN_POWER, this.MAX_POWER);
        this.targetAngle = angle + Math.PI; // Shoot opposite to drag direction

        // Smooth interpolation for both angle and power
        this.currentAngle = Phaser.Math.Linear(this.currentAngle, this.targetAngle, this.aimLerpSpeed);
        this.smoothPower = Phaser.Math.Linear(this.smoothPower, this.targetPower, this.aimLerpSpeed * 1.5);

        // Apply smoothed values
        activeTank.barrel.rotation = this.currentAngle;
        this.currentPower = this.smoothPower;

        // Draw aim visualization
        this.drawAimLine(activeTank, this.currentAngle, this.smoothPower);
        this.drawPullBackIndicator(activeTank, pointer);
        this.showPowerIndicator(this.smoothPower);
    }

    drawPullBackIndicator(tank, pointer) {
        this.aimIndicator.clear();

        // Draw rubber band pull-back line
        this.aimIndicator.lineStyle(3, 0xFF6600, 0.4);
        this.aimIndicator.beginPath();
        this.aimIndicator.moveTo(tank.pivotX, tank.pivotY);
        this.aimIndicator.lineTo(pointer.x, pointer.y);
        this.aimIndicator.strokePath();

        // Draw drag handle circle
        const handleSize = 12 + (this.smoothPower / this.MAX_POWER) * 8;
        this.aimIndicator.fillStyle(0xFF4400, 0.6);
        this.aimIndicator.fillCircle(pointer.x, pointer.y, handleSize);
        this.aimIndicator.lineStyle(2, 0xFFFFFF, 0.8);
        this.aimIndicator.strokeCircle(pointer.x, pointer.y, handleSize);
    }

    drawAimLine(tank, angle, power) {
        this.aimLine.clear();

        const numDots = 20; // More dots for longer trajectory preview
        const gravity = 500;
        const velocityX = Math.cos(angle) * power;
        const velocityY = Math.sin(angle) * power;

        // Trajectory dots with gradient - extended time for longer shots
        for (let i = 1; i <= numDots; i++) {
            const t = i * 0.05; // Smaller time steps for smoother curve
            const dotX = tank.pivotX + velocityX * t;
            const dotY = tank.pivotY + velocityY * t + 0.5 * gravity * t * t;

            // Don't draw dots below ground
            if (dotY > 640) break;

            const alpha = 1 - (i / numDots) * 0.8;
            const size = 7 - (i / numDots) * 4;

            // Color gradient from yellow to red based on position
            const colorLerp = i / numDots;
            const r = 255;
            const g = Math.floor(255 * (1 - colorLerp * 0.7));
            const b = 0;

            this.aimLine.fillStyle(Phaser.Display.Color.GetColor(r, g, b), alpha);
            this.aimLine.fillCircle(dotX, dotY, size);
        }

        // Power line from barrel tip
        const lineLength = power / 6; // Longer line for better visibility
        const startDist = 50;
        const startX = tank.pivotX + Math.cos(angle) * startDist;
        const startY = tank.pivotY + Math.sin(angle) * startDist;
        const endX = tank.pivotX + Math.cos(angle) * lineLength;
        const endY = tank.pivotY + Math.sin(angle) * lineLength;

        // Gradient line
        this.aimLine.lineStyle(5, 0xFF2200, 0.9);
        this.aimLine.beginPath();
        this.aimLine.moveTo(startX, startY);
        this.aimLine.lineTo(endX, endY);
        this.aimLine.strokePath();
    }

    onPointerUp(pointer) {
        if (!this.isAiming) return;

        this.isAiming = false;
        this.aimLine.clear();
        this.aimIndicator.clear(); // Clear the pull-back indicator
        this.hidePowerIndicator();

        const activeTank = this.tanks[this.currentPlayerIndex];

        // Use the smoothed values for more consistent feel
        const finalPower = this.smoothPower;
        const finalAngle = this.currentAngle;

        // Only fire if there's enough power
        if (finalPower > this.MIN_POWER + 20) {
            this.fireProjectile(activeTank, finalAngle, finalPower);
        }
    }

    // ==========================================
    // SHOOTING & PROJECTILE
    // ==========================================
    fireProjectile(tank, angle, power) {
        if (this.projectile) return;
        this.canShoot = false;

        // Play shooting sound
        this.playShootSound();

        // Recoil animation (Phase 4)
        this.tweens.add({
            targets: tank.container,
            x: tank.container.x - Math.cos(angle) * 8,
            duration: 50,
            yoyo: true,
            ease: 'Power2'
        });

        // Muzzle flash
        const flashX = tank.pivotX + Math.cos(angle) * 50;
        const flashY = tank.pivotY + Math.sin(angle) * 50;
        this.createMuzzleFlash(flashX, flashY);

        // Spawn projectile
        const spawnX = tank.pivotX + Math.cos(angle) * 55;
        const spawnY = tank.pivotY + Math.sin(angle) * 55;

        this.projectile = this.add.circle(spawnX, spawnY, 8, 0x333333);
        this.projectile.setStrokeStyle(2, 0x111111);
        this.projectile.setDepth(40);
        this.physics.add.existing(this.projectile);

        const velocityX = Math.cos(angle) * power;
        const velocityY = Math.sin(angle) * power;
        this.projectile.body.setVelocity(velocityX, velocityY);
        this.projectile.body.setCollideWorldBounds(false);
        this.projectile.shooter = this.currentPlayerIndex;

        // Trail effect
        this.projectileTrail = [];

        this.setupProjectileCollisions();
    }

    createMuzzleFlash(x, y) {
        const flash = this.add.circle(x, y, 20, 0xFFFF00, 1);
        flash.setDepth(45);

        this.tweens.add({
            targets: flash,
            scale: { from: 1, to: 2 },
            alpha: { from: 1, to: 0 },
            duration: 100,
            onComplete: () => flash.destroy()
        });
    }

    setupProjectileCollisions() {
        this.physics.add.collider(this.projectile, this.ground, () => {
            this.onProjectileHitGround();
        });

        this.tanks.forEach((tank, index) => {
            this.physics.add.overlap(this.projectile, tank.physicsBody, () => {
                this.onProjectileHitTank(index);
            });
        });

        this.physics.add.collider(this.projectile, this.leftWall, () => {
            this.onProjectileHitGround();
        });
        this.physics.add.collider(this.projectile, this.rightWall, () => {
            this.onProjectileHitGround();
        });
    }

    // ==========================================
    // COLLISION & DAMAGE
    // ==========================================
    onProjectileHitGround() {
        if (!this.projectile) return;

        this.createExplosion(this.projectile.x, this.projectile.y, false);
        this.checkNearHits(this.projectile.x, this.projectile.y);
        this.destroyProjectile();
        this.switchTurn();
    }

    onProjectileHitTank(tankIndex) {
        if (!this.projectile) return;

        const hitTank = this.tanks[tankIndex];
        this.applyDamage(tankIndex, this.DIRECT_HIT_DAMAGE);
        this.createExplosion(this.projectile.x, this.projectile.y, true);
        this.flashTank(hitTank);
        this.destroyProjectile();

        if (hitTank.health <= 0) {
            this.onTankDestroyed(tankIndex);
        } else {
            this.switchTurn();
        }
    }

    checkNearHits(x, y) {
        this.tanks.forEach((tank, index) => {
            if (index === this.projectile.shooter) return;

            const distance = Phaser.Math.Distance.Between(x, y, tank.pivotX, tank.pivotY);

            if (distance <= this.NEAR_HIT_RADIUS) {
                this.applyDamage(index, this.NEAR_HIT_DAMAGE);
                this.flashTank(tank, 0xFFAA00);

                if (tank.health <= 0) {
                    this.onTankDestroyed(index);
                }
            }
        });
    }

    applyDamage(tankIndex, damage) {
        const tank = this.tanks[tankIndex];
        tank.health = Math.max(0, tank.health - damage);
        this.updateHealthBar(tank);

        // Low health smoke effect (Phase 4)
        if (tank.health <= 30 && tank.health > 0 && !tank.smoking) {
            tank.smoking = true;
            this.createSmokeEffect(tank);
        }
    }

    flashTank(tank, color = 0xFF0000) {
        // Flash effect
        this.tweens.add({
            targets: [tank.container],
            alpha: { from: 0.5, to: 1 },
            duration: 100,
            yoyo: true,
            repeat: 2
        });

        // Tint effect via graphics redraw
        this.drawTankBody(tank.bodyGraphics, color, 0xFFFFFF);

        this.time.delayedCall(200, () => {
            if (tank.health > 0) {
                this.drawTankBody(tank.bodyGraphics,
                    tank.health <= 30 ? 0x660000 : tank.bodyColor,
                    tank.health <= 30 ? 0x880000 : tank.highlightColor
                );
            }
        });
    }

    createSmokeEffect(tank) {
        // Create smoke particles
        const createSmoke = () => {
            if (tank.health <= 0 || tank.health > 30) return;

            const smoke = this.add.circle(
                tank.pivotX + Phaser.Math.Between(-20, 20),
                tank.pivotY,
                Phaser.Math.Between(5, 15),
                0x444444,
                0.6
            );
            smoke.setDepth(15);

            this.tweens.add({
                targets: smoke,
                y: smoke.y - 60,
                alpha: 0,
                scale: { from: 1, to: 2 },
                duration: 800,
                onComplete: () => smoke.destroy()
            });

            this.time.delayedCall(200, createSmoke);
        };

        createSmoke();
    }

    // ==========================================
    // EXPLOSION (Phase 4)
    // ==========================================
    createExplosion(x, y, isDirect) {
        const size = isDirect ? 50 : 30;

        // Play explosion sound
        this.playExplosionSound(isDirect);

        // Multi-layer explosion
        const colors = [0xFF4400, 0xFFAA00, 0xFFFF00];
        const layers = [];

        colors.forEach((color, i) => {
            const layer = this.add.circle(x, y, size - i * 10, color, 0.9 - i * 0.2);
            layer.setDepth(60 + i);
            layers.push(layer);
        });

        // Explosion particles
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const particle = this.add.circle(x, y, 6, 0xFFAA00);
            particle.setDepth(65);

            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * (size + 40),
                y: y + Math.sin(angle) * (size + 40),
                alpha: 0,
                scale: 0.3,
                duration: 300,
                onComplete: () => particle.destroy()
            });
        }

        // Animate main explosion
        this.tweens.add({
            targets: layers,
            scale: { from: 0.5, to: 2.5 },
            alpha: 0,
            duration: 400,
            onComplete: () => layers.forEach(l => l.destroy())
        });

        // Screen shake
        this.cameras.main.shake(isDirect ? 200 : 100, isDirect ? 0.015 : 0.008);
    }

    destroyProjectile() {
        if (this.projectile) {
            this.projectile.destroy();
            this.projectile = null;
        }
    }

    // ==========================================
    // TURN MANAGEMENT
    // ==========================================
    switchTurn() {
        this.time.delayedCall(600, () => {
            if (this.gameOver) return;

            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 2;
            this.canShoot = true;
            this.updateActiveTank();
            this.updateTurnIndicator();
        });
    }

    updateActiveTank() {
        this.tanks.forEach((tank, index) => {
            tank.isActive = (index === this.currentPlayerIndex);

            if (tank.isActive) {
                tank.nameLabel.setColor('#00FF00');
                tank.nameLabel.setFontSize('16px');
                // Highlight animation
                this.tweens.add({
                    targets: tank.container,
                    y: tank.container.y - 3,
                    duration: 300,
                    yoyo: true,
                    repeat: 0
                });
            } else {
                tank.nameLabel.setColor('#ffffff');
                tank.nameLabel.setFontSize('14px');
            }
        });
    }

    // ==========================================
    // WIN & RESET
    // ==========================================
    onTankDestroyed(tankIndex) {
        const destroyedTank = this.tanks[tankIndex];
        const winnerIndex = tankIndex === 0 ? 1 : 0;
        const winner = this.tanks[winnerIndex];

        this.gameOver = true;
        this.canShoot = false;

        // Destroyed tank visuals
        this.drawTankBody(destroyedTank.bodyGraphics, 0x222222, 0x333333);
        destroyedTank.turretBase.clear();
        destroyedTank.turretBase.fillStyle(0x222222);
        destroyedTank.turretBase.fillCircle(0, -15, 18);
        destroyedTank.turretTop.setFillStyle(0x333333);
        destroyedTank.healthText.setText('💀');
        destroyedTank.nameLabel.setText('DESTROYED');
        destroyedTank.nameLabel.setColor('#FF0000');

        // Big explosion
        this.createExplosion(destroyedTank.pivotX, destroyedTank.pivotY, true);
        this.time.delayedCall(200, () => {
            this.createExplosion(destroyedTank.pivotX + 30, destroyedTank.pivotY - 20, true);
        });

        // Show win overlay
        this.time.delayedCall(1000, () => {
            this.showWinScreen(winner);
        });
    }

    showWinScreen(winner) {
        this.winText.setText(`🏆 ${winner.name} WINS! 🏆`);

        this.tweens.add({
            targets: this.winOverlay,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
    }

    restartGame() {
        this.scene.restart();
    }

    // ==========================================
    // UPDATE LOOP
    // ==========================================
    update(time, delta) {
        if (this.projectile) {
            // Create trail
            const trail = this.add.circle(this.projectile.x, this.projectile.y, 4, 0x666666, 0.5);
            trail.setDepth(35);
            this.tweens.add({
                targets: trail,
                alpha: 0,
                scale: 0.3,
                duration: 200,
                onComplete: () => trail.destroy()
            });

            // Out of bounds check
            if (this.projectile.y > 750 || this.projectile.x < -50 ||
                this.projectile.x > 1330 || this.projectile.y < -300) {
                this.destroyProjectile();
                this.switchTurn();
            }
        }
    }
}
