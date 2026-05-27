import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { makeSmiler, animateSmiler, disposeMonster } from './horror_monsters.js';

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
      yaw: 0, pitch: 0,
      vel: new THREE.Vector3(),
      bobT: 0,
      stamina: 100, maxStamina: 100, sprintLocked: false,
      hidden: false, hideSpot: null,
    };
    this.inputs = { fwd: 0, strafe: 0, sprint: false };
    this.notes = []; // collected lore
    this.notesTotal = 0;

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
    this.initAudio();
    this.lastStepT = 0;
    this.lastBeatT = 0;
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
    this.wallBox(0, -12, 24, 0.4, tileMat); // north wall (full)
    // South wall has a gap for the exit door (gap from x=-1.6 to x=1.6)
    this.wallBox(-6.8, 12, 10.4, 0.4, tileMat);  // south-left
    this.wallBox(6.8, 12, 10.4, 0.4, tileMat);   // south-right
    // Door frame top (lintel)
    const lintelMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.7 });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.6), lintelMat);
    lintel.position.set(0, 3.0, 12); this.scene.add(lintel);
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
    this.addNote(0, 1.7, -11.7, 'Поверни вентили\nв порядке цифр\nна стене над ними');
    this.addNote(11.7, 1.7, 5, 'Если ошибёшься —\nначни сначала');
    this.addNote(-11.7, 1.7, 0, '...а ОНО\nне движется\nкогда смотришь');

    // Lore notes (pickable, scattered on the floor)
    this.addLoreNote(-7, -2, 'День 1.\nСвет погас этой ночью.\nВ подвале гудят трубы.');
    this.addLoreNote(3, -9, 'День 3.\nВидел Его за углом.\nТонкий. Высокий. Молчит.\nГлаза светятся.');
    this.addLoreNote(-4, 7, 'День 7.\n«Не моргай. Не отворачивайся.»\nТак сказал предыдущий.\nЕго больше нет.');
    this.addLoreNote(8, 4, 'Если читаешь это —\nоно идёт за тобой.\nОткрой выход.\nНЕ ОБОРАЧИВАЙСЯ.');

    // Exit door (locked initially) — fills the gap in the south wall
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x5a2a10, roughness: 0.5, metalness: 0.3,
      emissive: 0x331100, emissiveIntensity: 0.5,
    });
    this.exitDoor = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.7, 0.3), doorMat);
    this.exitDoor.position.set(0, 1.35, 12);
    this.scene.add(this.exitDoor);
    // Door handle
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xddcc44, metalness: 0.9, roughness: 0.2 })
    );
    handle.position.set(1.2, 1.4, 11.84); this.scene.add(handle);
    // door collider
    this.exitDoorCol = { minX: -1.5, maxX: 1.5, minZ: 11.8, maxZ: 12.2 };
    this.colliders.push(this.exitDoorCol);
    // Exit zone (when door open, walking into this wins)
    this.exitZone = { minX: -1.5, maxX: 1.5, minZ: 11.5, maxZ: 12.5 };

    // EXIT sign above door (glowing red)
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256; signCanvas.height = 96;
    const sctx = signCanvas.getContext('2d');
    sctx.fillStyle = '#0a0000'; sctx.fillRect(0, 0, 256, 96);
    sctx.fillStyle = '#ff2200';
    sctx.font = 'bold 48px Arial';
    sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
    sctx.fillText('ВЫХОД', 128, 48);
    sctx.fillStyle = '#ffaa00';
    sctx.font = 'bold 26px Arial';
    sctx.fillText('↓', 128, 84);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), signMat);
    sign.position.set(0, 2.65, 11.69); sign.rotation.y = Math.PI;
    this.scene.add(sign);
    // Glowing light above door
    const exitLight = new THREE.PointLight(0xff3300, 1.2, 6, 2);
    exitLight.position.set(0, 2.7, 11.5);
    this.scene.add(exitLight);
    this.exitLight = exitLight;

    // Floor arrow pointing to door
    const arrowCanvas = document.createElement('canvas');
    arrowCanvas.width = arrowCanvas.height = 128;
    const actx = arrowCanvas.getContext('2d');
    actx.fillStyle = 'rgba(0,0,0,0)'; actx.fillRect(0, 0, 128, 128);
    actx.fillStyle = '#ff4422';
    actx.beginPath();
    actx.moveTo(64, 110); actx.lineTo(20, 50); actx.lineTo(50, 50);
    actx.lineTo(50, 18); actx.lineTo(78, 18); actx.lineTo(78, 50);
    actx.lineTo(108, 50); actx.closePath(); actx.fill();
    const arrowTex = new THREE.CanvasTexture(arrowCanvas);
    const arrow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2),
      new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false })
    );
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = Math.PI; // point south (+Z)
    arrow.position.set(0, 0.02, 10);
    this.scene.add(arrow);
    this.exitArrow = arrow;

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
        this.playValveTurn();
        // animate spin
        let spin = 0;
        const spinAnim = () => {
          spin += 0.2;
          if (Math.abs(x) > Math.abs(z)) group.children.forEach(c => { c.rotation.x = spin; });
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
    note.position.set(x, y, z);
    // Auto-orient based on which wall is closer
    if (Math.abs(x) > Math.abs(z)) {
      note.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      note.position.x = Math.sign(x) * 11.7;
    } else {
      note.rotation.y = z > 0 ? 0 : Math.PI;
      note.position.z = Math.sign(z || 1) * 11.7;
    }
    this.scene.add(note);
  }

  spawnEnemy() {
    this.enemy = makeSmiler();
    this.enemy.position.set(0, 0, -8);
    this.scene.add(this.enemy);
  }

  addLoreNote(x, z, text) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 192;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8d8a8'; ctx.fillRect(0, 0, 256, 192);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(120,80,30,${Math.random() * 0.45})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 192, 3 + Math.random() * 4, 3 + Math.random() * 4);
    }
    ctx.fillStyle = '#1a1208'; ctx.font = '15px Georgia, serif'; ctx.textAlign = 'center';
    text.split('\n').forEach((l, i) => ctx.fillText(l, 128, 35 + i * 22));
    const tex = new THREE.CanvasTexture(c);
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.42),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, depthWrite: false, transparent: true })
    );
    note.position.set(x, 0.08, z);
    note.rotation.x = -Math.PI / 2 + 0.5;
    note.rotation.z = (Math.random() - 0.5) * 0.6;
    this.scene.add(note);
    // Glowing light to find it in the dark
    const ll = new THREE.PointLight(0xffaa55, 0.7, 2.2, 2);
    ll.position.set(x, 0.4, z);
    this.scene.add(ll);
    this.notesTotal++;
    this.interactables.push({
      pos: new THREE.Vector3(x, 0.3, z),
      radius: 1.2, label: '📜 Подобрать записку',
      mesh: note, light: ll, taken: false,
      onUse: () => {
        const it = this.interactables.find(i => i.mesh === note);
        if (it.taken) return;
        it.taken = true;
        this.scene.remove(note); this.scene.remove(ll);
        note.material.map?.dispose(); note.material.dispose(); note.geometry.dispose();
        this.notes.push(text);
        this.showNote(text);
        this.toast(`📜 Записки: ${this.notes.length} / ${this.notesTotal}`);
        this.playNotePickup();
      },
    });
  }

  showNote(text) {
    const panel = document.querySelector('.horror-note-panel');
    if (!panel) return;
    panel.querySelector('.note-paper-text').textContent = text;
    panel.classList.remove('show'); void panel.offsetWidth;
    panel.classList.add('show');
    clearTimeout(this._noteHideT);
    this._noteHideT = setTimeout(() => panel.classList.remove('show'), 6500);
  }

  playNotePickup() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(g).connect(master);
    osc.start(); osc.stop(ctx.currentTime + 0.42);
  }

  checkValveOrder() {
    const n = this.valvesTurned.length;
    if (this.valvesTurned[n - 1] !== this.correctOrder[n - 1]) {
      // wrong order — reset
      this.playWrong();
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
    this.playDoorOpen();
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
    const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
    for (const it of this.interactables) {
      if (it.taken || it.turned) continue;
      const dx = it.pos.x - ppos.x;
      const dz = it.pos.z - ppos.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      const dot = (dx * fx + dz * fz) / d;
      if (dot < 0.2) continue;
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
    const stam = document.querySelector('.horror-stamina-fill');
    if (stam) {
      const pct = (this.player.stamina / this.player.maxStamina) * 100;
      stam.style.width = pct + '%';
      stam.classList.toggle('low', this.player.stamina < 25);
    }
    const notesEl = document.querySelector('.horror-notes-counter');
    if (notesEl) notesEl.textContent = `📜 ${this.notes.length} / ${this.notesTotal}`;
  }

  toast(msg) {
    const t = document.querySelector('.horror-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 2000);
  }

  /* ============== AUDIO ============== */
  initAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      this.audio = { ctx, master };
      // Resume on first touch (iOS)
      const resume = () => { ctx.resume(); document.removeEventListener('touchstart', resume); document.removeEventListener('click', resume); };
      document.addEventListener('touchstart', resume);
      document.addEventListener('click', resume);
      this.startAmbient();
    } catch (e) { this.audio = null; }
  }
  startAmbient() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    const ambGain = ctx.createGain();
    ambGain.gain.value = 0.18;
    ambGain.connect(master);
    // Low drone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine'; osc1.frequency.value = 55;
    osc1.connect(ambGain);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth'; osc2.frequency.value = 82.5;
    const osc2Gain = ctx.createGain(); osc2Gain.gain.value = 0.12;
    osc2.connect(osc2Gain).connect(ambGain);
    // Slow detune wobble
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 25;
    lfo.connect(lfoGain).connect(osc2.detune);
    // Pink-ish noise
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nd.length; i++) { last = 0.95 * last + 0.05 * (Math.random() * 2 - 1); nd[i] = last * 0.7; }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf; noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 280;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.35;
    noise.connect(lp).connect(noiseGain).connect(ambGain);
    osc1.start(); osc2.start(); lfo.start(); noise.start();
    this.audio.ambient = { ambGain, nodes: [osc1, osc2, lfo, noise] };
  }
  stopAmbient() {
    if (!this.audio?.ambient) return;
    try { this.audio.ambient.nodes.forEach(n => n.stop()); } catch(e) {}
    this.audio.ambient = null;
  }
  playValveTurn() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 4;
    osc.connect(bp).connect(g).connect(master);
    osc.start(); osc.stop(ctx.currentTime + 0.9);
  }
  playWrong() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.65);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(g).connect(master);
    osc.start(); osc.stop(ctx.currentTime + 0.75);
  }
  playDoorOpen() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    // sub rumble
    const osc = ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 45;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
    osc.connect(g).connect(master);
    // metallic creak
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = ctx.createBufferSource(); noise.buffer = nb;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(2400, ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 1.8);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, ctx.currentTime);
    g2.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
    noise.connect(bp).connect(g2).connect(master);
    osc.start(); noise.start();
    osc.stop(ctx.currentTime + 2.3); noise.stop(ctx.currentTime + 2);
  }
  playWin() {
    if (!this.audio) return;
    const notes = [261.6, 329.6, 392.0, 523.2, 659.2];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const { ctx, master } = this.audio;
        const osc = ctx.createOscillator();
        osc.type = 'triangle'; osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc.connect(g).connect(master);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
      }, i * 140);
    });
  }
  playLose() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    // sub-impact
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(140, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.5);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.55, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc1.connect(g1).connect(master);
    osc1.start(); osc1.stop(ctx.currentTime + 0.65);
    // growl with distortion
    setTimeout(() => this.playSkibidiScream(), 200);
  }
  playSkibidiScream() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.9);
    // vibrato
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 70;
    vib.connect(vibGain).connect(osc.frequency);
    // distortion
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 4);
    }
    dist.curve = curve;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    osc.connect(dist).connect(g).connect(master);
    osc.start(); vib.start();
    osc.stop(ctx.currentTime + 1.05); vib.stop(ctx.currentTime + 1.05);
  }
  playFootstep() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.13, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const env = Math.max(0, 1 - (i / d.length) * 4);
      d[i] = (Math.random() * 2 - 1) * env * 0.7;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = ctx.createGain(); g.gain.value = 0.08;
    src.connect(lp).connect(g).connect(master);
    src.start();
  }
  playHeartbeat() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    const playThump = (delay) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(75, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + delay + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(0.45, ctx.currentTime + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
      osc.connect(g).connect(master);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.27);
    };
    playThump(0);
    playThump(0.18);
  }
  destroyAudio() {
    this.stopAmbient();
    if (this.audio?.ctx) { try { this.audio.ctx.close(); } catch(e) {} }
    this.audio = null;
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
    // Stamina-gated sprint
    const wantSprint = this.keys['ShiftLeft'] || this.inputs.sprint;
    const sprint = wantSprint && this.player.stamina > 5 && !this.player.sprintLocked;
    const moving = Math.abs(fwd) > 0.05 || Math.abs(strafe) > 0.05;
    if (sprint && moving) {
      this.player.stamina = Math.max(0, this.player.stamina - dt * 28);
      if (this.player.stamina < 1) this.player.sprintLocked = true;
    } else {
      this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + dt * (moving ? 12 : 22));
      if (this.player.stamina > 30) this.player.sprintLocked = false;
    }
    const speed = sprint ? 4.2 : 2.6;
    const cy = Math.cos(this.player.yaw), sy = Math.sin(this.player.yaw);
    // Camera-aligned: forward = (-sin, 0, -cos), right = (cos, 0, -sin)
    const dx = (strafe * cy - fwd * sy) * speed * dt;
    const dz = (-strafe * sy - fwd * cy) * speed * dt;
    // try X then Z (slide)
    let nx = this.player.pos.x + dx;
    let nz = this.player.pos.z + dz;
    if (!this.collides(nx, this.player.pos.z)) this.player.pos.x = nx;
    if (!this.collides(this.player.pos.x, nz)) this.player.pos.z = nz;

    // Walking bob + footstep audio
    if (moving) {
      this.player.bobT += dt * (sprint ? 12 : 8);
      const stepInterval = sprint ? 0.32 : 0.45;
      this.lastStepT += dt;
      if (this.lastStepT > stepInterval) { this.playFootstep(); this.lastStepT = 0; }
    } else {
      this.lastStepT = 0;
    }

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
      const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
      // direction from player to enemy
      const toEnemyX = -tdx / (dist || 1), toEnemyZ = -tdz / (dist || 1);
      const lookDot = fx * toEnemyX + fz * toEnemyZ;
      const looking = lookDot > 0.55;
      if (!looking && dist > 0.5) {
        const speed = 1.6 * dt;
        const nex = ex + (tdx / dist) * speed;
        const nez = ez + (tdz / dist) * speed;
        if (!this.collides(nex, ez)) this.enemy.position.x = nex;
        if (!this.collides(this.enemy.position.x, nez)) this.enemy.position.z = nez;
      }
      // Face player
      this.enemy.rotation.y = Math.atan2(tdx, tdz);
      // Smiler idle: subtle breathing + aura pulse
      animateSmiler(this.enemy, performance.now() * 0.001, dist);

      // Heartbeat scales with proximity (8m → silent, 1m → urgent)
      if (dist < 8) {
        const beatInterval = Math.max(0.45, 0.45 + (dist - 1) * 0.18);
        this.lastBeatT += dt;
        if (this.lastBeatT > beatInterval) { this.playHeartbeat(); this.lastBeatT = 0; }
      }

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
    if (this.state !== STATE_PLAY) return;
    this.state = STATE_DEAD;
    this.stopAmbient();
    // JUMPSCARE: snap enemy into camera face
    if (this.enemy) {
      const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
      this.enemy.position.set(
        this.player.pos.x + fx * 0.55,
        this.player.pos.y - 0.6,
        this.player.pos.z + fz * 0.55
      );
      this.enemy.scale.setScalar(2.5);
      this.enemy.rotation.y = this.player.yaw + Math.PI;
      // Boost aura to red blast
      if (this.enemy.userData.aura) {
        this.enemy.userData.aura.material.opacity = 0.6;
        this.enemy.userData.aura.material.color.setHex(0xff0033);
      }
    }
    // Brighten flashlight to white-out then fade
    if (this.flash) this.flash.intensity = 30;
    // Hard camera shake
    this.jumpscareShake = 0.6;
    // Red strobe overlay
    const flash = document.querySelector('.horror-jumpscare');
    if (flash) { flash.classList.remove('active'); void flash.offsetWidth; flash.classList.add('active'); }
    // LOUD scream
    this.playJumpscare();
    // After delay → death screen
    setTimeout(() => {
      const overlay = document.querySelector('.horror-end');
      if (overlay) {
        overlay.classList.add('show', 'dead');
        overlay.querySelector('.horror-end-title').textContent = '💀 ПОЙМАН';
        overlay.querySelector('.horror-end-text').textContent = 'Скибиди затащил тебя в унитаз...';
      }
    }, 1400);
  }
  playJumpscare() {
    if (!this.audio) return;
    const { ctx, master } = this.audio;
    // Boost master briefly
    const orig = master.gain.value;
    master.gain.setValueAtTime(1.0, ctx.currentTime);
    setTimeout(() => { if (this.audio) master.gain.setValueAtTime(orig, ctx.currentTime); }, 1500);

    // 1. Heavy sub-impact (BOOM)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(220, ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(24, ctx.currentTime + 0.5);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.95, ctx.currentTime);
    subG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    sub.connect(subG).connect(master);
    sub.start(); sub.stop(ctx.currentTime + 0.75);

    // 2. White-noise smack (very loud, brief)
    const nb = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) {
      const env = Math.max(0, 1 - (i / nd.length) * 2.2);
      nd[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource(); noise.buffer = nb;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
    const ng = ctx.createGain(); ng.gain.value = 0.85;
    noise.connect(hp).connect(ng).connect(master);
    noise.start();

    // 3. Heavily distorted multi-osc scream — stack of sawtooths with vibrato
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const x = (i / 256) - 1;
      curve[i] = Math.tanh(x * 12);
    }
    dist.curve = curve;
    dist.oversample = '4x';
    const screamG = ctx.createGain();
    screamG.gain.setValueAtTime(0, ctx.currentTime);
    screamG.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.05);
    screamG.gain.setValueAtTime(0.55, ctx.currentTime + 0.9);
    screamG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
    dist.connect(screamG).connect(master);
    for (const detune of [-25, -8, 7, 22]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, ctx.currentTime + 0.04);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.3);
      osc.frequency.linearRampToValueAtTime(420, ctx.currentTime + 0.7);
      osc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 1.3);
      osc.detune.value = detune;
      const vib = ctx.createOscillator();
      vib.type = 'sine'; vib.frequency.value = 22;
      const vibG = ctx.createGain(); vibG.gain.value = 110;
      vib.connect(vibG).connect(osc.frequency);
      osc.connect(dist);
      vib.start(); osc.start();
      vib.stop(ctx.currentTime + 1.4); osc.stop(ctx.currentTime + 1.4);
    }
  }
  jumpscareUpdate() {
    if (this.jumpscareShake > 0) {
      const s = this.jumpscareShake;
      this.camera.position.x = this.player.pos.x + (Math.random() - 0.5) * s;
      this.camera.position.y = this.player.pos.y + (Math.random() - 0.5) * s;
      this.camera.position.z = this.player.pos.z + (Math.random() - 0.5) * s;
      // wobble rotation too
      this.camera.rotation.x = this.player.pitch + (Math.random() - 0.5) * s * 0.5;
      this.camera.rotation.z = (Math.random() - 0.5) * s * 0.5;
      this.jumpscareShake *= 0.93;
      if (this.jumpscareShake < 0.01) this.jumpscareShake = 0;
    }
  }
  win() {
    this.state = STATE_WIN;
    this.playWin();
    this.stopAmbient();
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
    if (this.state === STATE_DEAD) this.jumpscareUpdate();
    if (this.exitLight) {
      this.exitLight.intensity = 1.0 + Math.sin(performance.now() * 0.005) * 0.5;
    }
    if (this.exitArrow) {
      this.exitArrow.material.opacity = 0.5 + Math.sin(performance.now() * 0.006) * 0.4;
      this.exitArrow.material.transparent = true;
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loopFn);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.destroyAudio();
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
