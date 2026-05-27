import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { CHARACTER_BUILDERS } from './models.js';

let horror = null;
export function startHorror() { if (horror) return; horror = new HorrorGame(); }
export function stopHorror() { if (horror) { horror.destroy(); horror = null; } }

const STATE_PLAY = 0, STATE_WIN = 1, STATE_DEAD = 2;

class HorrorGame {
  constructor() {
    this.canvas = document.getElementById('horror-canvas');
    this.state = STATE_PLAY;
    this.valvesTurned = []; // ['V1','V2',...] in order they were turned
    this.correctOrder = ['V1', 'V2', 'V3'];
    this.exitOpen = false;
    this.hasKey = false;

    this.player = {
      pos: new THREE.Vector3(0, 1.65, 8),
      yaw: Math.PI, pitch: 0,
      vel: new THREE.Vector3(),
      bobT: 0,
    };
    this.inputs = { fwd: 0, strafe: 0, sprint: false };

    this.colliders = []; // {minX, maxX, minZ, maxZ}
    this.interactables = []; // {pos, radius, label, onUse, mesh, taken}
    this.enemy = null;
    this.enemyState = { lastMove: 0, lookedAt: false };

    this.flashIntensity = 6;
    this.flashFlicker = 0;

    this.initRenderer();
    this.initScene();
    this.initLevel();
    this.initControls();
    this.updateHUD();
    this.lastTime = performance.now();
    this.loopFn = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loopFn);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050208);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.13);
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.05, 60);
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  initScene() {
    this.scene.add(new THREE.AmbientLight(0x202028, 0.4));

    // Flashlight (spot, attached to camera)
    const flash = new THREE.SpotLight(0xfff0d0, this.flashIntensity, 22, Math.PI / 4.5, 0.55, 1.2);
    flash.position.set(0, 0, 0);
    flash.target.position.set(0, 0, -1);
    this.camera.add(flash); this.camera.add(flash.target);
    this.scene.add(this.camera);
    this.flash = flash;

    // Distant red emergency light
    const emer = new THREE.PointLight(0xff2233, 0.6, 10, 2);
    emer.position.set(0, 3, -9);
    this.scene.add(emer);
    this.emer = emer;
  }

  // wallBox(centerX, centerZ, sizeX, sizeZ)
  wallBox(cx, cz, sx, sz, mat) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(sx, 3.2, sz), mat);
    w.position.set(cx, 1.6, cz);
    this.scene.add(w);
    this.colliders.push({
      minX: cx - sx/2, maxX: cx + sx/2,
      minZ: cz - sz/2, maxZ: cz + sz/2,
    });
    return w;
  }

  makeWallMat() {
    // Procedural tile texture via canvas
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1410'; ctx.fillRect(0, 0, 256, 256);
    // grout lines
    ctx.fillStyle = '#08060a';
    for (let i = 0; i < 8; i++) { ctx.fillRect(0, i * 32, 256, 3); ctx.fillRect(i * 32, 0, 3, 256); }
    // tile colors with noise
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const shade = 30 + Math.floor(Math.random() * 25);
      ctx.fillStyle = `rgb(${shade + 5},${shade},${shade + 8})`;
      ctx.fillRect(x * 32 + 3, y * 32 + 3, 26, 26);
      // grime
      if (Math.random() < 0.3) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.4})`;
        ctx.fillRect(x * 32 + 3 + Math.random() * 20, y * 32 + 3 + Math.random() * 20, 4, 4);
      }
      // drip
      if (Math.random() < 0.15) {
        ctx.fillStyle = 'rgba(60,30,15,0.6)';
        ctx.fillRect(x * 32 + 10 + Math.random() * 10, y * 32, 2, 8 + Math.random() * 12);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
  }
  makeFloorMat() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1414'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const v = Math.random() * 30;
      ctx.fillStyle = `rgba(${v + 15},${v + 10},${v + 8},0.5)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // cracks
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      let x = Math.random() * 256, y = Math.random() * 256;
      ctx.moveTo(x, y);
      for (let j = 0; j < 8; j++) {
        x += (Math.random() - 0.5) * 50;
        y += (Math.random() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  }

  initLevel() {
    const tileMat = this.makeWallMat();
    const floorMat = this.makeFloorMat();
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0a0808, roughness: 0.95 });

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), floorMat);
    floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.2;
    this.scene.add(ceil);

    // Outer walls (sizes: width along axis × thickness)
    this.wallBox(0, -12, 24, 0.4, tileMat); // north wall
    this.wallBox(0, 12, 24, 0.4, tileMat);  // south wall (door here)
    this.wallBox(-12, 0, 0.4, 24, tileMat); // west
    this.wallBox(12, 0, 0.4, 24, tileMat);  // east

    // Inner pillars (atmosphere + cover)
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0d0a0c, roughness: 0.9 });
    for (const [px, pz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1, 3.2, 1), pillarMat);
      p.position.set(px, 1.6, pz); this.scene.add(p);
      this.colliders.push({ minX: px - 0.5, maxX: px + 0.5, minZ: pz - 0.5, maxZ: pz + 0.5 });
    }

    // Hanging light bulb in center
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffeebb })
    );
    bulb.position.set(0, 2.6, 0);
    this.scene.add(bulb);
    const bulbLight = new THREE.PointLight(0xffeeb0, 1.0, 8, 2);
    bulbLight.position.set(0, 2.5, 0);
    this.scene.add(bulbLight);
    this.bulb = bulb; this.bulbLight = bulbLight;
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.7, 6),
      new THREE.MeshBasicMaterial({ color: 0x111 })
    );
    wire.position.set(0, 2.95, 0); this.scene.add(wire);

    // Valves (3 of them)
    this.addValve(-10, -8, 'V1', 1);
    this.addValve(10, 0, 'V2', 2);
    this.addValve(-10, 8, 'V3', 3);

    // Hint notes on walls
    this.addNote(0, -11.7, 0, 'Поверни вентили\nв порядке цифр\nна стене над ними');
    this.addNote(10, 0, 11.7, 'Если ошибёшься —\nначни сначала');
    this.addNote(-10, 1.7, 0, '...а ОНО\nне любит свет');

    // Exit door (locked initially)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x402010, roughness: 0.8 });
    this.exitDoor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.2), doorMat);
    this.exitDoor.position.set(0, 1.5, 11.99);
    this.scene.add(this.exitDoor);
    // door collider
    this.exitDoorCol = { minX: -1.1, maxX: 1.1, minZ: 11.9, maxZ: 12.1 };
    this.colliders.push(this.exitDoorCol);
    // Exit zone (when door open, walking into this wins)
    this.exitZone = { minX: -1.1, maxX: 1.1, minZ: 11.7, maxZ: 12.3 };

    // Enemy spawn
    this.spawnEnemy();
  }

  addValve(x, z, id, number) {
    const group = new THREE.Group();
    // Pipe
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x555560, roughness: 0.45, metalness: 0.7 });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 16), pipeMat);
    pipe.position.set(0, 0, 0);
    pipe.rotation.x = Math.PI / 2;
    // determine pipe orientation based on which wall
    if (Math.abs(x) > Math.abs(z)) {
      pipe.rotation.z = Math.PI / 2;
      pipe.position.x = x > 0 ? -0.25 : 0.25;
    } else {
      pipe.position.z = z > 0 ? -0.25 : 0.25;
    }
    group.add(pipe);
    // Valve wheel
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xbb2222, roughness: 0.4, metalness: 0.6, emissive: 0x441111 });
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 18), wheelMat);
    group.add(wheel);
    if (Math.abs(x) > Math.abs(z)) wheel.rotation.y = Math.PI / 2;
    // spokes
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), wheelMat);
      spoke.rotation.z = (i / 4) * Math.PI;
      group.add(spoke);
    }
    if (Math.abs(x) > Math.abs(z)) {
      group.children.slice(1).forEach(c => { c.rotation.y = Math.PI / 2; });
    }
    group.position.set(x * 0.97, 1.3, z * 0.97);
    this.scene.add(group);

    // Number above valve (canvas plane)
    const numCanvas = document.createElement('canvas');
    numCanvas.width = 128; numCanvas.height = 128;
    const ctx = numCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#cc1122';
    ctx.strokeStyle = '#440000'; ctx.lineWidth = 6;
    ctx.font = 'bold 100px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(String(number), 64, 64);
    ctx.fillText(String(number), 64, 64);
    const numTex = new THREE.CanvasTexture(numCanvas);
    const numPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshBasicMaterial({ map: numTex, transparent: true })
    );
    numPlane.position.set(x * 0.96, 2.2, z * 0.96);
    if (Math.abs(x) > Math.abs(z)) numPlane.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    else if (z < 0) numPlane.rotation.y = Math.PI;
    this.scene.add(numPlane);

    this.interactables.push({
      pos: new THREE.Vector3(x * 0.85, 1.3, z * 0.85),
      radius: 1.5,
      label: `Повернуть кран ${number}`,
      mesh: group,
      turned: false,
      onUse: () => {
        if (this.interactables.find(i => i.mesh === group).turned) return;
        this.interactables.find(i => i.mesh === group).turned = true;
        // animate spin
        let spin = 0;
        const spinAnim = () => {
          spin += 0.2;
          if (Math.abs(x) > Math.abs(z)) group.children.forEach(c => { if (c !== group.children[0] || true) c.rotation.x = spin; });
          else group.children.forEach(c => { c.rotation.z = spin; });
          if (spin < Math.PI * 2) requestAnimationFrame(spinAnim);
        };
        spinAnim();
        wheelMat.emissive.setHex(0x224422);
        wheelMat.color.setHex(0x44aa44);
        this.valvesTurned.push(id);
        this.checkValveOrder();
      },
    });
  }

  addNote(x, y, z, text) {
    if (y === 0) y = 1.7;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 192;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#dac8a0';
    ctx.fillRect(0, 0, 256, 192);
    // aging
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(${100 + Math.random() * 60},${70 + Math.random() * 40},20,${Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 192, Math.random() * 6, Math.random() * 6);
    }
    ctx.fillStyle = '#222';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    const lines = text.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, 128, 60 + i * 28));
    const tex = new THREE.CanvasTexture(c);
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.55),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 })
    );
    note.position.set(x * 0.97, y, z * 0.97);
    if (z === -12 || z === -11.7) { note.rotation.y = Math.PI; note.position.z = -11.7; }
    if (z === 12 || z === 11.7) { note.position.z = 11.7; }
    if (x === -10) { note.rotation.y = Math.PI / 2; note.position.x = -11.7; }
    if (x === 10) { note.rotation.y = -Math.PI / 2; note.position.x = 11.7; }
    this.scene.add(note);
  }

  spawnEnemy() {
    this.enemy = CHARACTER_BUILDERS.toilet(1);
    this.enemy.scale.setScalar(0.6);
    this.enemy.position.set(0, 0, -8);
    this.enemy.userData.angryEyes = null;
    // Make eyes glow red for horror
    this.enemy.traverse(o => {
      if (o.material && o.material.color && o.material.color.getHex() === 0x000000 && o.geometry?.parameters?.radius === 0.06) {
        o.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      }
    });
    this.scene.add(this.enemy);
    this.enemyHurtTime = 0;
  }

  checkValveOrder() {
    const n = this.valvesTurned.length;
    if (this.valvesTurned[n - 1] !== this.correctOrder[n - 1]) {
      // wrong order — reset
      this.toast('НЕВЕРНЫЙ ПОРЯДОК. Сбрасываю...');
      setTimeout(() => this.resetValves(), 1200);
      return;
    }
    if (n === this.correctOrder.length) {
      this.openExit();
    } else {
      this.toast(`✓ ${n}/3`);
    }
  }
  resetValves() {
    for (const it of this.interactables) {
      if (it.label.startsWith('Повернуть')) {
        it.turned = false;
        const mat = it.mesh.children.find(c => c.material?.color)?.material;
        if (mat) { mat.color.setHex(0xbb2222); mat.emissive.setHex(0x441111); }
      }
    }
    this.valvesTurned = [];
  }
  openExit() {
    this.exitOpen = true;
    this.toast('★ ДВЕРЬ ОТКРЫЛАСЬ ★');
    // remove door collider, slide door up
    this.colliders = this.colliders.filter(c => c !== this.exitDoorCol);
    const startY = this.exitDoor.position.y;
    let t = 0;
    const slide = () => {
      t += 0.016;
      this.exitDoor.position.y = startY + Math.min(t * 1.5, 3);
      if (t < 2) requestAnimationFrame(slide);
    };
    slide();
  }

  initControls() {
    // PC keyboard
    this.keys = {};
    this._kd = e => { this.keys[e.code] = true; if (e.code === 'KeyE') this.tryInteract(); };
    this._ku = e => { this.keys[e.code] = false; };
    document.addEventListener('keydown', this._kd);
    document.addEventListener('keyup', this._ku);

    // Pointer lock for desktop
    this._cm = () => {
      if (this.canvas.requestPointerLock && !document.pointerLockElement) {
        this.canvas.requestPointerLock();
      }
    };
    this.canvas.addEventListener('click', this._cm);
    this._mm = e => {
      if (document.pointerLockElement === this.canvas) {
        this.player.yaw -= e.movementX * 0.0025;
        this.player.pitch -= e.movementY * 0.0025;
        this.player.pitch = Math.max(-1.4, Math.min(1.4, this.player.pitch));
      }
    };
    document.addEventListener('mousemove', this._mm);

    // Mobile: joystick + look pads
    const joy = document.querySelector('.horror-joy');
    const look = document.querySelector('.horror-look');
    this.joyState = { touchId: null, center: null };
    this.lookState = { touchId: null, last: null, moved: 0 };

    this._jt = e => {
      e.preventDefault();
      if (this.joyState.touchId !== null) return;
      const t = e.changedTouches[0];
      this.joyState.touchId = t.identifier;
      this.joyState.center = { x: t.clientX, y: t.clientY };
      const dot = document.querySelector('.horror-joy-dot');
      if (dot) dot.style.transform = 'translate(0, 0)';
    };
    this._jm = e => {
      for (const t of e.touches) {
        if (t.identifier !== this.joyState.touchId) continue;
        const dx = t.clientX - this.joyState.center.x;
        const dy = t.clientY - this.joyState.center.y;
        const max = 45;
        const len = Math.hypot(dx, dy);
        const clamp = Math.min(len, max);
        const fx = len > 0 ? (dx / len) * clamp : 0;
        const fy = len > 0 ? (dy / len) * clamp : 0;
        this.inputs.strafe = fx / max;
        this.inputs.fwd = -fy / max;
        const dot = document.querySelector('.horror-joy-dot');
        if (dot) dot.style.transform = `translate(${fx}px, ${fy}px)`;
      }
    };
    this._je = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyState.touchId) {
          this.joyState.touchId = null;
          this.inputs.strafe = 0; this.inputs.fwd = 0;
          const dot = document.querySelector('.horror-joy-dot');
          if (dot) dot.style.transform = 'translate(0,0)';
        }
      }
    };
    joy?.addEventListener('touchstart', this._jt, { passive: false });
    joy?.addEventListener('touchmove', this._jm, { passive: false });
    joy?.addEventListener('touchend', this._je, { passive: false });
    joy?.addEventListener('touchcancel', this._je, { passive: false });

    this._lt = e => {
      e.preventDefault();
      if (this.lookState.touchId !== null) return;
      const t = e.changedTouches[0];
      this.lookState.touchId = t.identifier;
      this.lookState.last = { x: t.clientX, y: t.clientY };
      this.lookState.moved = 0;
    };
    this._lm = e => {
      for (const t of e.touches) {
        if (t.identifier !== this.lookState.touchId) continue;
        const dx = t.clientX - this.lookState.last.x;
        const dy = t.clientY - this.lookState.last.y;
        this.player.yaw -= dx * 0.006;
        this.player.pitch -= dy * 0.006;
        this.player.pitch = Math.max(-1.4, Math.min(1.4, this.player.pitch));
        this.lookState.last.x = t.clientX; this.lookState.last.y = t.clientY;
        this.lookState.moved += Math.hypot(dx, dy);
      }
    };
    this._le = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.lookState.touchId) {
          if (this.lookState.moved < 12) this.tryInteract();
          this.lookState.touchId = null;
        }
      }
    };
    look?.addEventListener('touchstart', this._lt, { passive: false });
    look?.addEventListener('touchmove', this._lm, { passive: false });
    look?.addEventListener('touchend', this._le, { passive: false });
    look?.addEventListener('touchcancel', this._le, { passive: false });

    // Interact button (mobile)
    const ibtn = document.querySelector('.horror-interact');
    this._ib = () => this.tryInteract();
    ibtn?.addEventListener('click', this._ib);
  }

  tryInteract() {
    const target = this.getInteractTarget();
    if (target) { target.onUse(); }
  }
  getInteractTarget() {
    let best = null, bestDist = Infinity;
    const ppos = this.player.pos;
    const forward = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
    for (const it of this.interactables) {
      if (it.taken) continue;
      const dx = it.pos.x - ppos.x;
      const dz = it.pos.z - ppos.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      // Check angle within ~60° of forward
      const dot = (dx * forward.x + dz * forward.z) / d;
      if (dot < 0.3) continue;
      if (d < bestDist) { best = it; bestDist = d; }
    }
    return best;
  }

  updateHUD() {
    const prompt = document.querySelector('.horror-prompt');
    if (!prompt) return;
    if (this.state !== STATE_PLAY) { prompt.style.display = 'none'; return; }
    const tgt = this.getInteractTarget();
    if (tgt) { prompt.style.display = 'block'; prompt.textContent = `[E / Тап] ${tgt.label}`; }
    else prompt.style.display = 'none';

    const stat = document.querySelector('.horror-status');
    if (stat) stat.textContent = `Кранов: ${this.valvesTurned.length} / 3`;
  }

  toast(msg) {
    const t = document.querySelector('.horror-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 2000);
  }

  collides(x, z) {
    const r = 0.3;
    for (const c of this.colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  update(dt) {
    if (this.state !== STATE_PLAY) return;

    // PC input
    let fwd = this.inputs.fwd, strafe = this.inputs.strafe;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) fwd = 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) fwd = -1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafe = -1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafe = 1;
    const sprint = this.keys['ShiftLeft'] || this.inputs.sprint;
    const speed = sprint ? 4.2 : 2.6;
    const dx = (strafe * Math.cos(this.player.yaw) + fwd * Math.sin(this.player.yaw)) * speed * dt;
    const dz = (-strafe * Math.sin(this.player.yaw) + fwd * Math.cos(this.player.yaw)) * speed * dt;
    // try X then Z (slide)
    let nx = this.player.pos.x + dx;
    let nz = this.player.pos.z + dz;
    if (!this.collides(nx, this.player.pos.z)) this.player.pos.x = nx;
    if (!this.collides(this.player.pos.x, nz)) this.player.pos.z = nz;

    // Walking bob
    const moving = Math.abs(fwd) > 0.05 || Math.abs(strafe) > 0.05;
    if (moving) this.player.bobT += dt * (sprint ? 12 : 8);

    // Camera
    this.camera.position.set(this.player.pos.x, this.player.pos.y + Math.sin(this.player.bobT) * 0.04, this.player.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;

    // Flashlight flicker
    this.flashFlicker += dt;
    if (this.flashFlicker > 0.05) {
      this.flashFlicker = 0;
      this.flash.intensity = this.flashIntensity * (0.85 + Math.random() * 0.3);
    }
    // Bulb flicker
    if (Math.random() < 0.02) {
      this.bulbLight.intensity = 0.2 + Math.random() * 1.2;
      this.bulb.material.color.setHex(Math.random() < 0.5 ? 0xffeebb : 0x442200);
    }

    // Enemy AI — SCP-173 style: moves only when player isn't looking at it
    if (this.enemy) {
      const ex = this.enemy.position.x, ez = this.enemy.position.z;
      const tdx = this.player.pos.x - ex, tdz = this.player.pos.z - ez;
      const dist = Math.hypot(tdx, tdz);
      const forward = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
      const toEnemyDir = { x: -tdx / (dist || 1), z: -tdz / (dist || 1) }; // from player to enemy
      const lookDot = forward.x * toEnemyDir.x + forward.z * toEnemyDir.z;
      const looking = lookDot > 0.6;
      if (!looking && dist > 0.5) {
        const speed = 1.6 * dt;
        const nex = ex + (tdx / dist) * speed;
        const nez = ez + (tdz / dist) * speed;
        if (!this.collides(nex, ez)) this.enemy.position.x = nex;
        if (!this.collides(this.enemy.position.x, nez)) this.enemy.position.z = nez;
      }
      // Face player
      this.enemy.rotation.y = Math.atan2(tdx, tdz);
      // Idle bob
      this.enemy.position.y = Math.sin(performance.now() * 0.003) * 0.05;

      // Catch
      if (dist < 1.0) this.die();
    }

    // Win check
    const p = this.player.pos;
    if (this.exitOpen && p.x > this.exitZone.minX && p.x < this.exitZone.maxX && p.z > this.exitZone.minZ && p.z < this.exitZone.maxZ) {
      this.win();
    }

    this.updateHUD();
  }

  die() {
    this.state = STATE_DEAD;
    const overlay = document.querySelector('.horror-end');
    overlay.classList.add('show'); overlay.classList.add('dead');
    overlay.querySelector('.horror-end-title').textContent = '💀 ПОЙМАН';
    overlay.querySelector('.horror-end-text').textContent = 'Скибиди затащил тебя в унитаз...';
  }
  win() {
    this.state = STATE_WIN;
    const overlay = document.querySelector('.horror-end');
    overlay.classList.add('show'); overlay.classList.add('won');
    overlay.querySelector('.horror-end-title').textContent = '★ ВЫЖИЛ ★';
    overlay.querySelector('.horror-end-text').textContent = 'Тебе удалось сбежать! Награда: +100 💰';
    // Reward via global hook
    if (window._horrorReward) window._horrorReward(100);
  }

  loop(now) {
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loopFn);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this._kd);
    document.removeEventListener('keyup', this._ku);
    document.removeEventListener('mousemove', this._mm);
    this.canvas.removeEventListener('click', this._cm);
    window.removeEventListener('resize', this._onResize);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    // dispose
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    this.renderer.dispose();
  }
}
