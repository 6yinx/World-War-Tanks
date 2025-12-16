# World War Tanks

A turn-based tank battle game built with Phaser 3 where antigravity tanks fight for dominance using physics-based projectile combat.

## 🎮 Play the Game

Visit the deployed version: [Your Vercel URL here]

## 🚀 Features

- **Turn-based combat** - Take turns aiming and firing at your opponent
- **Physics-based projectiles** - Shells follow realistic arc trajectories
- **Smooth aiming system** - Pull-back to aim with trajectory preview
- **Sound effects** - Custom explosion and shooting sounds
- **Beautiful visuals** - Gradient sky, clouds, explosions, and smoke effects
- **Win/Lose system** - Destroy the enemy tank to win

## 🎯 How to Play

1. Click and drag near your tank to aim
2. Pull back further for more power
3. Release to fire
4. Destroy the enemy tank before they destroy you!

## 🛠️ Tech Stack

- **Engine**: Phaser 3
- **Language**: JavaScript (ES6)
- **Audio**: Web Audio API
- **Deployment**: Vercel

## 📁 Project Structure

```
World War Tanks/
├── index.html          # Main HTML file
├── js/
│   ├── main.js         # Phaser game configuration
│   └── scenes/
│       ├── IntroScene.js   # Intro sequence
│       └── GameScene.js    # Main gameplay
├── package.json        # Project metadata
├── vercel.json         # Vercel deployment config
└── README.md           # This file
```

## 🚀 Deployment

### Deploy to Vercel

1. Push this repository to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your GitHub repository
4. Click "Deploy"
5. Your game will be live!

### Run Locally

```bash
# Option 1: Use any static file server
npx serve .

# Option 2: Open index.html directly in browser
# (Note: Some features may require a server)
```

## 📝 License

MIT License - Feel free to use and modify!

## 🎮 Controls

| Action | Control |
|--------|---------|
| Aim | Click & drag near tank |
| Adjust Power | Drag further = more power |
| Fire | Release mouse |
| Restart | Click restart button |

---

Made with ❤️ using Phaser 3
