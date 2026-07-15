/* ============================================================
   cloth.js
   Reusable Matter.js cloth simulation.
   Used by the booth entrance curtains (and reusable for any
   future velvet/fabric surface).

   Public API:
     const c = new Cloth(canvas, opts);
     c.attach();        // add bodies/constraints to Physics world
     c.detach();        // remove from world
     c.draw();          // render to canvas (call each frame)
     c.setAnchorOffset(px);   // slide top-row anchors horizontally
     c.close(direction);      // animate toward 'in' (close) or 'out' (open)
     c.handlePointerDown(x,y);
     c.handlePointerMove(x,y);
     c.handlePointerUp();
     c.resize();
   ============================================================ */

window.Cloth = (function () {

  const { M } = window.Physics;
  const { Bodies, Body, Constraint } = M;

  class Cloth {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = Object.assign({
        cols: 10,
        rows: 16,
        spacing: 14,
        anchorY: 6,
        offsetX: 0,           // where to start the cloth horizontally (canvas-local)
        stiffness: 0.16,
        damping: 0.09,        // frictionAir
        mass: 0.025,
        baseColor: '#5a1226', // velvet
        deepColor:   '#2a0712',
        lightColor:  '#8a1f3a',
        highlightColor: 'rgba(255,210,180,0.10)',
        anchorStiffness: 0.94,
      }, opts);

      this.particles = [];
      this.constraints = [];
      this.anchors = [];          // anchor constraints (top row)
      this.dragBody = null;
      this._lastPointer = null;
      this._lastPointerTime = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this._targetAnchorDX = 0;   // 0 = open, +N = slide right, -N = slide left
      this._currentAnchorDX = 0;

      this._build();
      this.resize();
    }

    _build() {
      const { cols, rows, spacing, anchorY, stiffness, damping, mass, offsetX, anchorStiffness } = this.opts;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = offsetX + x * spacing;
          const py = anchorY + y * spacing;
          const body = Bodies.circle(px, py, Math.max(0.5, spacing * 0.28), {
            frictionAir: damping,
            friction: 0.01,
            restitution: 0,
            mass: mass,
            density: 0.002,
            isStatic: false,
            label: 'cloth-particle',
            collisionFilter: { group: -1, category: 0, mask: 0 } // cloth ignores collisions
          });
          body.clothInfo = { col: x, row: y, homeX: px, homeY: py };
          this.particles.push(body);
        }
      }

      // Top-row anchors — pointB is in WORLD space and we animate it
      for (let x = 0; x < cols; x++) {
        const p = this.particles[x];
        const anchor = Constraint.create({
          bodyA: p,
          pointA: { x: 0, y: 0 },
          pointB: { x: p.position.x, y: p.position.y },
          stiffness: anchorStiffness,
          damping: 0.2,
          length: 0,
          render: { visible: false }
        });
        anchor._homeX = p.position.x;
        anchor._homeY = p.position.y;
        this.anchors.push(anchor);
        this.constraints.push(anchor);
      }

      // Structural constraints: horizontal + vertical
      const link = (a, b) => Constraint.create({
        bodyA: a, bodyB: b,
        stiffness: stiffness,
        damping: 0.05,
        length: spacing,
        render: { visible: false }
      });

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols - 1; x++) {
          this.constraints.push(link(this.particles[y * cols + x], this.particles[y * cols + x + 1]));
        }
      }
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols; x++) {
          this.constraints.push(link(this.particles[y * cols + x], this.particles[(y + 1) * cols + x]));
        }
      }

      // Shear constraints (diagonals) — make the cloth less floppy
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
          const a = this.particles[y * cols + x];
          const b = this.particles[(y + 1) * cols + x + 1];
          const c = Constraint.create({
            bodyA: a, bodyB: b,
            stiffness: stiffness * 0.4,
            damping: 0.05,
            length: Math.sqrt(2) * spacing,
            render: { visible: false }
          });
          this.constraints.push(c);
          const d = Constraint.create({
            bodyA: this.particles[y * cols + x + 1],
            bodyB: this.particles[(y + 1) * cols + x],
            stiffness: stiffness * 0.32,
            damping: 0.04,
            length: Math.sqrt(2) * spacing,
            render: { visible: false }
          });
          this.constraints.push(d);
        }
      }
    }

    attach() {
      window.Physics.add(this.particles);
      window.Physics.add(this.constraints);
    }

    detach() {
      window.Physics.remove(this.constraints);
      window.Physics.remove(this.particles);
      this.constraints = [];
      this.particles = [];
      this.anchors = [];
    }

    /* Slide top-row anchors horizontally.
       dx is in canvas-local px; positive = right. */
    setAnchorOffset(dx) {
      this._targetAnchorDX = dx;
    }

    /* direction: 'in' (close) or 'out' (open).
       'in' slides anchors toward the centerline of the entrance. */
    close(direction) {
      // Cloth on the LEFT side closes by sliding anchors RIGHT (+)
      // Cloth on the RIGHT side closes by sliding anchors LEFT  (-)
      // The caller passes the appropriate sign.
      this._targetAnchorDX = direction === 'in' ? this.opts.closeDX : 0;
    }

    /* Update anchor positions every frame (called from a render loop).
       Smoothly lerps currentDX toward targetDX. */
    _updateAnchors(dt) {
      const lerp = 1 - Math.pow(0.001, dt);
      this._currentAnchorDX += (this._targetAnchorDX - this._currentAnchorDX) * lerp;
      for (const a of this.anchors) {
        a.pointB.x = a._homeX + this._currentAnchorDX;
      }
    }

    /* Render the cloth as a shaded velvet surface.
       NOTE: The caller is responsible for clearing the canvas
       before drawing the first cloth (so multiple cloths can
       share a canvas without erasing each other). */
    draw() {
      const ctx = this.ctx;
      const { cols, rows, baseColor, deepColor, lightColor, highlightColor } = this.opts;

      // Build vertex grid in canvas-local coords (no DPR scaling — we set transform)
      const verts = [];
      for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
          const p = this.particles[y * cols + x].position;
          row.push({ x: p.x, y: p.y });
        }
        verts.push(row);
      }

      // Center column index for fold lighting
      const halfCols = (cols - 1) / 2;

      // Fill quads
      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
          const v00 = verts[y][x];
          const v10 = verts[y][x + 1];
          const v01 = verts[y + 1][x];
          const v11 = verts[y + 1][x + 1];

          // Average horizontal distance from "home" — folds pull particles
          // away from their home column, creating shading variation.
          const homeX00 = this.particles[y * cols + x].clothInfo.homeX;
          const homeX11 = this.particles[(y + 1) * cols + (x + 1)].clothInfo.homeX;
          const avgHome = (homeX00 + homeX11) / 2;
          const avgX = (v00.x + v11.x) / 2;
          const fold = (avgX - avgHome); // negative = compressed, positive = stretched

          // Convert fold to a -1..1 shade factor (clamped)
           const shade = Math.max(-1, Math.min(1, fold / 7.5));
          // Compressed folds = darker; stretched = lighter
          const t = shade * 0.5 + 0.5; // 0..1
          const fill = this._mixColor(deepColor, lightColor, t);

          ctx.beginPath();
          ctx.moveTo(v00.x, v00.y);
          ctx.lineTo(v10.x, v10.y);
          ctx.lineTo(v11.x, v11.y);
          ctx.lineTo(v01.x, v01.y);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = fill;
          ctx.lineWidth = 0.85; // bridge subpixel gaps
          ctx.stroke();
        }
      }

      // Vertical velvet sheen highlight (subtle stripe down the center)
      const centerX = this.opts.offsetX + halfCols * this.opts.spacing;
      const grad = ctx.createLinearGradient(centerX - 30, 0, centerX + 30, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, highlightColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

      // Bottom hem — darker weighted strip
      ctx.fillStyle = deepColor;
      const lastRow = verts[rows - 1];
      ctx.beginPath();
      ctx.moveTo(lastRow[0].x, lastRow[0].y);
      for (let x = 1; x < cols; x++) ctx.lineTo(lastRow[x].x, lastRow[x].y);
      for (let x = cols - 1; x >= 0; x--) {
        const v = verts[rows - 2][x];
        ctx.lineTo(v.x, v.y - 2);
      }
      ctx.closePath();
      ctx.fill();
    }

    _mixColor(c1, c2, t) {
      const a = this._hexToRgb(c1);
      const b = this._hexToRgb(c2);
      const r = Math.round(a.r + (b.r - a.r) * t);
      const g = Math.round(a.g + (b.g - a.g) * t);
      const bl = Math.round(a.b + (b.b - a.b) * t);
      return `rgb(${r},${g},${bl})`;
    }

    _hexToRgb(hex) {
      if (hex.startsWith('rgb')) {
        const m = hex.match(/\d+/g);
        return { r: +m[0], g: +m[1], b: +m[2] };
      }
      const h = hex.replace('#', '');
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
      };
    }

    /* Pointer interaction — drag nearest particle */
    handlePointerDown(x, y) {
      let nearest = null;
      let minDist = 44;
      for (const p of this.particles) {
        const dx = p.position.x - x;
        const dy = p.position.y - y;
        const d = Math.hypot(dx, dy);
        if (d < minDist) { minDist = d; nearest = p; }
      }
      this.dragBody = nearest;
      if (nearest) {
        // Temporarily make the grabbed body static so it follows the pointer cleanly
        Body.setStatic(nearest, true);
        this._lastPointer = { x, y, vx: 0, vy: 0 };
        this._lastPointerTime = performance.now();
      }
      return nearest;
    }

    handlePointerMove(x, y) {
      if (!this.dragBody) return;
      const now = performance.now();
      const elapsed = Math.max(16, now - this._lastPointerTime);
      const previous = this._lastPointer || { x, y };
      Body.setPosition(this.dragBody, { x, y });
      Body.setVelocity(this.dragBody, { x: 0, y: 0 });
      this._lastPointer = {
        x, y,
        vx: (x - previous.x) / elapsed * 1000,
        vy: (y - previous.y) / elapsed * 1000
      };
      this._lastPointerTime = now;
    }

    handlePointerUp() {
      if (this.dragBody) {
        Body.setStatic(this.dragBody, false);
        if (this._lastPointer) {
          Body.setVelocity(this.dragBody, {
            x: Math.max(-18, Math.min(18, this._lastPointer.vx)),
            y: Math.max(-18, Math.min(18, this._lastPointer.vy))
          });
        }
        this.dragBody = null;
      }
      this._lastPointer = null;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    /* Called each frame from a centralized rAF loop */
    tick(dt) {
      this._updateAnchors(dt);
      this.draw();
    }
  }

  return Cloth;
})();
