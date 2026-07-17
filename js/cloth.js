/* ============================================================
   cloth.js
   Three.js-driven custom GSAP-animated double curtain simulation.
   Renders split left & right crimson velvet curtains sliding on a metallic rod.
   ============================================================ */

window.Cloth = (function () {

  class Cloth {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.active = false;                    
      this.time = 0;

      this.opts = Object.assign({
        cols: 16,
        rows: 30,
        baseColor: '#5a1226',
        deepColor: '#2a0712',
        lightColor: '#8a1f3a',
        highlightColor: 'rgba(255,210,180,0.10)',
        stiffness: 0.98,
        damping: 0.18,
        mass: 0.006,
        closeDX: -300,
      }, opts);

      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      // 3D Curtain geometry size constants
      this.curtainHeight = 2.75; // 2.5/4 height curtain
      this.topY = 2.20; // Top edge of the curtain at the rod level
      const aspect = canvas.clientWidth / canvas.clientHeight;
      this.curtainWidth = 4.84 * aspect * 0.93; // Spans full doorway width with side margins

      // Scale helper to map screen pixel offsets to 3D world units
      this.pixelTo3D = this.curtainWidth / canvas.clientWidth;
      this.closeDX3D = this.opts.closeDX * this.pixelTo3D;

      // GSAP-driven state variables for dual curtains
      this.state = {
        bunchLeft: 0,        // 0 = closed (covers left half), 1 = open (bunched far left)
        bunchRight: 0,       // 0 = closed (covers right half), 1 = open (bunched far right)
        
        // Pointer drag states
        dragIntensity: 0,   // current drag influence factor (0 to 1)
        dragSide: null,      // 'left' or 'right' depending on which curtain is grabbed
        dragCol: 0,         // column that is grabbed
        dragRow: 0,         // row that is grabbed
        dragX: 0,           // current 3D drag coordinates X
        dragY: 0,           // current 3D drag coordinates Y
      };

      this._initThree();
      this.resize();
    }

    _createCurtainTexture(text) {
      // Compute the actual aspect ratio of the curtain sheet to keep borders and text from stretching
      const sheetWidth = this.curtainWidth / 2 - 0.09;
      const sheetHeight = this.curtainHeight;
      const sheetAspect = Math.max(0.1, sheetWidth / sheetHeight);

      const canvas = document.createElement('canvas');
      canvas.height = 1024;
      canvas.width = Math.round(canvas.height * sheetAspect);
      const ctx = canvas.getContext('2d');

      // 1. Draw rich velvet bloody red gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGrad.addColorStop(0, '#cc0000');   // bright blood red
      bgGrad.addColorStop(0.5, '#800000'); // deep blood red
      bgGrad.addColorStop(1, '#3b0000');   // dark blood red
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw traditional black double borders with subtle white outline
      ctx.shadowColor = 'rgba(255, 255, 255, 0.12)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.strokeStyle = '#0f0f0f'; // black
      ctx.lineWidth = 14;
      ctx.strokeRect(25, 25, canvas.width - 50, canvas.height - 50);

      ctx.lineWidth = 3;
      ctx.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);

      // 3. Draw calligraphic white character centered in the middle of the sheet
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'; // dark shadow for white text depth
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;

      // Scale character font size dynamically so it never overflows narrow borders
      const fontSize = Math.min(240, Math.round(canvas.width * 0.70));
      ctx.font = `bold ${fontSize}px "Yu Mincho", "Mincho", "SimSun", "STSong", serif`;
      ctx.fillStyle = '#ffffff'; // white
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    }

    updateTextures() {
      if (this.leftTexture) this.leftTexture.dispose();
      this.leftTexture = this._createCurtainTexture('美');
      this.leftMaterial.map = this.leftTexture;
      this.leftMaterial.needsUpdate = true;

      if (this.rightTexture) this.rightTexture.dispose();
      this.rightTexture = this._createCurtainTexture('華');
      this.rightMaterial.map = this.rightTexture;
      this.rightMaterial.needsUpdate = true;
    }

    /* Set up local WebGL Three.js context inside the canvas */
    _initThree() {
      // 1. Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        premultipliedAlpha: false
      });
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);

      // 2. Scene & Camera
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 100);
      this.camera.position.set(0, 0, 6.0);

      // 3. Ambient lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
      this.scene.add(ambientLight);

      // 4. Directional lighting (main keylight + warm side fill)
      const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
      mainLight.position.set(-2, 4, 3.5);
      this.scene.add(mainLight);

      const fillLight = new THREE.DirectionalLight(0x4a8eff, 0.9);
      fillLight.position.set(3, -2, 2.5);
      this.scene.add(fillLight);

      // 5. Materials (textures initialized in resize)
      this.leftMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.82,
        metalness: 0.05,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide
      });

      this.rightMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.82,
        metalness: 0.05,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide
      });

      // 6. Meshes (geometries initialized in resize)
      this.leftMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.leftMaterial);
      this.scene.add(this.leftMesh);

      this.rightMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.rightMaterial);
      this.scene.add(this.rightMesh);

      // 7. Curtain rod/bar (metal cylinder)
      this.barGeom = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 16);
      this.barGeom.rotateZ(Math.PI / 2);
      this.barMat = new THREE.MeshStandardMaterial({
        color: 0xdcdcdc,
        roughness: 0.12,
        metalness: 0.88
      });
      this.barMesh = new THREE.Mesh(this.barGeom, this.barMat);
      this.barMesh.scale.set(this.curtainWidth * 1.12, 1, 1);
      this.barMesh.position.set(0, this.topY + 0.06, 0);
      this.scene.add(this.barMesh);

      // 8. Curtain rings (brass metal toruses, split left & right)
      const cols = this.opts.cols;
      this.leftRings = [];
      this.rightRings = [];
      this.ringGeom = new THREE.TorusGeometry(0.065, 0.011, 8, 16);
      this.ringGeom.rotateY(Math.PI / 2); // Align ring hole with horizontal rod axis (X axis)
      this.ringMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37, // brass/gold
        roughness: 0.22,
        metalness: 0.88
      });

      // Create rings for left curtain
      for (let x = 0; x < cols; x++) {
        const ringMesh = new THREE.Mesh(this.ringGeom, this.ringMat);
        this.scene.add(ringMesh);
        this.leftRings.push(ringMesh);
      }

      // Create rings for right curtain
      for (let x = 0; x < cols; x++) {
        const ringMesh = new THREE.Mesh(this.ringGeom, this.ringMat);
        this.scene.add(ringMesh);
        this.rightRings.push(ringMesh);
      }
    }

    _updateCameraFraming() {
      const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
      this.camera.aspect = aspect;

      // Frame the curtain height and shift camera up slightly so the rod and rings are visible at the top
      const visibleHeight = 4.84;
      this.camera.position.y = 0.065;
      this.camera.fov = 2 * Math.atan((visibleHeight / 2) / this.camera.position.z) * (180 / Math.PI);
      this.camera.updateProjectionMatrix();
    }

    attach() {
      this.active = true;
    }

    detach() {
      this.active = false;
      
      // Clean up WebGL resources
      if (this.leftGeometry) this.leftGeometry.dispose();
      if (this.rightGeometry) this.rightGeometry.dispose();
      
      if (this.leftTexture) this.leftTexture.dispose();
      if (this.rightTexture) this.rightTexture.dispose();
      if (this.leftMaterial) this.leftMaterial.dispose();
      if (this.rightMaterial) this.rightMaterial.dispose();
      
      if (this.barGeom) this.barGeom.dispose();
      if (this.barMat) this.barMat.dispose();
      if (this.ringGeom) this.ringGeom.dispose();
      if (this.ringMat) this.ringMat.dispose();

      if (this.renderer) this.renderer.dispose();
    }

    /* Sets anchor offset (DX) in canvas-local pixels during manual drag */
    setAnchorOffset(dx) {
      const maxDragDistance = this.canvas.clientWidth * 0.38; // drag 38% of screen to bunch fully
      
      if (this.state.dragSide === 'left') {
        const targetBunch = Math.max(0, Math.min(1.0, -dx / maxDragDistance));
        gsap.to(this.state, {
          bunchLeft: targetBunch,
          duration: 0.2,
          overwrite: "auto",
          ease: "power1.out"
        });
      } else {
        const targetBunch = Math.max(0, Math.min(1.0, dx / maxDragDistance));
        gsap.to(this.state, {
          bunchRight: targetBunch,
          duration: 0.2,
          overwrite: "auto",
          ease: "power1.out"
        });
      }
    }

    /* Closes or opens the curtain */
    close(direction) {
      if (direction === 'in') {
        // Bunch both left and right to reveal the camera
        gsap.to(this.state, {
          bunchLeft: 1.0,
          bunchRight: 1.0,
          duration: 1.6,
          overwrite: "auto",
          ease: "power2.inOut"
        });
      } else {
        // Snap both back closed
        gsap.to(this.state, {
          bunchLeft: 0.0,
          bunchRight: 0.0,
          duration: 1.4,
          overwrite: "auto",
          ease: "elastic.out(1, 0.78)"
        });
      }
    }

    reset() {
      gsap.killTweensOf(this.state);
      this.state.bunchLeft = 0;
      this.state.bunchRight = 0;
      this.state.dragIntensity = 0;
      this.state.dragX = 0;
      this.state.dragY = 0;
      this.state.dragSide = null;
    }

    /* Pointer coordinates helper: maps canvas pixel coords to 3D world coords */
    _screenToWorld(x, y) {
      const rect = this.canvas.getBoundingClientRect();
      const normX = (x / rect.width) * 2 - 1;
      const normY = -(y / rect.height) * 2 + 1;

      // Project NDC back into world coordinates at Z=0
      const vec = new THREE.Vector3(normX, normY, 0.5);
      vec.unproject(this.camera);
      const dir = vec.sub(this.camera.position).normalize();
      const distance = -this.camera.position.z / dir.z;
      const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
      return pos;
    }

    /* Pointer interaction handlers */
    handlePointerDown(x, y) {
      const pos = this._screenToWorld(x, y);

      const cols = this.opts.cols;
      const rows = this.opts.rows;

      // Determine which half is grabbed
      const side = pos.x < 0 ? 'left' : 'right';
      this.state.dragSide = side;

      if (side === 'left') {
        const u = Math.max(0, Math.min(1, (pos.x - (-this.curtainWidth / 2)) / (this.curtainWidth / 2)));
        const v = Math.max(0, Math.min(1, (this.topY - pos.y) / this.curtainHeight));
        const col = Math.round(u * (cols - 1));
        const row = Math.round(v * (rows - 1));
        if (row === 0) return null;
        this.state.dragCol = col;
        this.state.dragRow = row;
      } else {
        const u = Math.max(0, Math.min(1, pos.x / (this.curtainWidth / 2)));
        const v = Math.max(0, Math.min(1, (this.topY - pos.y) / this.curtainHeight));
        const col = Math.round(u * (cols - 1));
        const row = Math.round(v * (rows - 1));
        if (row === 0) return null;
        this.state.dragCol = col;
        this.state.dragRow = row;
      }

      this.state.dragX = pos.x;
      this.state.dragY = pos.y;

      gsap.to(this.state, {
        dragIntensity: 1.0,
        duration: 0.35,
        overwrite: "auto",
        ease: "power2.out"
      });

      return { side }; // return truthy handle
    }

    handlePointerMove(x, y) {
      const pos = this._screenToWorld(x, y);
      
      gsap.to(this.state, {
        dragX: pos.x,
        dragY: pos.y,
        duration: 0.18,
        overwrite: "auto",
        ease: "power1.out"
      });
    }

    /* Pointer drag release */
    handlePointerUp() {
      gsap.to(this.state, {
        dragIntensity: 0.0,
        duration: 0.65,
        overwrite: "auto",
        ease: "power2.out"
      });
    }

    /* Handle sizing updates */
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const aspect = rect.width / rect.height;
      this.curtainWidth = 4.84 * aspect * 0.93; // Shrunk to leave gaps on borders

      // Rescale geometries dynamically to match actual aspect width
      if (this.leftGeometry) this.leftGeometry.dispose();
      this.leftGeometry = new THREE.PlaneGeometry(this.curtainWidth / 2 - 0.09, this.curtainHeight, this.opts.cols - 1, this.opts.rows - 1);
      this.leftMesh.geometry = this.leftGeometry;

      if (this.rightGeometry) this.rightGeometry.dispose();
      this.rightGeometry = new THREE.PlaneGeometry(this.curtainWidth / 2 - 0.09, this.curtainHeight, this.opts.cols - 1, this.opts.rows - 1);
      this.rightMesh.geometry = this.rightGeometry;

      // Recreate textures at the new aspect ratio to prevent border/text squashing
      this.updateTextures();

      // Rescale the bar
      if (this.barMesh) {
        this.barMesh.scale.set(this.curtainWidth * 1.12, 1, 1);
      }

      this.pixelTo3D = this.curtainWidth / rect.width;
      this.closeDX3D = this.opts.closeDX * this.pixelTo3D;

      this.renderer.setSize(rect.width, rect.height, false);
      this._updateCameraFraming();
    }

    /* Frame update tick */
    tick(dt) {
      if (!this.active) return;

      const dtClamped = Math.min(0.04, dt);
      this.time += dtClamped;

      // 1. Calculate Left motion speeds & directions
      const prevBunchLeft = this._prevBunchLeft !== undefined ? this._prevBunchLeft : this.state.bunchLeft;
      const leftBunchDir = this.state.bunchLeft - prevBunchLeft;
      this._prevBunchLeft = this.state.bunchLeft;

      const leftDragXDiff = (this.state.dragSide === 'left') ? (this.state.dragX - (this._prevDragXLeft !== undefined ? this._prevDragXLeft : this.state.dragX)) : 0;
      this._prevDragXLeft = this.state.dragX;

      const leftMotionSpeed = Math.abs(leftBunchDir) * 15.0 + Math.abs(leftDragXDiff) * 4.0;
      this.leftMotionIntensity = (this.leftMotionIntensity || 0) * 0.88 + Math.min(1.0, leftMotionSpeed) * 0.12;

      // 2. Calculate Right motion speeds & directions
      const prevBunchRight = this._prevBunchRight !== undefined ? this._prevBunchRight : this.state.bunchRight;
      const rightBunchDir = this.state.bunchRight - prevBunchRight;
      this._prevBunchRight = this.state.bunchRight;

      const rightDragXDiff = (this.state.dragSide === 'right') ? (this.state.dragX - (this._prevDragXRight !== undefined ? this._prevDragXRight : this.state.dragX)) : 0;
      this._prevDragXRight = this.state.dragX;

      const rightMotionSpeed = Math.abs(rightBunchDir) * 15.0 + Math.abs(rightDragXDiff) * 4.0;
      this.rightMotionIntensity = (this.rightMotionIntensity || 0) * 0.88 + Math.min(1.0, rightMotionSpeed) * 0.12;

      const cols = this.opts.cols;
      const rows = this.opts.rows;
      const pCount = cols * rows;

      // ==================== LEFT CURTAIN VERTICES ====================
      const leftPosAttr = this.leftGeometry.attributes.position;
      for (let i = 0; i < pCount; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const u = c / (cols - 1);
        const v = r / (rows - 1);

        // A. Spacing when closed vs bunched left, with a cosine curl factor (scaled by v) to align perfectly with rings at the top (v=0) and a 0.09 gap from the center
        let targetX = -this.curtainWidth / 2 + u * (this.curtainWidth / 2 - 0.09) * (1.025 - this.state.bunchLeft * 0.82) + Math.cos(u * 7.0) * 0.045 * (1.0 - this.state.bunchLeft) * v;
        let targetY = this.topY - v * this.curtainHeight;
        
        // B. Permanent drapery sinus folding: scaled by v so folds are 0 at the top (attaching perfectly to rings) and open up lower down
        let targetZ = Math.sin(u * 7.0) * 0.18 * (1.0 - this.state.bunchLeft * 0.85) * v;

        // C. Apply mouse drag distortion if active on Left side
        if (this.state.dragIntensity > 0 && this.state.dragSide === 'left') {
          const colDist = Math.abs(c - this.state.dragCol);
          const rowDist = Math.abs(r - this.state.dragRow);

          // Gaussian bell curves to smooth falloff of fabric pulling
          const wCol = Math.exp(-(colDist * colDist) / 12.0);
          const wRow = Math.exp(-(rowDist * rowDist) / 16.0);
          const weight = wCol * wRow * this.state.dragIntensity;

          let dx = this.state.dragX - targetX;
          let dy = this.state.dragY - targetY;

          const dist = Math.hypot(dx, dy);

          const SOFT_LIMIT = 0.35;

          if (dist > SOFT_LIMIT) {
            const excess = dist - SOFT_LIMIT;

            // Resistance grows with distance
            const resistance = 1 / (1 + excess * 8);

            dx *= resistance;
            dy *= resistance;
          }

          targetX += dx * weight;
          const anchorLock = Math.min(1.0, v * 5.0);
          targetY += dy * weight * anchorLock;
          targetZ += 0.38 * weight * anchorLock;
        }

        // D. Calculate dynamic waves, dynamic wrinkles (curls), and inertial lag sways
        const waveFactor = (1.0 - this.state.bunchLeft) * (1.0 - (this.state.dragSide === 'left' ? this.state.dragIntensity * 0.5 : 0));
        const windWaveX = Math.sin(v * 2.5 + this.time * 1.6) * 0.08 * v * waveFactor;
        const windWaveZ = (Math.sin(u * 4.0 + v * 2.5 + this.time * 2.0) * 0.26 + 
                       Math.cos(u * 2.0 - v * 1.5 + this.time * 3.5) * 0.07) * v * waveFactor;

        // Extra curls (high-frequency wrinkles) and sways that emerge organically when moving
        const motionCurlZ = Math.sin(u * 12.0 + this.time * 8.0) * 0.06 * v * this.leftMotionIntensity * waveFactor;
        const motionSwayX = Math.sin(v * 3.5 - this.time * 6.0) * 0.10 * v * this.leftMotionIntensity * waveFactor;

        // Inertial lag (bottom of fabric trails behind the top slide action)
        const lagX = leftBunchDir * 1.4 * v;

        const finalX = targetX + windWaveX + motionSwayX + lagX;
        const finalY = targetY;
        const finalZ = targetZ + windWaveZ + motionCurlZ;

        leftPosAttr.setXYZ(i, finalX, finalY, finalZ);

        // E. Sliding rings: Lock Y to rod level, lock Z to 0, ONLY slide sideways along X rod axis
        if (r === 0) {
          const ring = this.leftRings[c];
          if (ring) {
            ring.position.set(targetX, this.topY + 0.06, 0);
          }
        }
      }
      leftPosAttr.needsUpdate = true;
      this.leftGeometry.computeVertexNormals();

      // ==================== RIGHT CURTAIN VERTICES ====================
      const rightPosAttr = this.rightGeometry.attributes.position;
      for (let i = 0; i < pCount; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const u = c / (cols - 1);
        const v = r / (rows - 1);

        // A. Spacing when closed vs bunched right, with a cosine curl factor (scaled by v) to align perfectly with rings at the top (v=0) and a 0.09 gap from the center
        let targetX = (this.curtainWidth / 2) * (this.state.bunchRight * 0.82) + 0.09 * (1.0 - this.state.bunchRight) + u * (this.curtainWidth / 2 - 0.09) * (1.025 - this.state.bunchRight * 0.82) + Math.cos(u * 7.0) * 0.045 * (1.0 - this.state.bunchRight) * v;
        let targetY = this.topY - v * this.curtainHeight;
        
        // B. Permanent drapery sinus folding: scaled by v so folds are 0 at the top (attaching perfectly to rings) and open up lower down
        let targetZ = Math.sin(u * 7.0) * 0.18 * (1.0 - this.state.bunchRight * 0.85) * v;

        // C. Apply mouse drag distortion if active on Right side
        if (this.state.dragIntensity > 0 && this.state.dragSide === 'right') {
          const colDist = Math.abs(c - this.state.dragCol);
          const rowDist = Math.abs(r - this.state.dragRow);

          // Gaussian bell curves to smooth falloff of fabric pulling
          const wCol = Math.exp(-(colDist * colDist) / 12.0);
          const wRow = Math.exp(-(rowDist * rowDist) / 16.0);
          const weight = wCol * wRow * this.state.dragIntensity;

          let dx = this.state.dragX - targetX;
          let dy = this.state.dragY - targetY;

          const dist = Math.hypot(dx, dy);

          const SOFT_LIMIT = 0.35;

          if (dist > SOFT_LIMIT) {
            const excess = dist - SOFT_LIMIT;

            // Resistance grows with distance
            const resistance = 1 / (1 + excess * 8);

            dx *= resistance;
            dy *= resistance;
          }

          targetX += dx * weight;
          const anchorLock = Math.min(1.0, v * 5.0);
          targetY += dy * weight * anchorLock;
          targetZ += 0.38 * weight * anchorLock;
        }

        // D. Calculate dynamic waves, dynamic wrinkles (curls), and inertial lag sways
        const waveFactor = (1.0 - this.state.bunchRight) * (1.0 - (this.state.dragSide === 'right' ? this.state.dragIntensity * 0.5 : 0));
        const windWaveX = Math.sin(v * 2.5 + this.time * 1.6) * 0.08 * v * waveFactor;
        const windWaveZ = (Math.sin(u * 4.0 + v * 2.5 + this.time * 2.0) * 0.26 + 
                       Math.cos(u * 2.0 - v * 1.5 + this.time * 3.5) * 0.07) * v * waveFactor;

        // Extra curls (high-frequency wrinkles) and sways that emerge organically when moving
        const motionCurlZ = Math.sin(u * 12.0 + this.time * 8.0) * 0.06 * v * this.rightMotionIntensity * waveFactor;
        const motionSwayX = Math.sin(v * 3.5 - this.time * 6.0) * 0.10 * v * this.rightMotionIntensity * waveFactor;

        // Inertial lag (bottom of fabric trails behind the top slide action)
        const lagX = -rightBunchDir * 1.4 * v;

        const finalX = targetX + windWaveX + motionSwayX + lagX;
        const finalY = targetY;
        const finalZ = targetZ + windWaveZ + motionCurlZ;

        rightPosAttr.setXYZ(i, finalX, finalY, finalZ);

        // E. Sliding rings: Lock Y to rod level, lock Z to 0, ONLY slide sideways along X rod axis
        if (r === 0) {
          const ring = this.rightRings[c];
          if (ring) {
            ring.position.set(targetX, this.topY + 0.06, 0);
          }
        }
      }
      rightPosAttr.needsUpdate = true;
      this.rightGeometry.computeVertexNormals();

      this.renderer.render(this.scene, this.camera);
    }
  }

  return Cloth;
})();
