# Geometry Dash — Infinite Neon Runner 🚀✨

An immersive, infinite neon-themed runner game built entirely from scratch using **HTML5 Canvas**, **Vanilla CSS**, and **Vanilla JavaScript**. Experience fast-paced platforming, buy powerful upgrades, customize your runner in the shop, unlock achievements, and climb the leaderboard!

![Neon Runner Preview](https://img.shields.io/badge/Made%20With-HTML5%20%7C%20CSS3%20%7C%20JS-critical?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Fully%20Playable-success?style=for-the-badge)

---

## 🎮 How to Play

Navigate the neon grid, dodge spikes, jump over gaps, and utilize special portals and power-ups to survive as long as possible.

| Key / Control | Action |
|---|---|
| `Space` or `Arrow Up` or `Left Click` | **Jump** / **Double Jump** (if unlocked) |
| `S` (Hold) | **Slow Motion** (requires charge) |
| `Esc` | **Pause / Resume** game |

---

## ⚡ Core Features

- **Smooth Arcade Physics:** Responsive jump, double jump, and custom gravity mechanics.
- **Dynamic Zones:** Progress through different colored zones (e.g., Neon City, and more) with increasing speeds and more challenging obstacles.
- **Power-Up Rings:** Special interactive rings that alter gameplay:
  - ⭐ **Star Ring**: Invincibility shield.
  - 🟡 **Coin Rush**: Activates a 5x coin multiplier.
  - 🔵 **Mini Ring**: Shrinks your runner, making it easier to squeeze through tight spots.
  - 🔴 **Speed Ring**: Launches you forward at hyper speed.
  - 🔄 **Gravity Ring**: Flips gravity upside-down!
- **Interactive Shop:** Spend your collected stars (★) on:
  - **Abilities:** Permanent utilities like Shields, Ghost mode, Slow Motion, Double Jump, and Double Coins.
  - **Upgrades:** Boost your power-up duration and shield capacity.
  - **Skins:** Customize your square runner with vibrant neon designs.
  - **Trails:** Leave a glowing aesthetic trail (particles, neon glow, etc.) behind you as you speed run.
- **Achievements System:** 10 unique achievements that reward bonus stars upon completion.
- **Rich Dashboard Stats:** Tracks total runs, total distance, best runs, coins collected, best streak, and includes a **visual history chart** representing your last 8 runs.
- **Personalized Settings:** Fine-tune your experience with volume sliders for music and sound effects, screen shake toggle, high-contrast mode for improved obstacle visibility, and progress reset.

---

## 🛠️ Technology Stack

- **Structure:** [index.html](file:///e:/geometry%20dash%20clone/index.html)
- **Styling:** [style.css](file:///e:/geometry%20dash%20clone/style.css) (Custom CSS variables, neon glassmorphism UI elements, keyframe animations)
- **Engine / Logic:** [game.js](file:///e:/geometry%20dash%20clone/game.js) (HTML5 Canvas rendering context, game loops with delta-time physics, particle systems, collision detection boxes, state management, and `localStorage` persistence)

---

## 🚀 Getting Started

Since this game is built using standard web technologies, there are no compilers, bundlers, or heavy dependencies required.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Farhath246/geometry-dash-clone.git
   ```
2. **Launch the game:**
   - Double-click [index.html](file:///e:/geometry%20dash%20clone/index.html) to run it directly in your web browser.
   - *Or* run a local development server for the best experience (e.g., using VS Code's Live Server extension or Python's HTTP server):
     ```bash
     python -m http.server 8000
     ```
     Then open `http://localhost:8000` in your browser.

---

## 📁 Project Structure

```
geometry-dash-clone/
├── index.html       # Game markup, menus, shop structure, and HUD elements
├── style.css        # Responsive layouts, neon theme styling, animations
├── game.js          # Core physics, canvas rendering loop, state persistence
└── .gitignore       # Git exclusion rules
```

---

## 📄 License

This project is licensed under the MIT License. Feel free to clone, modify, and build upon it!
