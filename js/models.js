import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: opts.roughness ?? 0.55,
  metalness: opts.metalness ?? 0.0,
  emissive: opts.emissive ?? 0x000000,
  emissiveIntensity: opts.emissiveIntensity ?? 1,
});
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, s = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m);
const sph = (r, m, s = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, s, s), m);
const torus = (r, t, m, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 24, arc), m);
const cone = (r, h, m, s = 16) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), m);

function makeScreamHead(opts = {}) {
  const g = new THREE.Group();
  const skin = opts.skin ?? 0xffe0c8;
  const headMat = mat(skin, { roughness: 0.7 });
  const head = sph(0.42, headMat, 32);
  head.scale.set(1, 1.05, 1);
  g.add(head);
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupil = new THREE.MeshBasicMaterial({ color: 0x000000 });
  [[-0.15, 0.1, 0.36], [0.15, 0.1, 0.36]].forEach(([x, y, z]) => {
    const e = sph(0.085, eyeWhite, 12); e.position.set(x, y, z); g.add(e);
    const p = sph(0.05, pupil, 10); p.position.set(x, y, z + 0.025); g.add(p);
  });
  const mouth = sph(0.16, new THREE.MeshBasicMaterial({ color: 0x1a0808 }), 16);
  mouth.position.set(0, -0.12, 0.34);
  mouth.scale.set(1.2, 1.5, 0.5);
  g.add(mouth);
  const toothM = new THREE.MeshBasicMaterial({ color: 0xfff8e0 });
  for (let i = 0; i < 4; i++) {
    const t = box(0.04, 0.05, 0.02, toothM);
    t.position.set(-0.09 + i * 0.06, -0.04, 0.41);
    g.add(t);
  }
  return g;
}

export function makeToilet(opts = {}) {
  const g = new THREE.Group();
  const pm = mat(opts.color ?? 0xfafafe, { roughness: 0.35, metalness: 0.1 });
  const darkM = new THREE.MeshBasicMaterial({ color: 0x0a0a14 });
  const tank = box(1.0, 0.95, 0.45, pm); tank.position.set(0, 0.72, -0.42); g.add(tank);
  const lid = box(1.05, 0.08, 0.5, pm); lid.position.set(0, 1.22, -0.42); g.add(lid);
  const bowl = cyl(0.55, 0.42, 0.55, pm, 28); bowl.position.set(0, 0.37, 0.05); g.add(bowl);
  const rim = torus(0.52, 0.08, pm); rim.rotation.x = Math.PI / 2; rim.position.set(0, 0.67, 0.05); g.add(rim);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), darkM);
  hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.685, 0.05); g.add(hole);
  const base = cyl(0.42, 0.45, 0.25, pm, 24); base.position.set(0, 0.125, 0.05); g.add(base);
  const head = makeScreamHead({ skin: opts.skin });
  head.position.set(0, 1.1, 0.05); head.rotation.x = -0.05;
  g.add(head); g.userData.head = head;

  if (opts.accessory === 'mic') {
    const stand = cyl(0.025, 0.025, 0.6, mat(0x333333, { roughness: 0.4, metalness: 0.7 }), 8);
    stand.position.set(0, 0.95, 0.55); g.add(stand);
    const ball = sph(0.13, mat(0x1a1a1a, { roughness: 0.5 }), 16);
    ball.position.set(0, 1.25, 0.55); g.add(ball);
  }
  if (opts.accessory === 'headphones') {
    const hpMat = mat(0x1a1a1a, { roughness: 0.4 });
    const band = torus(0.42, 0.04, hpMat, Math.PI);
    band.rotation.x = Math.PI / 2; band.rotation.z = -Math.PI / 2;
    band.position.set(0, 1.45, 0.05); g.add(band);
    for (const s of [-1, 1]) {
      const ear = cyl(0.13, 0.13, 0.08, hpMat, 18);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(s * 0.42, 1.1, 0.05); g.add(ear);
    }
  }
  if (opts.crown) {
    const cm = mat(0xffd700, { metalness: 0.95, roughness: 0.15, emissive: 0x553300, emissiveIntensity: 0.3 });
    const cb = cyl(0.4, 0.42, 0.15, cm, 16); cb.position.set(0, 1.6, 0.05); g.add(cb);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tip = cone(0.07, 0.18, cm, 8);
      tip.position.set(Math.cos(a) * 0.4, 1.76, 0.05 + Math.sin(a) * 0.4); g.add(tip);
    }
    const gem = sph(0.08, mat(0xff0066, { roughness: 0.1, metalness: 0.4, emissive: 0xff0066, emissiveIntensity: 0.6 }));
    gem.position.set(0, 1.6, 0.5); g.add(gem);
  }
  return g;
}

function makeHumanoidBody({ suitColor = 0x1a1a2e, tieColor = 0x991111 } = {}) {
  const g = new THREE.Group();
  const suitM = mat(suitColor, { roughness: 0.65 });
  const skinM = mat(0xffd0b0, { roughness: 0.7 });
  const shoeM = mat(0x0a0a14, { roughness: 0.5, metalness: 0.2 });

  const torso = box(0.6, 0.8, 0.35, suitM); torso.position.set(0, 1.05, 0); g.add(torso);
  const shirt = box(0.3, 0.5, 0.05, mat(0xfafafa, { roughness: 0.7 }));
  shirt.position.set(0, 1.1, 0.18); g.add(shirt);
  const tie = box(0.08, 0.4, 0.03, mat(tieColor, { roughness: 0.5 }));
  tie.position.set(0, 1.05, 0.2); g.add(tie);

  for (const s of [-1, 1]) {
    const arm = cyl(0.09, 0.09, 0.75, suitM, 12);
    arm.position.set(s * 0.39, 1.05, 0); arm.rotation.z = s * 0.1; g.add(arm);
    const hand = sph(0.1, skinM, 12);
    hand.position.set(s * 0.42, 0.65, 0); g.add(hand);
  }
  for (const s of [-1, 1]) {
    const leg = cyl(0.11, 0.11, 0.7, suitM, 12);
    leg.position.set(s * 0.15, 0.3, 0); g.add(leg);
    const shoe = box(0.22, 0.1, 0.32, shoeM);
    shoe.position.set(s * 0.15, 0.0, 0.05); g.add(shoe);
  }
  const neck = cyl(0.08, 0.08, 0.1, skinM, 12);
  neck.position.set(0, 1.5, 0); g.add(neck);
  return g;
}

function makeCameraHead({ size = 1, dark = false } = {}) {
  const g = new THREE.Group();
  const bodyM = mat(dark ? 0x101010 : 0x222222, { roughness: 0.4, metalness: 0.5 });
  const lensM = mat(0x0a0a14, { roughness: 0.2, metalness: 0.8 });
  const glassM = mat(0x4488ff, { roughness: 0.1, metalness: 0.9, emissive: 0x114488, emissiveIntensity: 0.4 });

  g.add(box(0.7, 0.55, 0.5, bodyM));
  const housing = cyl(0.22, 0.22, 0.25, lensM, 24);
  housing.rotation.x = Math.PI / 2; housing.position.set(0, 0, 0.32); g.add(housing);
  const glass = cyl(0.18, 0.18, 0.05, glassM, 24);
  glass.rotation.x = Math.PI / 2; glass.position.set(0, 0, 0.46); g.add(glass);
  const rim = torus(0.22, 0.03, bodyM);
  rim.rotation.x = Math.PI / 2; rim.position.set(0, 0, 0.47); g.add(rim);
  const pupil = sph(0.06, mat(0xff0033, { emissive: 0xff0033, emissiveIntensity: 1, roughness: 0.2 }), 12);
  pupil.position.set(0, 0, 0.48); g.add(pupil);
  const mount = box(0.25, 0.12, 0.3, bodyM); mount.position.set(0, 0.33, 0); g.add(mount);
  const micShoe = cyl(0.08, 0.08, 0.2, bodyM, 8); micShoe.position.set(0, 0.5, 0); g.add(micShoe);
  const recBtn = sph(0.04, mat(0xff0033, { emissive: 0xff0033, emissiveIntensity: 0.8 }), 8);
  recBtn.position.set(0.3, 0.18, 0.15); g.add(recBtn);

  g.scale.setScalar(size);
  return g;
}

function makeSpeakerHead({ size = 1, dark = false } = {}) {
  const g = new THREE.Group();
  const bodyM = mat(dark ? 0x1a0808 : 0x222222, { roughness: 0.5, metalness: 0.4 });
  const grillM = mat(0x080808, { roughness: 0.9 });
  const glowM = mat(0x88ccff, { emissive: 0x6699ff, emissiveIntensity: 0.8, roughness: 0.3 });
  const rimM = mat(0xdddddd, { roughness: 0.3, metalness: 0.8 });

  const body = cyl(0.4, 0.32, 0.5, bodyM, 24);
  body.rotation.x = Math.PI / 2; g.add(body);
  const grill = new THREE.Mesh(new THREE.CircleGeometry(0.38, 32), grillM);
  grill.position.set(0, 0, 0.26); g.add(grill);
  const cap = sph(0.13, glowM, 16);
  cap.position.set(0, 0, 0.3); cap.scale.set(1, 1, 0.5); g.add(cap);
  const rim = torus(0.39, 0.025, rimM);
  rim.position.set(0, 0, 0.26); g.add(rim);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const hole = sph(0.04, grillM, 8);
    hole.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.27);
    g.add(hole);
  }
  g.scale.setScalar(size);
  return g;
}

function makeTVHead({ size = 1, dark = false } = {}) {
  const g = new THREE.Group();
  const caseM = mat(dark ? 0x1a1a1a : 0x707080, { roughness: 0.4, metalness: 0.5 });
  const screenM = mat(0x000000, { emissive: 0x224477, emissiveIntensity: 0.4, roughness: 0.05, metalness: 0.9 });
  const lineM = mat(0x88ccff, { emissive: 0x6699ff, emissiveIntensity: 0.7, roughness: 0.2 });

  g.add(box(0.75, 0.6, 0.5, caseM));
  const screen = box(0.6, 0.45, 0.05, screenM); screen.position.set(0, 0, 0.26); g.add(screen);
  for (const y of [0.1, 0, -0.1]) {
    const line = box(0.5, 0.06, 0.02, lineM);
    line.position.set(0, y, 0.29); g.add(line);
  }
  for (const s of [-1, 1]) {
    const ant = cyl(0.015, 0.015, 0.35, caseM, 6);
    ant.position.set(s * 0.15, 0.5, -0.1); ant.rotation.z = s * 0.4; g.add(ant);
    const tip = sph(0.03, mat(0xffaa00, { emissive: 0xffaa00, emissiveIntensity: 0.6 }), 6);
    tip.position.set(s * 0.28, 0.66, -0.1); g.add(tip);
  }
  for (let i = 0; i < 2; i++) {
    const knob = cyl(0.04, 0.04, 0.04, caseM, 8);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0.38, 0.15 - i * 0.2, 0.1); g.add(knob);
  }
  g.scale.setScalar(size);
  return g;
}

function makeHumanoid({ headBuilder, suitColor = 0x1a1a2e, tieColor = 0x991111, headOffset = 1.7, scale = 1, aura = null }) {
  const g = new THREE.Group();
  const body = makeHumanoidBody({ suitColor, tieColor });
  g.add(body);
  const head = headBuilder();
  head.position.set(0, headOffset, 0);
  g.add(head);
  g.userData.head = head;

  if (aura) {
    const auraColor = aura === 'red' ? 0xff2244 : aura === 'gold' ? 0xffaa33 : 0x6688ff;
    const auraM = new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.18, side: THREE.BackSide });
    const auraS = sph(1.2, auraM, 24);
    auraS.position.set(0, 1.0, 0); auraS.scale.set(0.7, 1.6, 0.7);
    g.add(auraS); g.userData.aura = auraS;
  }
  g.scale.setScalar(scale);
  return g;
}

export const CHARACTER_BUILDERS = {
  toilet:    () => makeToilet({ color: 0xfafafe }),
  singer:    () => makeToilet({ color: 0xfafafe, accessory: 'mic' }),
  bigtoilet: () => { const t = makeToilet({ color: 0xd4a060, skin: 0xc89868 }); t.scale.setScalar(1.3); return t; },
  dj:        () => makeToilet({ color: 0x222530, accessory: 'headphones', skin: 0xc8a890 }),
  camera:    () => makeHumanoid({ headBuilder: () => makeCameraHead(), suitColor: 0x1a3a4e }),
  speaker:   () => makeHumanoid({ headBuilder: () => makeSpeakerHead(), suitColor: 0x2a3a1e }),
  tvman:     () => makeHumanoid({ headBuilder: () => makeTVHead(), suitColor: 0x3a1e3a }),
  titancam:  () => makeHumanoid({ headBuilder: () => makeCameraHead({ size: 1.3 }), suitColor: 0x0a2a3a, scale: 1.35, headOffset: 1.8, aura: 'blue' }),
  titansp:   () => makeHumanoid({ headBuilder: () => makeSpeakerHead({ size: 1.3 }), suitColor: 0x1a3a0a, scale: 1.35, headOffset: 1.75, aura: 'blue' }),
  titantv:   () => makeHumanoid({ headBuilder: () => makeTVHead({ size: 1.3 }), suitColor: 0x3a0a3a, scale: 1.35, headOffset: 1.8, aura: 'blue' }),
  gman:      () => makeToilet({ color: 0xfff8a0, crown: true, skin: 0xfff0d0 }),
  darksp:    () => makeHumanoid({ headBuilder: () => makeSpeakerHead({ dark: true, size: 1.2 }), suitColor: 0x080812, scale: 1.25, headOffset: 1.75, aura: 'red' }),
};

export function disposeCharacter(obj) {
  obj.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  });
}

export function setupSceneLights(scene) {
  scene.add(new THREE.AmbientLight(0xb0a8d0, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.3); key.position.set(3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6688ff, 0.7); rim.position.set(-3, 2, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xff8866, 0.35); fill.position.set(0, -2, 4); scene.add(fill);
}
