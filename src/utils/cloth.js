/* ============================================================
   cloth.js
   Three.js-driven custom GSAP-animated double curtain simulation.
   Renders split left & right crimson velvet curtains sliding on a metallic rod.
   ============================================================ */

import * as THREE from 'three';
import { gsap } from 'gsap';

export class Cloth {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.active = true;
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

    this.curtainHeight = 2.50;
    this.topY = 2.05;
    const aspect = (canvas.clientWidth || 300) / (canvas.clientHeight || 400);
    this.curtainWidth = 4.6 * aspect * 0.93;

    this.pixelTo3D = this.curtainWidth / (canvas.clientWidth || 300);
    this.closeDX3D = this.opts.closeDX * this.pixelTo3D;

    this.state = {
      bunchLeft: 0,
      bunchRight: 0,
      dragIntensity: 0,
      dragSide: null,
      dragCol: 0,
      dragRow: 0,
      dragX: 0,
      dragY: 0,
    };

    this._initThree();
    this.resize();
  }

  _createCurtainTexture(text) {
    const sheetWidth = this.curtainWidth / 2 + 0.05;
    const sheetHeight = this.curtainHeight;
    const sheetAspect = Math.max(0.1, sheetWidth / sheetHeight);

    const canvas = document.createElement('canvas');
    canvas.height = 1024;
    canvas.width = Math.round(canvas.height * sheetAspect);
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#cc0000');
    bgGrad.addColorStop(0.5, '#800000');
    bgGrad.addColorStop(1, '#3b0000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowColor = 'rgba(255, 255, 255, 0.12)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.strokeStyle = '#0f0f0f';
    ctx.lineWidth = 14;
    ctx.strokeRect(25, 25, canvas.width - 50, canvas.height - 50);

    ctx.lineWidth = 3;
    ctx.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    const fontSize = Math.min(240, Math.round(canvas.width * 0.70));
    ctx.font = `bold ${fontSize}px "Yu Mincho", "Mincho", "SimSun", "STSong", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Golden border/outline
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 16;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
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

  _initThree() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });

    const gl = this.renderer.getContext();
    if (gl && gl.pixelStorei) {
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      } catch (e) {}
    }

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.canvas.clientWidth || 300, this.canvas.clientHeight || 400, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, (this.canvas.clientWidth || 300) / (this.canvas.clientHeight || 400), 0.1, 100);
    this.camera.position.set(0, 0, 6.0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(-2, 4, 3.5);
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4a8eff, 0.9);
    fillLight.position.set(3, -2, 2.5);
    this.scene.add(fillLight);

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

    this.leftMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.leftMaterial);
    this.scene.add(this.leftMesh);

    this.rightMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.rightMaterial);
    this.scene.add(this.rightMesh);

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

    // Reduced hoop rings count (7 rings per curtain sheet instead of 30)
    this.ringCount = 7;
    this.leftRings = [];
    this.rightRings = [];
    this.ringGeom = new THREE.TorusGeometry(0.065, 0.011, 8, 16);
    this.ringGeom.rotateY(Math.PI / 2);
    this.ringMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.22,
      metalness: 0.88
    });

    for (let k = 0; k < this.ringCount; k++) {
      const ringMesh = new THREE.Mesh(this.ringGeom, this.ringMat);
      this.scene.add(ringMesh);
      this.leftRings.push(ringMesh);
    }

    for (let k = 0; k < this.ringCount; k++) {
      const ringMesh = new THREE.Mesh(this.ringGeom, this.ringMat);
      this.scene.add(ringMesh);
      this.rightRings.push(ringMesh);
    }
  }

  _updateCameraFraming() {
    if (!this.canvas || !this.camera) return;
    const aspect = (this.canvas.clientWidth || 300) / (this.canvas.clientHeight || 400);
    this.camera.aspect = aspect;
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

  setAnchorOffset(dx) {
    const maxDragDistance = (this.canvas.clientWidth || 300) * 0.48;
    if (this.state.dragSide === 'left') {
      const targetBunch = Math.max(0, Math.min(1.0, -dx / maxDragDistance));
      gsap.to(this.state, {
        bunchLeft: targetBunch,
        duration: 0.45,
        overwrite: "auto",
        ease: "power2.out"
      });
    } else if (this.state.dragSide === 'right') {
      const targetBunch = Math.max(0, Math.min(1.0, dx / maxDragDistance));
      gsap.to(this.state, {
        bunchRight: targetBunch,
        duration: 0.45,
        overwrite: "auto",
        ease: "power2.out"
      });
    }
  }

  close(direction) {
    if (direction === 'in') {
      gsap.to(this.state, {
        bunchLeft: 1.0,
        bunchRight: 1.0,
        duration: 1.2,
        overwrite: "auto",
        ease: "power2.inOut"
      });
    } else {
      gsap.to(this.state, {
        bunchLeft: 0.0,
        bunchRight: 0.0,
        duration: 1.4,
        overwrite: "auto",
        ease: "elastic.out(1, 0.78)"
      });
    }
  }

  slideOpen(onComplete) {
    const isMobile = window.innerWidth <= 600;
    gsap.to(this.state, {
      bunchLeft: 1.0,
      bunchRight: 1.0,
      duration: isMobile ? 0.4 : 0.5,
      overwrite: "auto",
      ease: "power3.inOut",
      onComplete: () => {
        if (onComplete) onComplete();
      }
    });
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

  _screenToWorld(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const normX = (x / (rect.width || 300)) * 2 - 1;
    const normY = -(y / (rect.height || 400)) * 2 + 1;

    const vec = new THREE.Vector3(normX, normY, 0.5);
    vec.unproject(this.camera);
    const dir = vec.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / dir.z;
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
    return pos;
  }

  handlePointerDown(x, y) {
    const pos = this._screenToWorld(x, y);

    const cols = this.opts.cols;
    const rows = this.opts.rows;

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

    return { side };
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

  handlePointerUp() {
    gsap.to(this.state, {
      dragIntensity: 0.0,
      duration: 0.65,
      overwrite: "auto",
      ease: "power2.out"
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.canvas.clientWidth || 300;
    const h = rect.height || this.canvas.clientHeight || 400;
    const aspect = w / h;
    this.curtainWidth = 4.84 * aspect * 0.93;

    if (this.leftGeometry) this.leftGeometry.dispose();
    this.leftGeometry = new THREE.PlaneGeometry(this.curtainWidth / 2 + 0.05, this.curtainHeight, this.opts.cols - 1, this.opts.rows - 1);
    this.leftMesh.geometry = this.leftGeometry;

    if (this.rightGeometry) this.rightGeometry.dispose();
    this.rightGeometry = new THREE.PlaneGeometry(this.curtainWidth / 2 + 0.05, this.curtainHeight, this.opts.cols - 1, this.opts.rows - 1);
    this.rightMesh.geometry = this.rightGeometry;

    this.updateTextures();

    if (this.barMesh) {
      this.barMesh.scale.set(this.curtainWidth * 1.12, 1, 1);
    }

    this.pixelTo3D = this.curtainWidth / w;
    this.closeDX3D = this.opts.closeDX * this.pixelTo3D;

    this.renderer.setSize(w, h, false);
    this._updateCameraFraming();
  }

  tick(dt) {
    if (!this.active || !this.leftGeometry || !this.rightGeometry) return;

    const dtClamped = Math.min(0.04, dt);
    this.time += dtClamped;

    const prevBunchLeft = this._prevBunchLeft !== undefined ? this._prevBunchLeft : this.state.bunchLeft;
    const leftBunchDir = this.state.bunchLeft - prevBunchLeft;
    this._prevBunchLeft = this.state.bunchLeft;

    const leftDragXDiff = (this.state.dragSide === 'left') ? (this.state.dragX - (this._prevDragXLeft !== undefined ? this._prevDragXLeft : this.state.dragX)) : 0;
    this._prevDragXLeft = this.state.dragX;

    const leftMotionSpeed = Math.abs(leftBunchDir) * 15.0 + Math.abs(leftDragXDiff) * 4.0;
    this.leftMotionIntensity = (this.leftMotionIntensity || 0) * 0.88 + Math.min(1.0, leftMotionSpeed) * 0.12;

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

    const leftPosAttr = this.leftGeometry.attributes.position;
    for (let i = 0; i < pCount; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const u = c / (cols - 1);
      const v = r / (rows - 1);

      const centerGap = 0.08;
      const leftEndIdle = -centerGap / 2;
      const leftEndBunches = -this.curtainWidth / 2 + 0.45;
      const currentLeftEnd = leftEndIdle + (leftEndBunches - leftEndIdle) * this.state.bunchLeft;
      let targetX = -this.curtainWidth / 2 + u * (currentLeftEnd - (-this.curtainWidth / 2)) + Math.cos(u * 7.0) * 0.045 * (1.0 - this.state.bunchLeft) * v;
      let targetY = this.topY - v * this.curtainHeight;
      let targetZ = Math.sin(u * 7.0) * 0.18 * (1.0 - this.state.bunchLeft * 0.85) * v;

      if (this.state.dragIntensity > 0 && this.state.dragSide === 'left') {
        const colDist = Math.abs(c - this.state.dragCol);
        const rowDist = Math.abs(r - this.state.dragRow);

        const wCol = Math.exp(-(colDist * colDist) / 12.0);
        const wRow = Math.exp(-(rowDist * rowDist) / 16.0);
        const weight = wCol * wRow * this.state.dragIntensity;

        let dx = this.state.dragX - targetX;
        let dy = this.state.dragY - targetY;

        const dist = Math.hypot(dx, dy);
        const SOFT_LIMIT = 0.35;

        if (dist > SOFT_LIMIT) {
          const excess = dist - SOFT_LIMIT;
          const resistance = 1 / (1 + excess * 8);
          dx *= resistance;
          dy *= resistance;
        }

        targetX += dx * weight;
        const anchorLock = Math.min(1.0, v * 5.0);
        targetY += dy * weight * anchorLock;
        targetZ += 0.38 * weight * anchorLock;
      }

      const waveFactor = (1.0 - this.state.bunchLeft) * (1.0 - (this.state.dragSide === 'left' ? this.state.dragIntensity * 0.5 : 0));
      const windWaveX = Math.sin(v * 2.5 + this.time * 1.6) * 0.08 * v * waveFactor;
      const windWaveZ = (Math.sin(u * 4.0 + v * 2.5 + this.time * 2.0) * 0.26 + 
                     Math.cos(u * 2.0 - v * 1.5 + this.time * 3.5) * 0.07) * v * waveFactor;

      const motionCurlZ = Math.sin(u * 12.0 + this.time * 8.0) * 0.06 * v * this.leftMotionIntensity * waveFactor;
      const motionSwayX = Math.sin(v * 3.5 - this.time * 6.0) * 0.10 * v * this.leftMotionIntensity * waveFactor;

      const lagX = leftBunchDir * 1.4 * v;

      const finalX = targetX + windWaveX + motionSwayX + lagX;
      const finalY = targetY;
      const finalZ = targetZ + windWaveZ + motionCurlZ;

      leftPosAttr.setXYZ(i, finalX, finalY, finalZ);

      if (r === 0) {
        const ringStep = (cols - 1) / (this.ringCount - 1);
        if (Math.abs((c % ringStep)) < 0.01 || c === cols - 1) {
          const k = Math.min(this.ringCount - 1, Math.round(c / ringStep));
          const ring = this.leftRings[k];
          if (ring) {
            ring.position.set(targetX, this.topY + 0.06, 0);
          }
        }
      }
    }
    leftPosAttr.needsUpdate = true;
    this.leftGeometry.computeVertexNormals();

    const rightPosAttr = this.rightGeometry.attributes.position;
    for (let i = 0; i < pCount; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const u = c / (cols - 1);
      const v = r / (rows - 1);

      const centerGap = 0.08;
      const rightStartIdle = centerGap / 2;
      const rightStartBunches = this.curtainWidth / 2 - 0.45;
      const currentRightStart = rightStartIdle + (rightStartBunches - rightStartIdle) * this.state.bunchRight;
      let targetX = currentRightStart + u * (this.curtainWidth / 2 - currentRightStart) + Math.cos(u * 7.0) * 0.045 * (1.0 - this.state.bunchRight) * v;
      let targetY = this.topY - v * this.curtainHeight;
      let targetZ = Math.sin(u * 7.0) * 0.18 * (1.0 - this.state.bunchRight * 0.85) * v;

      if (this.state.dragIntensity > 0 && this.state.dragSide === 'right') {
        const colDist = Math.abs(c - this.state.dragCol);
        const rowDist = Math.abs(r - this.state.dragRow);

        const wCol = Math.exp(-(colDist * colDist) / 12.0);
        const wRow = Math.exp(-(rowDist * rowDist) / 16.0);
        const weight = wCol * wRow * this.state.dragIntensity;

        let dx = this.state.dragX - targetX;
        let dy = this.state.dragY - targetY;

        const dist = Math.hypot(dx, dy);
        const SOFT_LIMIT = 0.35;

        if (dist > SOFT_LIMIT) {
          const excess = dist - SOFT_LIMIT;
          const resistance = 1 / (1 + excess * 8);
          dx *= resistance;
          dy *= resistance;
        }

        targetX += dx * weight;
        const anchorLock = Math.min(1.0, v * 5.0);
        targetY += dy * weight * anchorLock;
        targetZ += 0.38 * weight * anchorLock;
      }

      const waveFactor = (1.0 - this.state.bunchRight) * (1.0 - (this.state.dragSide === 'right' ? this.state.dragIntensity * 0.5 : 0));
      const windWaveX = Math.sin(v * 2.5 + this.time * 1.6) * 0.08 * v * waveFactor;
      const windWaveZ = (Math.sin(u * 4.0 + v * 2.5 + this.time * 2.0) * 0.26 + 
                     Math.cos(u * 2.0 - v * 1.5 + this.time * 3.5) * 0.07) * v * waveFactor;

      const motionCurlZ = Math.sin(u * 12.0 + this.time * 8.0) * 0.06 * v * this.rightMotionIntensity * waveFactor;
      const motionSwayX = Math.sin(v * 3.5 - this.time * 6.0) * 0.10 * v * this.rightMotionIntensity * waveFactor;

      const lagX = -rightBunchDir * 1.4 * v;

      const finalX = targetX + windWaveX + motionSwayX + lagX;
      const finalY = targetY;
      const finalZ = targetZ + windWaveZ + motionCurlZ;

      rightPosAttr.setXYZ(i, finalX, finalY, finalZ);

      if (r === 0) {
        const ringStep = (cols - 1) / (this.ringCount - 1);
        if (Math.abs((c % ringStep)) < 0.01 || c === cols - 1) {
          const k = Math.min(this.ringCount - 1, Math.round(c / ringStep));
          const ring = this.rightRings[k];
          if (ring) {
            ring.position.set(targetX, this.topY + 0.06, 0);
          }
        }
      }
    }
    rightPosAttr.needsUpdate = true;
    this.rightGeometry.computeVertexNormals();

    this.renderer.render(this.scene, this.camera);
  }
}
