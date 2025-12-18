/**
 * GameScene - Main gameplay scene
 * 
 * Phase 1: Core Gameplay ✓
 * Phase 3: UI (Turn indicator, Health bars, Restart button, Win UI)
 * Phase 4: Art & Visuals (Tank art, Visual feedback, Explosions)
 * Phase 5: Polish (Optimized, clean, mobile-ready)
 */

window.GameScene = class GameScene extends Phaser.Scene {
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
        this.TANK_HEALTH = 1000;
        this.MAX_POWER = 1200;  // Increased from 800
        this.MIN_POWER = 150;   // Increased minimum too
        this.POWER_MULTIPLIER = 4; // Higher multiplier for distance
        this.DIRECT_HIT_DAMAGE = 150;
        this.NEAR_HIT_DAMAGE = 120;
        this.NEAR_HIT_RADIUS = 200;

        // Tank movement constants
        this.TANK_SPEED = 150;
        this.TANK_MIN_X = 80;
        this.TANK_MAX_X = 600; // Player tank can only move in left half

        // Charge-up bar shooting variables
        // Canvas-based terrain system
        this.terrainCanvas = null;
        this.terrainContext = null;
        this.terrainSprite = null;
        this.CRATER_RADIUS = 40;
        this.isTimingActive = false;    // Is the timing bar visible?
        this.isCharging = false;        // Is player holding SPACE to charge?
        this.chargeLevel = 0;           // Current charge level (0-1)
        this.targetPinPosition = 0.5;   // Random target position (0-1)
        this.chargeRate = 0.8;          // How fast the bar charges (fills in ~1.25 seconds)
        this.timingBarWidth = 500;      // Width of the timing bar
        this.perfectZoneSize = 0.08;    // Size of the perfect zone around target
        this.currentAimAngle = 0;       // The angle being aimed at

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

        // Setup keyboard controls for tank movement
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Create timing bar UI (Gunbound-style)
        this.createTimingBar();

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
    // ==========================================
    // ENVIRONMENT (Phase 1 + Polish)
    // ==========================================
    createEnvironment() {
        const width = this.scale.width;
        const height = this.scale.height;

        // Ground level - raised higher for more bottom space
        this.groundLevel = height - 140;

        // Beautiful sky gradient
        const skyGradient = this.add.graphics();
        skyGradient.fillGradientStyle(0x4A90D9, 0x4A90D9, 0x87CEEB, 0x87CEEB);
        skyGradient.fillRect(0, 0, width, this.groundLevel);

        // Sun
        const sun = this.add.circle(width - 180, 80, 50, 0xFFDD44, 0.9);
        this.add.circle(width - 180, 80, 45, 0xFFFF88, 0.5);

        // Clouds
        this.createCloud(150, 80);
        this.createCloud(400, 120);
        this.createCloud(width - 580, 60);
        this.createCloud(width - 330, 140);

        // Distant hills
        const hills = this.add.graphics();
        hills.fillStyle(0x6B8E23, 0.5);
        hills.beginPath();
        hills.moveTo(0, this.groundLevel);
        // Dynamic hills drawn across the width
        for (let i = 0; i <= width; i += 200) {
            hills.lineTo(i, this.groundLevel - Math.random() * 80);
        }
        hills.lineTo(width, this.groundLevel);
        hills.closePath();
        hills.fillPath();

        // ==========================================
        // CANVAS-BASED TERRAIN SYSTEM
        // ==========================================
        this.terrainCanvas = document.createElement('canvas');
        this.terrainCanvas.width = width;
        this.terrainCanvas.height = height;
        this.terrainContext = this.terrainCanvas.getContext('2d');

        // Draw initial ground with gradient
        const groundHeight = height - this.groundLevel;
        const gradient = this.terrainContext.createLinearGradient(0, this.groundLevel, 0, height);
        gradient.addColorStop(0, '#4a7c23');
        gradient.addColorStop(1, '#3d6b1c');
        this.terrainContext.fillStyle = gradient;
        this.terrainContext.fillRect(0, this.groundLevel, width, groundHeight);

        // Add grass on top
        this.terrainContext.fillStyle = '#5d9c2f';
        this.terrainContext.fillRect(0, this.groundLevel, width, 6);

        // Create Phaser texture from canvas
        if (this.textures.exists('terrain')) {
            this.textures.remove('terrain');
        }
        this.textures.addCanvas('terrain', this.terrainCanvas);
        this.terrainSprite = this.add.image(width / 2, height / 2, 'terrain');
        this.terrainSprite.setDepth(6);

        // World bounds (walls only, ground collision is pixel-based now)
        this.leftWall = this.add.rectangle(-10, height / 2, 20, height, 0x000000, 0);
        this.physics.add.existing(this.leftWall, true);
        this.rightWall = this.add.rectangle(width + 10, height / 2, 20, height, 0x000000, 0);
        this.physics.add.existing(this.rightWall, true);
    }

    // ==========================================
    // TERRAIN DESTRUCTION SYSTEM
    // ==========================================
    carveTerrainHole(x, y, radius) {
        // Use canvas compositing to erase a circle
        this.terrainContext.globalCompositeOperation = 'destination-out';
        this.terrainContext.beginPath();
        this.terrainContext.arc(x, y, radius, 0, Math.PI * 2);
        this.terrainContext.fill();
        this.terrainContext.globalCompositeOperation = 'source-over';

        // Refresh the Phaser texture to reflect changes
        this.textures.get('terrain').refresh();
    }

    isPixelSolid(x, y) {
        // Check if a pixel at (x, y) is solid terrain
        if (x < 0 || x >= this.terrainCanvas.width ||
            y < 0 || y >= this.terrainCanvas.height) {
            return false;
        }
        const pixel = this.terrainContext.getImageData(Math.floor(x), Math.floor(y), 1, 1);
        return pixel.data[3] > 0; // Check alpha channel
    }

    checkTerrainCollision(x, y, radius = 5) {
        // Check multiple points around the object for collision
        const points = [
            { x: x, y: y },
            { x: x - radius, y: y },
            { x: x + radius, y: y },
            { x: x, y: y + radius },
            { x: x, y: y - radius }
        ];

        for (const point of points) {
            if (this.isPixelSolid(point.x, point.y)) {
                return true;
            }
        }
        return false;
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
        // Use ground level for tank positioning
        const groundY = this.groundLevel - 35;
        const tankA = this.createTank(200, groundY, 0x4A6741, 0x5C7D52, 'Player 1', true);
        const tankB = this.createTank(this.scale.width - 200, groundY, 0x8B6914, 0xA67C00, 'Bot', false);

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

        // ==========================================
        // IMPROVED TREADS with road wheels
        // ==========================================
        tank.treads = this.add.graphics();

        // Main tread housing (dark metal)
        tank.treads.fillStyle(0x1a1a1a);
        tank.treads.fillRoundedRect(-50, 5, 100, 22, 6);

        // Tread surface (rubber texture)
        tank.treads.fillStyle(0x2a2a2a);
        tank.treads.fillRoundedRect(-48, 7, 96, 18, 4);

        // Tread pattern (individual track links)
        tank.treads.fillStyle(0x3a3a3a);
        for (let i = -44; i < 44; i += 8) {
            tank.treads.fillRect(i, 8, 5, 16);
            // Track pins
            tank.treads.fillStyle(0x4a4a4a);
            tank.treads.fillCircle(i + 2.5, 12, 2);
            tank.treads.fillCircle(i + 2.5, 20, 2);
            tank.treads.fillStyle(0x3a3a3a);
        }

        // Road wheels (5 wheels)
        for (let i = -36; i <= 36; i += 18) {
            // Wheel rim
            tank.treads.fillStyle(0x444444);
            tank.treads.fillCircle(i, 16, 10);
            // Wheel hub
            tank.treads.fillStyle(0x666666);
            tank.treads.fillCircle(i, 16, 6);
            // Hub detail
            tank.treads.fillStyle(0x333333);
            tank.treads.fillCircle(i, 16, 3);
            // Wheel spokes
            tank.treads.lineStyle(1, 0x555555);
            for (let a = 0; a < 6; a++) {
                const angle = a * (Math.PI / 3);
                tank.treads.beginPath();
                tank.treads.moveTo(i, 16);
                tank.treads.lineTo(i + Math.cos(angle) * 8, 16 + Math.sin(angle) * 8);
                tank.treads.strokePath();
            }
        }

        // Drive sprocket (front) and idler wheel (back)
        const sprocketPos = facingRight ? 42 : -42;
        const idlerPos = facingRight ? -42 : 42;
        tank.treads.fillStyle(0x555555);
        tank.treads.fillCircle(sprocketPos, 14, 8);
        tank.treads.fillStyle(0x666666);
        tank.treads.fillCircle(idlerPos, 14, 7);

        tank.container.add(tank.treads);

        // ==========================================
        // IMPROVED TANK BODY with armor details
        // ==========================================
        tank.bodyGraphics = this.add.graphics();
        this.drawTankBody(tank.bodyGraphics, bodyColor, highlightColor, facingRight);
        tank.container.add(tank.bodyGraphics);

        // ==========================================
        // TURRET with commander's hatch
        // ==========================================
        tank.turretBase = this.add.graphics();

        // Turret shadow
        tank.turretBase.fillStyle(0x000000, 0.3);
        tank.turretBase.fillEllipse(2, -12, 40, 12);

        // Main turret body
        tank.turretBase.fillStyle(bodyColor);
        tank.turretBase.fillCircle(0, -15, 20);

        // Turret armor ring
        const darkerColor = Phaser.Display.Color.ValueToColor(bodyColor).darken(20).color;
        tank.turretBase.fillStyle(darkerColor);
        tank.turretBase.fillCircle(0, -15, 18);
        tank.turretBase.fillStyle(bodyColor);
        tank.turretBase.fillCircle(0, -15, 15);

        // Turret outline
        tank.turretBase.lineStyle(2, 0x000000);
        tank.turretBase.strokeCircle(0, -15, 20);

        // Commander's hatch
        tank.turretBase.fillStyle(highlightColor);
        tank.turretBase.fillCircle(-8, -20, 8);
        tank.turretBase.lineStyle(2, 0x000000);
        tank.turretBase.strokeCircle(-8, -20, 8);

        // Hatch handle
        tank.turretBase.lineStyle(2, 0x333333);
        tank.turretBase.beginPath();
        tank.turretBase.moveTo(-12, -20);
        tank.turretBase.lineTo(-4, -20);
        tank.turretBase.strokePath();

        // Antenna
        tank.turretBase.lineStyle(2, 0x444444);
        tank.turretBase.beginPath();
        tank.turretBase.moveTo(12, -22);
        tank.turretBase.lineTo(12, -45);
        tank.turretBase.strokePath();
        tank.turretBase.fillStyle(0xff4444);
        tank.turretBase.fillCircle(12, -46, 3);

        tank.container.add(tank.turretBase);

        // Turret top view port
        tank.turretTop = this.add.circle(5, -18, 6, highlightColor);
        tank.turretTop.setStrokeStyle(1, 0x000000);
        tank.container.add(tank.turretTop);

        // ==========================================
        // IMPROVED BARREL with muzzle brake
        // ==========================================
        tank.barrel = this.add.graphics();

        // Main barrel body
        tank.barrel.fillStyle(0x3a3a3a);
        tank.barrel.fillRoundedRect(0, -5, 55, 10, 2);

        // Barrel taper
        tank.barrel.fillStyle(0x444444);
        tank.barrel.fillRect(0, -4, 20, 8);

        // Barrel rifling detail
        tank.barrel.lineStyle(1, 0x333333);
        tank.barrel.beginPath();
        tank.barrel.moveTo(5, 0);
        tank.barrel.lineTo(50, 0);
        tank.barrel.strokePath();

        // Muzzle brake
        tank.barrel.fillStyle(0x2a2a2a);
        tank.barrel.fillRect(50, -7, 12, 14);
        tank.barrel.fillStyle(0x222222);
        tank.barrel.fillRect(53, -8, 3, 16);
        tank.barrel.fillRect(58, -8, 3, 16);

        // Muzzle opening
        tank.barrel.fillStyle(0x111111);
        tank.barrel.fillCircle(62, 0, 4);

        // Barrel outline
        tank.barrel.lineStyle(1, 0x222222);
        tank.barrel.strokeRoundedRect(0, -5, 55, 10, 2);

        tank.barrel.x = x;
        tank.barrel.y = y - 20;
        tank.barrel.setDepth(10);

        // Set initial barrel angle
        tank.barrel.rotation = facingRight ? -0.5 : Math.PI + 0.5;

        // Health bar background
        tank.healthBarBg = this.add.rectangle(x, y - 60, 80, 14, 0x222222);
        tank.healthBarBg.setStrokeStyle(2, 0x000000);
        tank.healthBarBg.setDepth(100);

        // Health bar fill
        tank.healthBarFill = this.add.rectangle(x - 37, y - 60, 74, 10, 0x00FF00);
        tank.healthBarFill.setOrigin(0, 0.5);
        tank.healthBarFill.setDepth(101);

        // Health text
        tank.healthText = this.add.text(x, y - 60, this.TANK_HEALTH.toString(), {
            fontSize: '10px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(102);

        // Name label
        tank.nameLabel = this.add.text(x, y - 80, name, {
            fontSize: '14px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(100);

        // Physics body (invisible, for collision)
        tank.physicsBody = this.add.rectangle(x, y, 90, 40, 0x000000, 0);
        this.physics.add.existing(tank.physicsBody); // Dynamic body
        tank.physicsBody.body.setCollideWorldBounds(true);
        tank.physicsBody.body.setGravityY(600);

        // Add collision with ground
        this.physics.add.collider(tank.physicsBody, this.ground);

        return tank;
    }

    drawTankBody(graphics, mainColor, lightColor, facingRight = true) {
        graphics.clear();

        // Tank body shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillRoundedRect(-38, -6, 80, 30, 5);

        // Main body hull
        graphics.fillStyle(mainColor);
        graphics.fillRoundedRect(-45, -12, 90, 32, 6);

        // Top armor plate (sloped)
        graphics.fillStyle(lightColor);
        graphics.beginPath();
        graphics.moveTo(-42, -10);
        graphics.lineTo(42, -10);
        graphics.lineTo(38, 0);
        graphics.lineTo(-38, 0);
        graphics.closePath();
        graphics.fillPath();

        // Side armor skirts
        const darkerColor = Phaser.Display.Color.ValueToColor(mainColor).darken(15).color;
        graphics.fillStyle(darkerColor);
        graphics.fillRect(-47, -5, 6, 22);
        graphics.fillRect(41, -5, 6, 22);

        // Engine compartment (back of tank)
        const enginePos = facingRight ? -38 : 32;
        graphics.fillStyle(darkerColor);
        graphics.fillRect(enginePos, -8, 12, 20);

        // Engine louvers
        graphics.fillStyle(0x222222);
        for (let i = 0; i < 4; i++) {
            graphics.fillRect(enginePos + 2, -6 + i * 5, 8, 2);
        }

        // Exhaust pipe
        graphics.fillStyle(0x333333);
        const exhaustX = facingRight ? -45 : 43;
        graphics.fillCircle(exhaustX, 5, 4);
        graphics.fillStyle(0x222222);
        graphics.fillCircle(exhaustX, 5, 2);

        // Hull rivets
        graphics.fillStyle(0x555555);
        const rivetPositions = [-35, -20, -5, 10, 25, 35];
        rivetPositions.forEach(rx => {
            graphics.fillCircle(rx, -9, 2);
            graphics.fillCircle(rx, 14, 2);
        });

        // Front armor detail
        const frontPos = facingRight ? 35 : -40;
        graphics.fillStyle(lightColor);
        graphics.fillRoundedRect(frontPos, -8, 8, 18, 2);

        // View port / driver's slit
        graphics.fillStyle(0x111111);
        graphics.fillRect(facingRight ? 25 : -30, -8, 12, 4);
        graphics.fillStyle(0x88ccff, 0.3);
        graphics.fillRect(facingRight ? 26 : -29, -7, 10, 2);

        // Outline
        graphics.lineStyle(2, 0x000000);
        graphics.strokeRoundedRect(-45, -12, 90, 32, 6);
    }

    // ==========================================
    // UI (Phase 3)
    // ==========================================
    createUI() {
        const width = this.scale.width;
        const centerX = width / 2;

        // Top UI bar background
        const uiBar = this.add.graphics();
        uiBar.fillStyle(0x000000, 0.6);
        uiBar.fillRoundedRect(centerX - 200, 10, 400, 50, 10);
        uiBar.setDepth(200);

        // Turn indicator
        this.turnIndicator = this.add.text(centerX, 25, '', {
            fontSize: '20px',
            fontFamily: 'Arial Black, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(201);

        // Turn indicator subtitle
        this.turnSubtext = this.add.text(centerX, 48, 'Aim with mouse, press SPACE to shoot', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#aaaaaa'
        }).setOrigin(0.5).setDepth(201);

        // Power indicator (shown during aiming)
        this.powerIndicatorBg = this.add.rectangle(centerX, 75, 200, 16, 0x333333);
        this.powerIndicatorBg.setStrokeStyle(2, 0x000000);
        this.powerIndicatorBg.setDepth(200);
        this.powerIndicatorBg.setAlpha(0);

        this.powerIndicatorFill = this.add.rectangle(centerX - 98, 75, 0, 12, 0xFF6600);
        this.powerIndicatorFill.setOrigin(0, 0.5);
        this.powerIndicatorFill.setDepth(201);
        this.powerIndicatorFill.setAlpha(0);

        this.powerText = this.add.text(centerX, 75, 'POWER', {
            fontSize: '10px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(202);
        this.powerText.setAlpha(0);

        // Restart button
        this.restartBtn = this.add.container(width - 60, 40);
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
        const width = this.scale.width;
        const height = this.scale.height;

        this.winOverlay = this.add.container(width / 2, height / 2);
        this.winOverlay.setDepth(500);
        this.winOverlay.setAlpha(0);

        // Dark background
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);

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
        const barWidth = 74 * healthPercent;

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
    // CHARGE-UP BAR SHOOTING SYSTEM
    // ==========================================
    createTimingBar() {
        const width = this.scale.width;
        const height = this.scale.height;
        const centerX = width / 2;
        const barY = height - 60;

        // Container for all timing bar elements
        this.timingBarContainer = this.add.container(centerX, barY);
        this.timingBarContainer.setDepth(300);
        this.timingBarContainer.setAlpha(0); // Hidden initially

        // Background bar
        const barBg = this.add.rectangle(0, 0, this.timingBarWidth + 20, 50, 0x1a1a2e, 0.95);
        barBg.setStrokeStyle(3, 0x444466);

        // Main bar background (empty)
        const mainBarBg = this.add.rectangle(0, 0, this.timingBarWidth, 28, 0x222233);
        mainBarBg.setStrokeStyle(2, 0x111122);

        // Charge fill bar (grows as player holds SPACE)
        this.chargeFill = this.add.rectangle(
            -this.timingBarWidth / 2, 0,
            0, 24,
            0x44aaff
        );
        this.chargeFill.setOrigin(0, 0.5);

        // Target pin indicator (shows where to stop)
        this.targetPin = this.add.graphics();
        this.drawTargetPin();

        // Instruction text
        this.timingInstruction = this.add.text(0, -38, '⬜ Hold SPACE to charge, release to fire!', {
            fontSize: '13px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Accuracy labels
        const underLabel = this.add.text(-this.timingBarWidth / 3, 22, '← WEAK', {
            fontSize: '10px',
            fontFamily: 'Arial',
            color: '#6688cc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const overLabel = this.add.text(this.timingBarWidth / 3, 22, 'STRONG →', {
            fontSize: '10px',
            fontFamily: 'Arial',
            color: '#cc8866',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        // Add all elements to container
        this.timingBarContainer.add([
            barBg, mainBarBg, this.chargeFill, this.targetPin,
            this.timingInstruction, underLabel, overLabel
        ]);
    }

    drawTargetPin() {
        this.targetPin.clear();

        // Calculate pin X position
        const pinX = (this.targetPinPosition - 0.5) * this.timingBarWidth;

        // Perfect zone background
        const zoneWidth = this.timingBarWidth * this.perfectZoneSize;
        this.targetPin.fillStyle(0x44ff44, 0.3);
        this.targetPin.fillRect(pinX - zoneWidth / 2, -14, zoneWidth, 28);

        // Target line
        this.targetPin.lineStyle(4, 0x44ff44);
        this.targetPin.beginPath();
        this.targetPin.moveTo(pinX, -16);
        this.targetPin.lineTo(pinX, 16);
        this.targetPin.strokePath();

        // Target arrow pointing down
        this.targetPin.fillStyle(0xff4444);
        this.targetPin.fillTriangle(pinX - 10, -20, pinX + 10, -20, pinX, -10);

        // Target label
        this.targetPin.fillStyle(0xffffff);
        this.targetPin.fillCircle(pinX, -24, 6);

        // "TARGET" text above
        if (!this.targetLabel) {
            this.targetLabel = this.add.text(0, -26, '🎯', {
                fontSize: '14px'
            }).setOrigin(0.5);
            this.timingBarContainer.add(this.targetLabel);
        }
        this.targetLabel.x = pinX;
    }

    showTimingBar() {
        this.isTimingActive = true;
        this.isCharging = false;
        this.chargeLevel = 0;

        // Set random target position (between 0.25 and 0.85 for fairness)
        this.targetPinPosition = 0.25 + Math.random() * 0.6;

        // Redraw target pin at new position
        this.drawTargetPin();

        // Reset charge fill
        this.chargeFill.width = 0;
        this.chargeFill.setFillStyle(0x44aaff);

        // Animate in
        this.tweens.add({
            targets: this.timingBarContainer,
            alpha: 1,
            y: this.scale.height - 60,
            duration: 300,
            ease: 'Power2'
        });

        // Update instruction
        this.timingInstruction.setText('⬜ Hold SPACE to charge, release to fire!');
    }

    hideTimingBar() {
        this.isTimingActive = false;
        this.isCharging = false;

        this.tweens.add({
            targets: this.timingBarContainer,
            alpha: 0,
            duration: 200
        });
    }

    startCharging() {
        if (!this.isTimingActive || this.isCharging || !this.canShoot) return;

        this.isCharging = true;
        this.chargeLevel = 0;
        this.chargeFill.width = 0;

        // Update instruction
        this.timingInstruction.setText('🔥 CHARGING... Release at the target!');

        // Play charging sound cue
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    updateCharging(delta) {
        if (!this.isCharging) return;

        // Increase charge level
        this.chargeLevel += this.chargeRate * (delta / 1000);

        // Clamp to max
        if (this.chargeLevel >= 1) {
            this.chargeLevel = 1;
            // Auto-fire at max charge
            this.releaseShot();
            return;
        }

        // Update visual fill
        this.chargeFill.width = this.chargeLevel * this.timingBarWidth;

        // Color changes as we approach/pass target
        const distanceToTarget = Math.abs(this.chargeLevel - this.targetPinPosition);
        if (distanceToTarget < this.perfectZoneSize / 2) {
            this.chargeFill.setFillStyle(0x44ff44); // Green - in target zone
        } else if (this.chargeLevel < this.targetPinPosition) {
            this.chargeFill.setFillStyle(0x44aaff); // Blue - under target
        } else {
            this.chargeFill.setFillStyle(0xff6644); // Orange/red - over target
        }
    }

    releaseShot() {
        if (!this.isCharging) return;

        this.isCharging = false;

        // Calculate accuracy based on distance to target
        const accuracy = this.calculateShotAccuracy();

        // Hide timing bar
        this.hideTimingBar();
        this.aimLine.clear();
        this.aimIndicator.clear();

        const activeTank = this.tanks[this.currentPlayerIndex];

        // Calculate power based on accuracy
        const basePower = 900;
        const finalPower = basePower * accuracy.powerMultiplier;

        // Show accuracy feedback
        this.showAccuracyFeedback(accuracy.zone, accuracy.accuracy);

        // Fire the projectile
        this.fireProjectile(activeTank, this.currentAimAngle, finalPower);
    }

    calculateShotAccuracy() {
        // Distance from charge level to target
        const distance = Math.abs(this.chargeLevel - this.targetPinPosition);
        const perfectThreshold = this.perfectZoneSize / 2;

        if (distance <= perfectThreshold) {
            // Perfect shot!
            const perfectness = 1 - (distance / perfectThreshold);
            return {
                zone: 'perfect',
                accuracy: perfectness,
                powerMultiplier: 0.95 + perfectness * 0.05 // 95-100%
            };
        } else if (this.chargeLevel < this.targetPinPosition) {
            // Under-charged - weak shot
            const weakness = (this.targetPinPosition - this.chargeLevel) / this.targetPinPosition;
            return {
                zone: 'weak',
                accuracy: 0,
                powerMultiplier: 0.3 + (1 - weakness) * 0.5 // 30-80%
            };
        } else {
            // Over-charged - too strong
            const excess = (this.chargeLevel - this.targetPinPosition) / (1 - this.targetPinPosition);
            return {
                zone: 'strong',
                accuracy: 0,
                powerMultiplier: 1.1 + excess * 0.4 // 110-150%
            };
        }
    }

    showAccuracyFeedback(zone, accuracy) {
        let message, color;

        switch (zone) {
            case 'perfect':
                message = accuracy > 0.8 ? '⭐ PERFECT! ⭐' : '✓ Good shot!';
                color = '#44ff44';
                break;
            case 'weak':
                message = '📉 Too weak...';
                color = '#6688ff';
                break;
            case 'strong':
                message = '📈 Too strong!';
                color = '#ff8844';
                break;
        }

        const text = this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, message, {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            color: color,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(400);

        this.tweens.add({
            targets: text,
            alpha: { from: 1, to: 0 },
            y: text.y - 60,
            scale: { from: 1, to: 1.3 },
            duration: 1200,
            onComplete: () => text.destroy()
        });
    }

    // ==========================================
    // INPUT & AIMING (Improved Smoothness)
    // ==========================================
    setupInput() {
        this.input.on('pointermove', this.onPointerMove, this);

        // SPACEBAR hold to charge, release to fire
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.isTimingActive && this.canShoot && !this.gameOver && this.currentPlayerIndex === 0) {
                this.startCharging();
            }
        });

        this.input.keyboard.on('keyup-SPACE', () => {
            if (this.isCharging && this.canShoot && !this.gameOver && this.currentPlayerIndex === 0) {
                this.releaseShot();
            }
        });
    }

    onPointerMove(pointer) {
        // Only allow aiming during player's turn
        if (this.gameOver || this.currentPlayerIndex !== 0 || !this.canShoot) return;

        const activeTank = this.tanks[this.currentPlayerIndex];

        // Calculate angle from tank toward cursor
        const angle = Phaser.Math.Angle.Between(
            activeTank.pivotX, activeTank.pivotY,
            pointer.x, pointer.y
        );

        // Smooth interpolation for angle
        this.currentAngle = Phaser.Math.Linear(this.currentAngle, angle, this.aimLerpSpeed);
        this.currentAimAngle = this.currentAngle;

        // Apply to barrel
        activeTank.barrel.rotation = this.currentAngle;

        // Show timing bar if not already active
        if (!this.isTimingActive) {
            this.showTimingBar();

            // Resume audio context on user interaction
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }

        // Draw aim visualization
        this.drawAimLine(activeTank, this.currentAngle, this.MAX_POWER * 0.75);
        this.drawCursorIndicator(activeTank, pointer);
    }

    drawCursorIndicator(tank, pointer) {
        this.aimIndicator.clear();

        // Draw crosshair/target at cursor position
        const size = 20;

        // Outer circle
        this.aimIndicator.lineStyle(3, 0xFF4400, 0.8);
        this.aimIndicator.strokeCircle(pointer.x, pointer.y, size);

        // Inner circle
        this.aimIndicator.lineStyle(2, 0xFFFFFF, 0.9);
        this.aimIndicator.strokeCircle(pointer.x, pointer.y, size * 0.4);

        // Crosshair lines
        this.aimIndicator.lineStyle(2, 0xFF4400, 0.7);
        this.aimIndicator.beginPath();
        this.aimIndicator.moveTo(pointer.x - size - 5, pointer.y);
        this.aimIndicator.lineTo(pointer.x - size * 0.6, pointer.y);
        this.aimIndicator.moveTo(pointer.x + size + 5, pointer.y);
        this.aimIndicator.lineTo(pointer.x + size * 0.6, pointer.y);
        this.aimIndicator.moveTo(pointer.x, pointer.y - size - 5);
        this.aimIndicator.lineTo(pointer.x, pointer.y - size * 0.6);
        this.aimIndicator.moveTo(pointer.x, pointer.y + size + 5);
        this.aimIndicator.lineTo(pointer.x, pointer.y + size * 0.6);
        this.aimIndicator.strokePath();
    }

    drawAimLine(tank, angle, power) {
        this.aimLine.clear();

        const numDots = 20;
        const gravity = 500;
        const velocityX = Math.cos(angle) * power;
        const velocityY = Math.sin(angle) * power;

        // Trajectory dots with gradient
        for (let i = 1; i <= numDots; i++) {
            const t = i * 0.05;
            const dotX = tank.pivotX + velocityX * t;
            const dotY = tank.pivotY + velocityY * t + 0.5 * gravity * t * t;

            // Don't draw dots below ground
            if (dotY > this.groundLevel) break;

            const alpha = 1 - (i / numDots) * 0.8;
            const size = 7 - (i / numDots) * 4;

            // Color gradient from yellow to red
            const colorLerp = i / numDots;
            const r = 255;
            const g = Math.floor(255 * (1 - colorLerp * 0.7));
            const b = 0;

            this.aimLine.fillStyle(Phaser.Display.Color.GetColor(r, g, b), alpha);
            this.aimLine.fillCircle(dotX, dotY, size);
        }

        // Power line from barrel tip
        const lineLength = power / 6;
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
        // Note: Ground collision is now pixel-based, checked in update()
        // Only set up tank and wall colliders here

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

        // Terrain destruction is handled by createExplosion
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

        // Apply splash damage to other tanks
        this.checkNearHits(this.projectile.x, this.projectile.y, tankIndex);

        this.destroyProjectile();

        if (hitTank.health <= 0) {
            this.onTankDestroyed(tankIndex);
        } else {
            this.switchTurn();
        }
    }

    checkNearHits(x, y, directHitIndex = -1) {
        this.tanks.forEach((tank, index) => {
            // Skip the tank that took a direct hit
            if (index === directHitIndex) return;

            // Skip shooter to avoid self-damage (gameplay choice)
            if (index === this.projectile.shooter) return;

            const distance = Phaser.Math.Distance.Between(x, y, tank.pivotX, tank.pivotY);

            if (distance <= this.NEAR_HIT_RADIUS) {
                // Falloff damage calculation: Max damage at center, 0 at radius edge
                const falloff = 1 - (distance / this.NEAR_HIT_RADIUS);
                const damage = Math.floor(this.NEAR_HIT_DAMAGE * falloff);

                if (damage > 0) {
                    this.applyDamage(index, damage);
                    this.flashTank(tank, 0xFFAA00);

                    if (tank.health <= 0) {
                        this.onTankDestroyed(index);
                    }
                }
            }
        });
    }

    applyDamage(tankIndex, damage) {
        const tank = this.tanks[tankIndex];
        tank.health = Math.max(0, tank.health - damage);
        this.updateHealthBar(tank);

        // Low health smoke effect (Phase 4)
        if (tank.health <= 300 && tank.health > 0 && !tank.smoking) {
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
        this.drawTankBody(tank.bodyGraphics, color, 0xFFFFFF, tank.facingRight);

        this.time.delayedCall(200, () => {
            if (tank.health > 0) {
                this.drawTankBody(tank.bodyGraphics,
                    tank.health <= 300 ? 0x660000 : tank.bodyColor,
                    tank.health <= 300 ? 0x880000 : tank.highlightColor,
                    tank.facingRight
                );
            }
        });
    }

    createSmokeEffect(tank) {
        // Create smoke particles
        const createSmoke = () => {
            if (tank.health <= 0 || tank.health > 300) return;

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
        const size = isDirect ? 80 : 50;
        const craterRadius = isDirect ? 50 : 35;

        // Play explosion sound
        this.playExplosionSound(isDirect);

        // Carve circular hole in terrain (pixel-based destruction)
        this.carveTerrainHole(x, y, craterRadius);

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
    // ==========================================
    // BOT AI
    // ==========================================
    botTurn() {
        this.time.delayedCall(1500, () => {
            if (this.gameOver) return;

            const botTank = this.tanks[1];
            const targetTank = this.tanks[0];

            // Calculate solution
            const solution = this.calculateFiringSolution(
                botTank.pivotX, botTank.pivotY,
                targetTank.pivotX, targetTank.pivotY
            );

            if (solution) {
                // Accuracy Logic: 45% chance to aim accurately
                const isAccurate = Phaser.Math.Between(1, 100) <= 45;
                let error;

                if (isAccurate) {
                    // High accuracy: very small error
                    error = Phaser.Math.Between(-5, 5);
                } else {
                    // Low accuracy: large error to ensure miss or poor shot
                    // Randomly overshoot or undershoot
                    const errorMag = Phaser.Math.Between(50, 200);
                    error = Math.random() < 0.5 ? -errorMag : errorMag;
                }

                const finalPower = Phaser.Math.Clamp(solution.power + error, this.MIN_POWER, this.MAX_POWER);

                // Animate aiming
                this.tweens.add({
                    targets: botTank.barrel,
                    rotation: solution.angle,
                    duration: 1000,
                    ease: 'Power2',
                    onComplete: () => {
                        this.time.delayedCall(500, () => {
                            this.fireProjectile(botTank, solution.angle, finalPower);
                        });
                    }
                });
            } else {
                // Fallback if no solution found (shoot randomly left)
                this.fireProjectile(botTank, Math.PI + 0.5, 600);
            }
        });
    }

    calculateFiringSolution(x0, y0, targetX, targetY) {
        const dx = targetX - x0;
        const dy = targetY - y0;
        const g = 500; // gravity

        // Try a few angles to find a valid power
        // Bot is on the right, so angles should be around 180-270 degrees (PI to 1.5PI)
        const testAngles = [
            Math.PI + 0.35, // Low arc
            Math.PI + 0.6,  // Mid arc
            Math.PI + 0.85  // High arc
        ];

        // Pick a random angle for variety
        const angle = Phaser.Utils.Array.GetRandom(testAngles);

        // Trajectory formula derived for v
        // v = sqrt( (g * x^2) / (2 * cos^2(a) * (x * tan(a) - y)) )
        // Note: My previous derivation had y and x signs handled implicitly by dx/dy
        // y(x) = x * tan(a) - (g * x^2) / (2 * v^2 * cos^2(a))
        // So: (g * x^2) / (2 * v^2 * cos^2(a)) = x * tan(a) - y
        // v^2 = (g * x^2) / (2 * cos^2(a) * (x * tan(a) - y))

        const cosA = Math.cos(angle);
        const tanA = Math.tan(angle);

        const term = dx * tanA - dy;

        if (term <= 0.001) return null; // No solution for this angle (target too high or wrong direction)

        const v2 = (g * dx * dx) / (2 * cosA * cosA * term);
        const v = Math.sqrt(v2);

        return { angle: angle, power: v };
    }

    switchTurn() {
        this.time.delayedCall(600, () => {
            if (this.gameOver) return;

            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 2;
            this.canShoot = true;
            this.updateActiveTank();
            this.updateTurnIndicator();

            // Bot Turn Check
            if (this.currentPlayerIndex === 1) {
                this.canShoot = false;
                this.botTurn();
            }
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
        this.drawTankBody(destroyedTank.bodyGraphics, 0x222222, 0x333333, destroyedTank.facingRight);
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
        this.scene.start('IntroScene');
    }

    updateTankVisuals() {
        if (!this.tanks) return;

        this.tanks.forEach(tank => {
            if (!tank.physicsBody) return;

            const x = tank.physicsBody.x;
            const y = tank.physicsBody.y;

            // Sync visual elements
            tank.container.setPosition(x, y);
            tank.barrel.setPosition(x, y - 20);

            tank.pivotX = x;
            tank.pivotY = y - 20;

            // Health bar and label
            tank.healthBarBg.setPosition(x, y - 60);
            tank.healthBarFill.setPosition(x - 37, y - 60);
            tank.healthText.setPosition(x, y - 60);
            tank.nameLabel.setPosition(x, y - 80);
        });
    }

    // ==========================================
    // UPDATE LOOP
    // ==========================================
    update(time, delta) {
        // Update charge bar if active
        this.updateCharging(delta);

        // Handle player tank movement (only during player's turn)
        if (this.currentPlayerIndex === 0 && this.canShoot && !this.gameOver) {
            this.handlePlayerMovement(delta);
        }

        // Sync tank visuals with physics
        this.updateTankVisuals();

        if (this.projectile) {
            // Pixel-based ground collision check
            const px = this.projectile.x;
            const py = this.projectile.y;
            if (this.checkTerrainCollision(px, py, 6)) {
                this.onProjectileHitGround();
                return; // Exit early since projectile is destroyed
            }

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
            const width = this.scale.width;
            const height = this.scale.height;
            if (this.projectile.y > height + 50 || this.projectile.x < -50 ||
                this.projectile.x > width + 50 || this.projectile.y < -300) {
                this.destroyProjectile();
                this.switchTurn();
            }
        }
    }

    handlePlayerMovement(delta) {
        const tank = this.tanks[0];
        let moveX = 0;

        // Check for left/right input
        if (this.cursors.left.isDown || this.keyA.isDown) {
            moveX = -this.TANK_SPEED * (delta / 1000);
        } else if (this.cursors.right.isDown || this.keyD.isDown) {
            moveX = this.TANK_SPEED * (delta / 1000);
        }

        if (moveX !== 0) {
            // Calculate new position with bounds
            const newX = Phaser.Math.Clamp(
                tank.physicsBody.x + moveX,
                this.TANK_MIN_X,
                this.TANK_MAX_X
            );

            // Update physics body position directly
            tank.physicsBody.x = newX;
            // Note: Visuals are updated in updateTankVisuals()
        }
    }
}
