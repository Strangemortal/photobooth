# 📸 Japanese Street Photobooth

<a href="https://github.com/grvsnh/photobooth/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=grvsnh/photobooth" />
</a>

A highly interactive, visually stunning, fully responsive web-based Japanese street-inspired photobooth simulation built with **React, Vite, Three.js, GSAP, and HTML5 Canvas**. 

Step into a neon-lit Tokyo alleyway, peek through the velvet entrance curtains, play the interactive claw machine minigame, step inside to capture retro photos with analog camera flash, process procedural film grain filters, and customize & download vintage photo strips.

---

## 🌟 Key Features & Experience

- **Tokyo Alleyway Atmosphere**: Complete with animated sakura petals, randomized draggable street posters, a day/night theme toggle, and a classic storefront sign.
- **Interactive 3D Velvet Curtains**: WebGL-rendered double velvet curtain system featuring:
  - **Center Peek Gap**: Designed with a subtle parted center opening that lets the glowing neon background prompt peek through so users get a glimpse inside before entering.
  - **Smooth Sliding Animations**: Click, tap, or pull either curtain cloth to slide them back smoothly with GSAP velvet folding physics.
- **Tokyo Arcade Claw Machine Minigame**: A fully functional retro Japanese claw machine game modal!
  - Control gantry movement using on-screen direction buttons or keyboard shortcuts (`A/D`, `Arrow Keys`, `Space`).
  - Axis-Aligned Bounding Box (AABB) collision detection for grabbing cute Japanese plushies (Kuma Bear, Usagi Bunny, Kappa Cucumber, Mecha Bot, etc.).
  - Win plushie rewards that get deposited into your prize collection box!
- **Physical Camera Capture & Flash**: Real-time WebRTC camera integration with single or triple photo capture modes, countdown timer overlay, and high-intensity flash.
- **Procedural Film & Paper Engine**: Applies custom vintage filters, film grain, dust, and scratches to captured photos on procedural substrates (aged, glossy, vintage, polaroid, B&W).
- **In-Slot Mechanical Printing & Customizer**: Physical printer bin simulation with real-time printing animation and photo strip customization (date, time, title, filters).
- **Responsive AF**: Optimized with dynamic fluid sizing for mobile smartphones, tablets, laptops, and wide desktop displays.

---

## 🛠️ Architecture & Technologies Used

- **Framework & Build System**: [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- **3D Graphics & Physics**: [Three.js](https://threejs.org/) for real-time 3D cloth curtain rendering and [GSAP 3](https://gsap.com/) for fluid state interpolation.
- **Styling**: Modular CSS3 with CSS Grid, Flexbox, CSS Custom Properties, and responsive viewport units.
- **Camera & Processing**: WebRTC `getUserMedia` API & 2D HTML5 Canvas pixel manipulation.

---

## 📂 Project Structure

```
photobooth/
├── public/
│   └── assets/                # Public assets (Claw machine graphic, posters, fonts)
├── src/
│   ├── assets/                # Source fonts and static assets
│   ├── components/
│   │   ├── ClawMachine/       # Interactive Arcade Claw Machine Modal
│   │   ├── CountdownOverlay/  # 3-2-1 Capture Countdown Overlay
│   │   ├── CurtainCanvas/     # Three.js 3D Velvet Curtain Canvas Component
│   │   ├── FlashOverlay/      # Camera Screen Flash Effect
│   │   ├── InsideScene/       # Interior Photobooth Scene & Viewfinder
│   │   ├── LoadingScreen/     # Neon Alleyway Loading Screen
│   │   ├── OutsideScene/      # Alleyway Outside Scene (Signboard, Posters, Slot)
│   │   ├── StripPreview/      # Photo Strip Customizer & Download Modal
│   │   └── Toast/             # Interactive Toast Notifications
│   ├── styles/                # Modular CSS stylesheets
│   ├── utils/
│   │   ├── camera.js          # WebRTC camera controller
│   │   ├── cloth.js           # Three.js double curtain physics & peek gap
│   │   ├── filters.js         # Canvas pixel filters (Grain, dust, scratches)
│   │   ├── paper.js           # Procedural paper texture generator
│   │   ├── strip.js           # Canvas frame compositor
│   │   └── ui.js              # Pointer and selection utilities
│   ├── App.jsx                # Main application orchestrator
│   └── main.jsx               # React DOM entry point
├── package.json
└── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Installation & Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/grvsnh/photobooth.git
   cd photobooth
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`. Grant **camera permissions** to capture your vintage photo strips!

4. **Build for production**:
   ```bash
   npm run build
   ```
   The optimized production bundle will be generated in the `dist/` directory.
