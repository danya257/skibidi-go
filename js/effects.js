import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class EffectsLayer {
  constructor(scene) { this.scene = scene; this.effects = []; }
  add(effect) { if (!effect) return; this.scene.add(effect.mesh); this.effects.push(effect); }
  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      if (!e.update(dt)) {
        this.scene.remove(e.mesh);
        if (e.dispose) e.dispose();
        this.effects.splice(i, 1);
      }
    }
  }
  clear() {
    this.effects.forEach(e => { this.scene.remove(e.mesh); if (e.dispose) e.dispose(); });
    this.effects = [];
  }
}

export function makeShockwave(pos, color = 0x88ccff, opts = {}) {
  const maxScale = opts.maxScale || 8, duration = opts.duration || 0.6;
  const startOpacity = opts.opacity ?? 0.9;
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.4, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: startOpacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  mesh.position.copy(pos); mesh.position.y = Math.max(0.02, pos.y * 0.1);
  mesh.rotation.x = -Math.PI / 2;
  let t = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      const p = t / duration;
      mesh.scale.setScalar(1 + p * maxScale);
      mesh.material.opacity = Math.max(0, startOpacity * (1 - p));
      return p < 1;
    },
    dispose() { mesh.geometry.dispose(); mesh.material.dispose(); }
  };
}

export function makeSphereWave(pos, color = 0x88ccff, opts = {}) {
  const maxScale = opts.maxScale || 5, duration = opts.duration || 0.5;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, wireframe: opts.wireframe || false })
  );
  mesh.position.copy(pos);
  let t = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      const p = t / duration;
      mesh.scale.setScalar(1 + p * maxScale);
      mesh.material.opacity = Math.max(0, 0.7 * (1 - p));
      return p < 1;
    },
    dispose() { mesh.geometry.dispose(); mesh.material.dispose(); }
  };
}

export function makeLaserBeam(from, to, color = 0xff0033) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, len, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.lookAt(to);
  mesh.rotateX(Math.PI / 2);
  let t = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      mesh.material.opacity = Math.max(0, 1 - t * 3);
      mesh.scale.x = mesh.scale.z = 1 + t * 4;
      return t < 0.35;
    },
    dispose() { mesh.geometry.dispose(); mesh.material.dispose(); }
  };
}

export function makeParticleBurst(pos, opts = {}) {
  const count = opts.count || 30, color = opts.color || 0xffaa00;
  const spread = opts.spread || 1.5, lifetime = opts.lifetime || 0.8;
  const gravity = opts.gravity ?? -2, size = opts.size || 0.15;
  const upBias = opts.upBias ?? 1;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i*3] = pos.x; positions[i*3+1] = pos.y; positions[i*3+2] = pos.z;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = (0.4 + Math.random() * 0.8) * spread;
    velocities[i*3] = Math.sin(phi) * Math.cos(theta) * speed;
    velocities[i*3+1] = Math.cos(phi) * speed + upBias;
    velocities[i*3+2] = Math.sin(phi) * Math.sin(theta) * speed;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const mesh = new THREE.Points(geo, mat);
  let t = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i*3] += velocities[i*3] * dt;
        arr[i*3+1] += velocities[i*3+1] * dt;
        arr[i*3+2] += velocities[i*3+2] * dt;
        velocities[i*3+1] += gravity * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - t / lifetime);
      return t < lifetime;
    },
    dispose() { geo.dispose(); mat.dispose(); }
  };
}

export function makeCloud(pos, color = 0x88dd44, opts = {}) {
  const count = opts.count || 8, lifetime = opts.lifetime || 1.4;
  const group = new THREE.Group();
  const parts = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.3 + Math.random() * 0.25, 12, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false })
    );
    m.position.set(
      pos.x + (Math.random() - 0.5) * 0.6,
      pos.y + (Math.random() - 0.5) * 0.6,
      pos.z + (Math.random() - 0.5) * 0.6
    );
    group.add(m);
    parts.push({ mesh: m, drift: { x: (Math.random() - 0.5) * 0.3, y: 0.35 + Math.random() * 0.2, z: (Math.random() - 0.5) * 0.3 } });
  }
  let t = 0;
  return {
    mesh: group,
    update(dt) {
      t += dt;
      const p = t / lifetime;
      parts.forEach(({ mesh, drift }) => {
        mesh.position.x += drift.x * dt;
        mesh.position.y += drift.y * dt;
        mesh.position.z += drift.z * dt;
        mesh.scale.setScalar(1 + p * 0.9);
        mesh.material.opacity = Math.max(0, 0.55 * (1 - p));
      });
      return p < 1;
    },
    dispose() { parts.forEach(p => { p.mesh.geometry.dispose(); p.mesh.material.dispose(); }); }
  };
}

export function makeLightningBolt(from, to, color = 0xffff88) {
  const segments = 7;
  const group = new THREE.Group();
  const meshes = [];
  for (let i = 0; i < segments; i++) {
    const t1 = i / segments, t2 = (i + 1) / segments;
    const p1 = new THREE.Vector3().lerpVectors(from, to, t1);
    const p2 = new THREE.Vector3().lerpVectors(from, to, t2);
    p1.x += (Math.random() - 0.5) * 0.6; p2.x += (Math.random() - 0.5) * 0.6;
    p1.z += (Math.random() - 0.5) * 0.6; p2.z += (Math.random() - 0.5) * 0.6;
    const segLen = p1.distanceTo(p2);
    if (segLen < 0.01) continue;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, segLen, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    cyl.position.copy(p1).add(p2).multiplyScalar(0.5);
    cyl.lookAt(p2); cyl.rotateX(Math.PI / 2);
    group.add(cyl); meshes.push(cyl);
  }
  let t = 0;
  return {
    mesh: group,
    update(dt) {
      t += dt;
      const flicker = (Math.floor(t * 60) % 2) ? 1 : 0.3;
      const op = Math.max(0, (1 - t * 4)) * flicker;
      meshes.forEach(m => { m.material.opacity = op; });
      return t < 0.35;
    },
    dispose() { meshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); }
  };
}

export function makeFloatingGlows(pos, color = 0xff66cc, count = 15) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i*3] = pos.x + (Math.random() - 0.5) * 0.8;
    positions[i*3+1] = pos.y;
    positions[i*3+2] = pos.z + (Math.random() - 0.5) * 0.8;
    velocities[i*3] = (Math.random() - 0.5) * 0.4;
    velocities[i*3+1] = 0.8 + Math.random() * 0.6;
    velocities[i*3+2] = (Math.random() - 0.5) * 0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color, size: 0.32, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Points(geo, mat);
  let t = 0; const lifetime = 1.5;
  return {
    mesh,
    update(dt) {
      t += dt;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i*3] += velocities[i*3] * dt + Math.sin(t * 3 + i) * dt * 0.6;
        arr[i*3+1] += velocities[i*3+1] * dt;
        arr[i*3+2] += velocities[i*3+2] * dt + Math.cos(t * 3 + i) * dt * 0.6;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - t / lifetime);
      return t < lifetime;
    },
    dispose() { geo.dispose(); mat.dispose(); }
  };
}

export function playMoveEffects(moveName, attPos, defPos, addFn, shakeFn) {
  const wait = (ms, fn) => setTimeout(fn, ms);
  switch (moveName) {
    case 'Лазер-зум':
      addFn(makeLaserBeam(attPos, defPos, 0xff0033));
      wait(120, () => {
        addFn(makeParticleBurst(defPos, { color: 0xff6633, count: 30, spread: 1.4, lifetime: 0.55 }));
        addFn(makeSphereWave(defPos, 0xff0033, { maxScale: 3, duration: 0.35 }));
        shakeFn(0.18);
      });
      break;
    case 'Звуковой бум':
      addFn(makeShockwave(defPos, 0x88ccff, { maxScale: 11 }));
      wait(100, () => addFn(makeShockwave(defPos, 0xaaeeff, { maxScale: 8 })));
      wait(200, () => addFn(makeShockwave(defPos, 0xddffff, { maxScale: 5 })));
      shakeFn(0.4);
      break;
    case 'Громовой рёв':
      addFn(makeSphereWave(attPos, 0xffff88, { maxScale: 4, wireframe: true }));
      addFn(makeShockwave(attPos, 0xffff88, { maxScale: 7 }));
      wait(150, () => addFn(makeParticleBurst(defPos, { color: 0xffff44, count: 25, spread: 1.2, lifetime: 0.6 })));
      shakeFn(0.25);
      break;
    case 'Скибиди-рык':
      addFn(makeSphereWave(attPos, 0xff66ff, { maxScale: 3 }));
      addFn(makeShockwave(attPos, 0xff44dd, { maxScale: 6 }));
      addFn(makeFloatingGlows(attPos, 0xff66ff, 10));
      shakeFn(0.12);
      break;
    case 'Сливная атака':
      addFn(makeParticleBurst(attPos, { color: 0x8b5a2b, count: 40, spread: 2, gravity: -3, lifetime: 0.9 }));
      wait(200, () => {
        addFn(makeCloud(defPos, 0x6b3a1b, { count: 6 }));
        shakeFn(0.15);
      });
      break;
    case 'Вонючий газ':
      addFn(makeCloud(defPos, 0x88dd44, { count: 12, lifetime: 1.8 }));
      wait(300, () => addFn(makeCloud(defPos, 0x66bb22, { count: 6, lifetime: 1.4 })));
      break;
    case 'Высокая нота':
      addFn(makeFloatingGlows(attPos, 0xff66cc, 18));
      addFn(makeFloatingGlows(attPos, 0xaa66ff, 12));
      break;
    case 'Бит дропа':
      [0xff00ff, 0x00ffff, 0xffff00].forEach((c, i) => {
        wait(i * 110, () => addFn(makeShockwave(defPos, c, { maxScale: 8 })));
      });
      wait(50, () => addFn(makeParticleBurst(defPos, { color: 0xff00ff, count: 30, spread: 1.5, lifetime: 0.6 })));
      shakeFn(0.45);
      break;
    case 'Слив-таран':
      shakeFn(0.55);
      wait(200, () => {
        addFn(makeParticleBurst(defPos, { color: 0xcccccc, count: 55, spread: 2.5, lifetime: 0.7, gravity: -3 }));
        addFn(makeShockwave(defPos, 0xffffff, { maxScale: 9 }));
        shakeFn(0.3);
      });
      break;
    case 'Удар штативом':
      wait(180, () => {
        addFn(makeParticleBurst(defPos, { color: 0xffaa00, count: 40, spread: 1.6, lifetime: 0.55 }));
        addFn(makeSphereWave(defPos, 0xffaa00, { maxScale: 2.2, duration: 0.3 }));
        shakeFn(0.22);
      });
      break;
    case 'Помеха-удар':
      addFn(makeParticleBurst(defPos, { color: 0xffffff, count: 60, spread: 1.6, lifetime: 0.65 }));
      addFn(makeParticleBurst(defPos, { color: 0x88aaff, count: 30, spread: 1, lifetime: 0.55 }));
      wait(100, () => addFn(makeShockwave(defPos, 0xaaccff, { maxScale: 5 })));
      shakeFn(0.28);
      break;
    case 'Титаническая ярость':
      shakeFn(0.7);
      addFn(makeLightningBolt(new THREE.Vector3(defPos.x, 8, defPos.z), defPos, 0xffff88));
      wait(80, () => addFn(makeLightningBolt(new THREE.Vector3(defPos.x + 0.5, 8, defPos.z + 0.5), defPos, 0xffffff)));
      wait(160, () => addFn(makeLightningBolt(new THREE.Vector3(defPos.x - 0.5, 8, defPos.z - 0.5), defPos, 0xffffaa)));
      wait(240, () => {
        addFn(makeShockwave(defPos, 0xff8800, { maxScale: 13 }));
        addFn(makeSphereWave(defPos, 0xff4400, { maxScale: 5 }));
        addFn(makeParticleBurst(defPos, { color: 0xff8800, count: 90, spread: 3, lifetime: 0.95 }));
        shakeFn(0.55);
      });
      break;
    case 'Тёмная воля':
      addFn(makeCloud(defPos, 0x6600cc, { count: 12, lifetime: 1.6 }));
      addFn(makeParticleBurst(defPos, { color: 0xaa00ff, count: 45, spread: 1.8, lifetime: 0.85 }));
      addFn(makeSphereWave(defPos, 0x8800ff, { maxScale: 4 }));
      wait(200, () => addFn(makeLaserBeam(attPos, defPos, 0xaa00ff)));
      shakeFn(0.3);
      break;
    default:
      addFn(makeParticleBurst(defPos, { color: 0xffffff }));
  }
}

export const MOVE_COLORS = {
  'Скибиди-рык': '#ff66cc',
  'Сливная атака': '#a06030',
  'Высокая нота': '#ff66cc',
  'Слив-таран': '#dddddd',
  'Вонючий газ': '#88dd44',
  'Бит дропа': '#ff00ff',
  'Лазер-зум': '#ff3344',
  'Удар штативом': '#ffaa00',
  'Звуковой бум': '#88ccff',
  'Громовой рёв': '#ffff88',
  'Помеха-удар': '#aaccff',
  'Титаническая ярость': '#ff6600',
  'Тёмная воля': '#aa00ff',
};
