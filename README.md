# 📸 Japanese Street Photobooth

A highly interactive, visually stunning web-based Japanese street-inspired photobooth simulation. Transition seamlessly from a neon-lit Tokyo alleyway into a retro photobooth to capture, process, and print gorgeous vintage-style photo strips with procedural paper substrates, analog film filters, dust, grain, and scratches.

---

## 🌟 Features & Experience

- **Tokyo Alleyway Atmosphere**: Complete with animated anime light particles, interactive draggable/throwable street posters, a clicking theme toggle, and a swaying neon sign.
- **Interactive 3D Velvet Curtains**: Pull either side of the dual-curtain entrance to slide them back with realistic velvet folding animations, revealing the inner booth.
- **Physical Camera Capture & Flash**: Real-time webcam integration with countdown cues, high-intensity screen flash, and single or triple-photo modes.
- **Procedural Development Engine**: Synthesizes custom vintage filters, realistic film grain, organic dust, hairs, and fine scratches on the fly.
- **Interactive Mechanical Printer**: Prints a 2D canvas strip that wiggles and sways realistically from the machine slot. Grab and drag it to feel the resistance, then pull it all the way down to tear it off!

---

## 🛠️ Technologies Used & Technical Architecture

The photobooth runs entirely in the browser with **vanilla JavaScript, CSS3, and HTML5 Canvas API**, using only two external libraries (`Three.js` and `GSAP`) for 3D rendering and transitions.

### 1. Interactive 3D Curtain Simulation (`js/cloth.js` & `Three.js`)

The entrance curtains are not a simple CSS animation; they are a WebGL-rendered 3D double curtain system:

- **Three.js Engine**: Uses `THREE.WebGLRenderer`, `THREE.PerspectiveCamera`, `THREE.Scene`, and `THREE.MeshStandardMaterial` (with fine-tuned roughness and metalness) to render a split velvet curtain sliding on a metallic cylinder rod (`THREE.CylinderGeometry`) with brass rings (`THREE.TorusGeometry`).
- **Dynamic Procedural Texturing**: The curtains feature traditional Japanese calligraphic kanji characters—**"美" (Beauty)** on the left and **"華" (Splendor)** on the right. Rather than loading external images, the script dynamically draws them onto an off-screen 2D canvas with rich blood-red gradients, drop shadows, and double borders, and binds it as a `THREE.CanvasTexture`.
- **GSAP State Tweens**: Integrates with `GSAP` to interpolate the curtain's bunching states (`bunchLeft`, `bunchRight`) and anchor offsets during drag-to-enter sequences.
- **Cursor/Touch Interactivity**: Raycasts cursor/touch coordinates to map viewport pixel offsets to 3D world units for interactive grabbing and pulling.

### 2. Custom Pendulum Swing Physics (`js/scenes.js`)

To bring the environment to life, the neon sign hanging above the booth sways organically when hovered or clicked:

- **Gravity Pendulum Equations**: Instead of importing heavy physics engines like `Matter.js` for the sign, a custom lightweight numerical solver computes the pendulum's motion:
  $$\tau = -g \cdot \sin(\theta)$$
  $$\omega_{t} = (\omega_{t-1} + \tau) \cdot d$$
  $$\theta_{t} = \theta_{t-1} + \omega_{t} \cdot \Delta t$$
  _(where $\tau$ is torque, $g$ is gravity constant, $\omega$ is angular velocity, $\theta$ is angle, and $d$ is damping multiplier)._
- **Air Resistance Damping**: Applies a constant damping factor ($0.985$) to simulate air resistance, naturally bringing the swing to rest.
- **User-Induced Impulse**: Clicking the sign inputs a random angular velocity kick alongside a neon flicker animation.

_(Note: Although code comments in CSS and HTML reference `Matter.js` legacy classes, the physics are fully resolved using this custom lightweight implementation to avoid external library bloat)._

### 3. Procedural Paper Substrate Engine (`js/paper.js`)

To replicate the feel of actual paper, the substrate is generated procedurally on demand:

- **Seeded PRNG (LCG)**: Employs a custom Linear Congruential Generator to ensure that while every paper sheet has a completely unique texture, the noise is deterministic during render cycles.
- **Organic Fibers & Wrinkles**: Draws dozens of random tiny curves to simulate organic paper pulp fibers. Simulates wrinkles by drawing high-contrast shadows and highlights along random line segments.
- **Edge Darkening & Vignetting**: Combines linear and radial gradients to darken margins, simulating aging and chemical developer pooling.
- **Paper Styles**: Supports five presets:
    - `vintage` (warm ochre/cream, heavy fibers, medium wrinkles)
    - `glossy` (clean white, low noise, low fibers)
    - `aged` (deep yellow/brown, heavy stains, severe wrinkles)
    - `bw` (neutral gray, medium grain)
    - `polaroid` (warm off-white, light grain, classic wide bottom margin)

### 4. Vintage Photo Processing Engine (`js/filters.js`)

Captured camera frames undergo a multi-pass pixel-manipulation filter pipeline:

- **Grayscale Conversion**: Converts RGB values using standard luma weights ($Y = 0.299R + 0.587G + 0.114B$).
- **Black Point Lifting**: Compresses the dynamic range by pushing the black level upward while preserving highlights ($Y' = Y + k \cdot (1 - Y/255)$), giving the characteristic washed-out retro look.
- **Contrast & Exposure Tuning**: Adjusts contrast around a gray midpoint ($128$) and applies positive or negative exposure offsets to replicate vintage chemistry variance.
- **Warm Split-Toning**: Separates red and blue channel gains to inject warm sepia tones into highlights and cool colors into shadows.
- **Box Blur & Vignette**: Runs a custom box blur algorithm for soft-focus effects, then layers a radial vignette gradient.
- **Film Damage (Grain, Dust, Scratches)**:
    - **Grain**: Adds randomized pixel-level luminance noise.
    - **Dust**: Scatters white specks, black spots, and short curled fibers across the frame.
    - **Scratches**: Draws fine, semi-transparent vertical scratch lines to mimic film roll scratching.

### 5. Interactive Printer Simulation (`js/printer.js`)

When a strip is printed, a custom 2D canvas simulation manages the physical interaction:

- **Motor Jitter**: Simulates printer gear progression by applying an oscillating horizontal displacement offset ($\sin(t \cdot 0.05) \cdot 1.2$) as the strip emerges.
- **Pendulum Swaying**: Once printed, the strip hangs from the slot, swaying under a gravity and angular damping simulation.
- **Grab-and-Tear Physics**: Monitors drag movements down the page. Pulling beyond a threshold ($340\text{px}$) triggers a tear animation where the strip is released and falls downwards out of view, opening the photo strip customizer.

---

## 📂 Project Structure

```
photobooth/
├── assets/                    # Image assets (Draggable posters & decals)
├── css/                       # Modular CSS stylesheets
│   ├── core.css               # Base layout, typography, and theme variables
│   ├── outside.css            # Exterior Japanese alleyway scene layout
│   ├── curtain.css            # 3D curtain container setup
│   ├── printer.css            # Printer slot & mechanical paper layouts
│   └── theme-japanese-light.css # Theme definitions for Japanese Light theme
├── js/                        # Modular JavaScript scripts
│   ├── app.js                 # Global orchestrator and scene director
│   ├── camera.js              # WebRTC camera capture controller
│   ├── cloth.js               # Three.js 3D curtain & Canvas text renderer
│   ├── scenes.js              # Scene transition management & swing physics
│   ├── paper.js               # Procedural paper texture generator
│   ├── filters.js             # Canvas pixel filters (Grain, dust, scratches)
│   ├── strip.js               # Canvas frame compositor
│   └── printer.js             # Printer motor simulation & grab mechanics
├── lib/                       # Vendor libraries
│   ├── three.min.js           # Three.js (r128)
│   └── gsap.min.js            # GSAP (v3)
├── index.html                 # Main markup page
└── style.css                  # Legacy style orchestrator
```

---

## 🚀 Getting Started

1. **Clone the repository** to your local machine.
2. Open `index.html` directly in your browser, or serve it using a local dev server (e.g. `Live Server` in VS Code or `python3 -m http.server`).
3. Ensure you grant **camera permissions** to capture your own vintage photo strips!
