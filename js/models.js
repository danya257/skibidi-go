import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/* ====================================================================
   MATERIALS — toon (cel-shaded) for body, std for metals, basic for glows
   ==================================================================== */

let gradientMap = null;
function getToonGradient() {
  if (gradientMap) return gradientMap;
  const canvas = document.createElement('canvas');
  canvas.width = 5; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ['#2a2238', '#5a4878', '#9080b0', '#d8c8f0', '#ffffff'].forEach((c, i) => {
    ctx.fillStyle = c; ctx.fillRect(i, 0, 1, 1);
  });
  gradientMap = new THREE.CanvasTexture(canvas);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.colorSpace = THREE.NoColorSpace;
  return gradientMap;
}

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color, gradientMap: getToonGradient(),
    emissive: opts.emissive ?? 0x000000,
  });
}
function metal(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.25,
    metalness: opts.metalness ?? 0.85,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}
function glow(color, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity,
    roughness: 0.3, metalness: 0.4,
  });
}
const basic = c => new THREE.MeshBasicMaterial({ color: c });

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, m, s = 20) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m);
const sph = (r, m, s = 20) => new THREE.Mesh(new THREE.SphereGeometry(r, s, s), m);
const torus = (r, t, m, arc = Math.PI * 2, segs = 24) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 14, segs, arc), m);
const cone = (r, h, m, s = 16) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), m);

/* outline pass — add a thin black backface "shell" to each mesh for cel-shading look */
function addOutline(mesh, scale = 1.05) {
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: 0x0a0612, side: THREE.BackSide })
  );
  outline.scale.setScalar(scale);
  mesh.add(outline);
  return mesh;
}

/* ====================================================================
   SCREAMING HEAD — main face used by toilets
   ==================================================================== */
function makeScreamHead(opts = {}) {
  const g = new THREE.Group();
  const skin = opts.skin ?? 0xffe0c8;
  const angry = opts.angry || false;

  const headM = toon(skin);
  const head = sph(0.46, headM, 32);
  head.scale.set(1.05, 1.0, 0.95);
  addOutline(head);
  g.add(head);

  const eyeWhite = basic(0xffffff);
  const pupil = basic(0x000000);
  const shine = basic(0xffffff);
  for (const x of [-0.16, 0.16]) {
    const eyeBg = sph(0.12, eyeWhite, 16);
    eyeBg.position.set(x, 0.08, 0.36);
    eyeBg.scale.set(1, 1.1, 0.7);
    g.add(eyeBg);
    const p = sph(0.06, pupil, 12);
    p.position.set(x, 0.06, 0.44);
    g.add(p);
    const sh = sph(0.024, shine, 8);
    sh.position.set(x + 0.025, 0.11, 0.46);
    g.add(sh);
  }

  if (angry) {
    const brow = metal(0x2a1a14, { roughness: 0.7, metalness: 0.0 });
    for (const [x, rotZ] of [[-0.16, -0.35], [0.16, 0.35]]) {
      const b = box(0.18, 0.04, 0.04, brow);
      b.position.set(x, 0.24, 0.38);
      b.rotation.z = rotZ;
      g.add(b);
    }
  }

  const mouthDark = basic(0x1a0610);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.6), mouthDark);
  mouth.position.set(0, -0.15, 0.32);
  mouth.scale.set(1.2, 1.0, 0.7);
  mouth.rotation.x = -Math.PI / 2;
  g.add(mouth);

  const toothM = basic(0xfffae0);
  for (let i = 0; i < 6; i++) {
    const tTop = box(0.045, 0.06, 0.025, toothM);
    tTop.position.set(-0.14 + i * 0.056, -0.04, 0.42);
    g.add(tTop);
    const tBot = box(0.04, 0.045, 0.025, toothM);
    tBot.position.set(-0.13 + i * 0.054, -0.21, 0.4);
    g.add(tBot);
  }

  const tongue = sph(0.08, basic(0xcc3344), 12);
  tongue.position.set(0, -0.16, 0.36);
  tongue.scale.set(1, 0.5, 1.2);
  g.add(tongue);

  return g;
}

/* ====================================================================
   TOILET
   ==================================================================== */
export function makeToilet(opts = {}) {
  const g = new THREE.Group();
  const pm = toon(opts.color ?? 0xfafaff);
  const accent = opts.accentMetal ?? 0xb8c0d0;
  const accentM = metal(accent, { roughness: 0.2, metalness: 0.9 });

  const tank = box(1.05, 1.0, 0.5, pm);
  tank.position.set(0, 0.7, -0.45);
  addOutline(tank, 1.02); g.add(tank);

  const lid = box(1.12, 0.1, 0.55, pm);
  lid.position.set(0, 1.25, -0.45);
  addOutline(lid, 1.04); g.add(lid);

  const handle = cyl(0.05, 0.05, 0.12, accentM, 12);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.5, 0.95, -0.6);
  g.add(handle);

  const baseLow = cyl(0.5, 0.52, 0.18, pm, 28);
  baseLow.position.set(0, 0.09, 0.05);
  addOutline(baseLow, 1.04); g.add(baseLow);

  const bowl = cyl(0.6, 0.45, 0.45, pm, 28);
  bowl.position.set(0, 0.35, 0.05);
  addOutline(bowl, 1.03); g.add(bowl);

  const rim = torus(0.55, 0.1, pm);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.6, 0.05);
  g.add(rim);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 28),
    new THREE.MeshStandardMaterial({ color: 0x3aaccc, transparent: true, opacity: 0.85, roughness: 0.2, metalness: 0.6, emissive: 0x113344, emissiveIntensity: 0.4 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.585, 0.05);
  g.add(water);

  const ring = torus(0.5, 0.025, accentM);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.6, 0.05);
  g.add(ring);

  const head = makeScreamHead({ skin: opts.skin, angry: opts.angry });
  head.position.set(0, 1.1, 0.08);
  head.rotation.x = -0.08;
  g.add(head); g.userData.head = head;

  if (opts.accessory === 'mic') {
    const stand = cyl(0.025, 0.025, 0.7, metal(0x1a1a22, { metalness: 0.9, roughness: 0.3 }), 8);
    stand.position.set(0, 0.95, 0.6); g.add(stand);
    const ball = sph(0.14, metal(0x222228, { metalness: 0.4, roughness: 0.5 }), 16);
    ball.position.set(0, 1.28, 0.6); g.add(ball);
    const grille = torus(0.14, 0.012, metal(0xcccccc, { metalness: 1, roughness: 0.1 }));
    grille.position.set(0, 1.28, 0.6);
    grille.rotation.y = Math.PI / 2;
    g.add(grille);
  }
  if (opts.accessory === 'headphones') {
    const hpMat = toon(0x1a1a22);
    const band = torus(0.45, 0.05, hpMat, Math.PI);
    band.rotation.x = Math.PI / 2; band.rotation.z = -Math.PI / 2;
    band.position.set(0, 1.45, 0.08); g.add(band);
    for (const s of [-1, 1]) {
      const ear = cyl(0.14, 0.14, 0.09, hpMat, 18);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(s * 0.45, 1.1, 0.08); g.add(ear);
      const pad = cyl(0.13, 0.13, 0.06, toon(0x444), 18);
      pad.rotation.z = Math.PI / 2;
      pad.position.set(s * 0.43, 1.1, 0.08); g.add(pad);
    }
  }
  if (opts.crown) {
    const cm = metal(0xffd700, { metalness: 0.95, roughness: 0.15, emissive: 0x553300, emissiveIntensity: 0.4 });
    const cb = cyl(0.42, 0.46, 0.18, cm, 16);
    cb.position.set(0, 1.62, 0.08); g.add(cb);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tip = cone(0.08, 0.22, cm, 8);
      tip.position.set(Math.cos(a) * 0.42, 1.82, 0.08 + Math.sin(a) * 0.42); g.add(tip);
    }
    const gem = glow(0xff0066, 1.2);
    const gemS = sph(0.09, gem, 16);
    gemS.position.set(0, 1.62, 0.55); g.add(gemS);
  }
  return g;
}

/* ====================================================================
   HUMANOID
   ==================================================================== */
function makeHumanoidBody({ suitColor = 0x1a1a2e, tieColor = 0x991133 } = {}) {
  const g = new THREE.Group();
  const suitM = toon(suitColor);
  const shirtM = toon(0xfafafa);
  const tieM = toon(tieColor);
  const skinM = toon(0xffd0b0);
  const shoeM = metal(0x0a0a14, { metalness: 0.5, roughness: 0.3 });
  const buttonM = metal(0xddddee, { metalness: 1, roughness: 0.1 });

  const torso = box(0.62, 0.85, 0.36, suitM);
  torso.position.set(0, 1.08, 0);
  addOutline(torso, 1.03); g.add(torso);

  const shirt = box(0.3, 0.55, 0.05, shirtM);
  shirt.position.set(0, 1.12, 0.19); g.add(shirt);

  for (const s of [-1, 1]) {
    const lapel = box(0.18, 0.5, 0.04, suitM);
    lapel.position.set(s * 0.18, 1.22, 0.18);
    lapel.rotation.z = s * 0.12;
    g.add(lapel);
  }

  const tie = box(0.09, 0.42, 0.04, tieM);
  tie.position.set(0, 1.05, 0.21); g.add(tie);
  const tieKnot = box(0.1, 0.07, 0.04, tieM);
  tieKnot.position.set(0, 1.32, 0.22); g.add(tieKnot);

  for (let i = 0; i < 3; i++) {
    const btn = cyl(0.025, 0.025, 0.02, buttonM, 10);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(-0.07, 1.08 - i * 0.16, 0.22);
    g.add(btn);
  }

  for (const s of [-1, 1]) {
    const sleeve = cyl(0.1, 0.1, 0.75, suitM, 14);
    sleeve.position.set(s * 0.39, 1.05, 0.05);
    sleeve.rotation.z = s * 0.13;
    addOutline(sleeve, 1.05); g.add(sleeve);
    const cuff = cyl(0.105, 0.11, 0.06, shirtM, 14);
    cuff.position.set(s * 0.44, 0.68, 0.06);
    g.add(cuff);
    const hand = sph(0.11, skinM, 14);
    hand.position.set(s * 0.45, 0.6, 0.06);
    addOutline(hand, 1.05); g.add(hand);
  }

  for (const s of [-1, 1]) {
    const leg = cyl(0.12, 0.12, 0.72, suitM, 14);
    leg.position.set(s * 0.16, 0.3, 0);
    addOutline(leg, 1.04); g.add(leg);
    const shoe = box(0.24, 0.12, 0.36, shoeM);
    shoe.position.set(s * 0.16, -0.08, 0.07); g.add(shoe);
  }

  const neck = cyl(0.085, 0.085, 0.12, skinM, 14);
  neck.position.set(0, 1.55, 0); g.add(neck);

  const pocketHandkerchief = box(0.08, 0.05, 0.02, toon(tieColor));
  pocketHandkerchief.position.set(0.22, 1.28, 0.19);
  g.add(pocketHandkerchief);

  return g;
}

function makeCameraHead({ size = 1, dark = false } = {}) {
  const g = new THREE.Group();
  const bodyM = toon(dark ? 0x0a0a14 : 0x1f1f28);
  const trimM = metal(0xcccccc, { metalness: 1, roughness: 0.15 });
  const glassM = glow(0x4488ff, 0.5);
  const lensM = metal(0x080810, { metalness: 0.95, roughness: 0.05 });

  const body = box(0.78, 0.6, 0.52, bodyM);
  addOutline(body, 1.03); g.add(body);

  const housing = cyl(0.24, 0.27, 0.3, lensM, 28);
  housing.rotation.x = Math.PI / 2; housing.position.set(0, 0, 0.35);
  g.add(housing);
  const outerRing = torus(0.27, 0.025, trimM);
  outerRing.rotation.x = Math.PI / 2; outerRing.position.set(0, 0, 0.5);
  g.add(outerRing);
  const innerRing = torus(0.21, 0.018, trimM);
  innerRing.rotation.x = Math.PI / 2; innerRing.position.set(0, 0, 0.51);
  g.add(innerRing);

  const glass = cyl(0.2, 0.2, 0.04, glassM, 28);
  glass.rotation.x = Math.PI / 2; glass.position.set(0, 0, 0.51);
  g.add(glass);
  const pupilC = sph(0.07, glow(0xff0044, 2.0), 16);
  pupilC.position.set(0, 0, 0.55); g.add(pupilC);

  const mount = box(0.28, 0.14, 0.34, bodyM);
  mount.position.set(0, 0.35, 0); g.add(mount);
  const micShoe = cyl(0.09, 0.09, 0.22, bodyM, 10);
  micShoe.position.set(0, 0.52, 0); g.add(micShoe);
  const micTip = sph(0.06, trimM, 12);
  micTip.position.set(0, 0.65, 0); g.add(micTip);

  const recBtn = sph(0.05, glow(0xff0044, 1.5), 10);
  recBtn.position.set(0.32, 0.2, 0.18); g.add(recBtn);
  const recRing = torus(0.06, 0.012, trimM);
  recRing.position.set(0.32, 0.2, 0.18);
  recRing.rotation.y = Math.PI / 2; g.add(recRing);

  const grip = box(0.08, 0.5, 0.1, toon(0x2a2030));
  grip.position.set(0.43, 0, 0); g.add(grip);

  g.scale.setScalar(size);
  return g;
}

function makeSpeakerHead({ size = 1, dark = false } = {}) {
  const g = new THREE.Group();
  const bodyM = toon(dark ? 0x1a0810 : 0x1f1f28);
  const grillM = toon(0x050505);
  const glowM = glow(0x88ccff, 1.0);
  const trimM = metal(0xcccccc, { metalness: 1, roughness: 0.12 });
  const innerConeM = metal(0x222228, { roughness: 0.4, metalness: 0.7 });

  const body = cyl(0.42, 0.34, 0.55, bodyM, 28);
  body.rotation.x = Math.PI / 2;
  addOutline(body, 1.04); g.add(body);

  const grill = new THREE.Mesh(new THREE.CircleGeometry(0.4, 36), grillM);
  grill.position.set(0, 0, 0.28); g.add(grill);

  const innerCone = cyl(0.32, 0.15, 0.05, innerConeM, 28);
  innerCone.rotation.x = Math.PI / 2; innerCone.position.set(0, 0, 0.3); g.add(innerCone);

  const cap = sph(0.16, glowM, 18);
  cap.position.set(0, 0, 0.34); cap.scale.set(1, 1, 0.5); g.add(cap);

  const outerRim = torus(0.41, 0.03, trimM);
  outerRim.position.set(0, 0, 0.28); g.add(outerRim);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = sph(0.025, trimM, 8);
    s.position.set(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.29);
    g.add(s);
  }

  for (let r = 0.12; r < 0.36; r += 0.06) {
    const ring = torus(r, 0.005, basic(0x222));
    ring.position.set(0, 0, 0.31); g.add(ring);
  }

  g.scale.setScalar(size);
  return g;
}

function makeTVHead({ size = 1, dark = false } = {}) {
  const g = new THREE.Group();
  const caseM = toon(dark ? 0x1a1a22 : 0x707080);
  const trimM = metal(0xcccccc, { metalness: 1, roughness: 0.15 });
  const screenM = glow(0x224488, 0.6);
  const innerM = glow(0x88ccff, 1.2);

  const body = box(0.8, 0.65, 0.55, caseM);
  addOutline(body, 1.03); g.add(body);

  const screenBezel = box(0.68, 0.52, 0.04, trimM);
  screenBezel.position.set(0, 0, 0.27); g.add(screenBezel);
  const screen = box(0.62, 0.46, 0.04, screenM);
  screen.position.set(0, 0, 0.29); g.add(screen);

  for (let i = 0; i < 5; i++) {
    const y = 0.16 - i * 0.08;
    const line = box(0.55, 0.04, 0.02, innerM);
    line.position.set(0, y, 0.31); g.add(line);
  }

  for (const s of [-1, 1]) {
    const ant = cyl(0.018, 0.018, 0.4, trimM, 8);
    ant.position.set(s * 0.18, 0.55, -0.1);
    ant.rotation.z = s * 0.45;
    g.add(ant);
    const tip = sph(0.04, glow(0xffaa00, 1.0), 10);
    tip.position.set(s * 0.34, 0.74, -0.1); g.add(tip);
  }

  for (let i = 0; i < 3; i++) {
    const knob = cyl(0.045, 0.045, 0.05, trimM, 10);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0.42, 0.18 - i * 0.18, 0.08);
    g.add(knob);
  }

  const ledStrip = box(0.5, 0.025, 0.03, glow(0x44ffaa, 1.0));
  ledStrip.position.set(0, -0.27, 0.28); g.add(ledStrip);

  g.scale.setScalar(size);
  return g;
}

function makeHumanoid({ headBuilder, suitColor = 0x1a1a2e, tieColor = 0x991133, headOffset = 1.75, scale = 1, aura = null }) {
  const g = new THREE.Group();
  g.add(makeHumanoidBody({ suitColor, tieColor }));
  const head = headBuilder();
  head.position.set(0, headOffset, 0);
  g.add(head); g.userData.head = head;

  if (aura) {
    const c = aura === 'red' ? 0xff2244 : aura === 'gold' ? 0xffaa33 : 0x6688ff;
    const auraM = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18, side: THREE.BackSide });
    const auraS = sph(1.3, auraM, 24);
    auraS.position.set(0, 1.0, 0); auraS.scale.set(0.7, 1.7, 0.7);
    g.add(auraS); g.userData.aura = auraS;
  }
  g.scale.setScalar(scale);
  return g;
}

/* ====================================================================
   TIER DECORATIONS — added on top after build based on creature level
   ==================================================================== */
export function getTier(level) {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}

const TIER_AURA_COLORS = { 1: 0x6688ff, 2: 0xa78bfa, 3: 0xffd700 };

function addTierDecorations(group, tier) {
  if (tier < 2) return;

  const auraColor = TIER_AURA_COLORS[tier];
  const auraM = new THREE.MeshBasicMaterial({
    color: auraColor, transparent: true, opacity: tier === 3 ? 0.28 : 0.16,
    side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const auraS = sph(1.5, auraM, 24);
  auraS.position.set(0, 1.0, 0);
  auraS.scale.set(0.75, 1.9, 0.75);
  group.add(auraS);
  group.userData.tierAura = auraS;

  const ringMat = new THREE.MeshBasicMaterial({
    color: auraColor, transparent: true, opacity: 0.65,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.95, 48), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.04;
  group.add(ring); group.userData.tierRing = ring;

  if (tier >= 2) {
    const starHolder = new THREE.Group();
    const starCount = tier === 3 ? 3 : 1;
    const starMat = metal(auraColor, { metalness: 1, roughness: 0.05, emissive: auraColor, emissiveIntensity: 1.5 });
    for (let i = 0; i < starCount; i++) {
      const angle = (i / starCount) * Math.PI * 2;
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), starMat);
      star.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
      starHolder.add(star);
    }
    starHolder.position.set(0, 2.0, 0);
    group.add(starHolder); group.userData.tierStars = starHolder;
  }

  if (tier >= 3) {
    const goldRim = metal(0xffd700, { metalness: 0.95, roughness: 0.1, emissive: 0x553300, emissiveIntensity: 0.5 });
    const trim = torus(0.65, 0.05, goldRim);
    trim.rotation.x = Math.PI / 2;
    trim.position.set(0, 0.05, 0);
    group.add(trim);
  }
}

/* ====================================================================
   CHARACTER BUILDERS — accept (level) -> Group with tier decorations
   ==================================================================== */
function build(fn, level = 1) {
  const g = fn();
  addTierDecorations(g, getTier(level));
  return g;
}

export const CHARACTER_BUILDERS = {
  toilet:    (lvl = 1) => build(() => makeToilet({ color: 0xfafaff }), lvl),
  singer:    (lvl = 1) => build(() => makeToilet({ color: 0xfafaff, accessory: 'mic' }), lvl),
  bigtoilet: (lvl = 1) => build(() => { const t = makeToilet({ color: 0xd49060, skin: 0xc88858, angry: true }); t.scale.setScalar(1.3); return t; }, lvl),
  dj:        (lvl = 1) => build(() => makeToilet({ color: 0x222530, accessory: 'headphones', skin: 0xc8a890 }), lvl),
  camera:    (lvl = 1) => build(() => makeHumanoid({ headBuilder: () => makeCameraHead(), suitColor: 0x1a3a4e }), lvl),
  speaker:   (lvl = 1) => build(() => makeHumanoid({ headBuilder: () => makeSpeakerHead(), suitColor: 0x2a3a1e }), lvl),
  tvman:     (lvl = 1) => build(() => makeHumanoid({ headBuilder: () => makeTVHead(), suitColor: 0x3a1e3a }), lvl),
  titancam:  (lvl = 1) => build(() => makeHumanoid({ headBuilder: () => makeCameraHead({ size: 1.3 }), suitColor: 0x0a2a3a, scale: 1.35, headOffset: 1.85, aura: 'blue' }), lvl),
  titansp:   (lvl = 1) => build(() => makeHumanoid({ headBuilder: () => makeSpeakerHead({ size: 1.3 }), suitColor: 0x1a3a0a, scale: 1.35, headOffset: 1.8, aura: 'blue' }), lvl),
  titantv:   (lvl = 1) => build(() => makeHumanoid({ headBuilder: () => makeTVHead({ size: 1.3 }), suitColor: 0x3a0a3a, scale: 1.35, headOffset: 1.85, aura: 'blue' }), lvl),
  gman:      (lvl = 1) => build(() => makeToilet({ color: 0xfff8a0, crown: true, skin: 0xfff0d0, angry: true, accentMetal: 0xffd700 }), lvl),
  darksp:    (lvl = 1) => build(() => makeHumanoid({ headBuilder: () => makeSpeakerHead({ dark: true, size: 1.2 }), suitColor: 0x080812, scale: 1.25, headOffset: 1.8, aura: 'red' }), lvl),
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
  scene.add(new THREE.AmbientLight(0xb0a8d0, 0.6));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.4); key.position.set(3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6688ff, 0.85); rim.position.set(-3, 2, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xff8866, 0.4); fill.position.set(0, -2, 4); scene.add(fill);
}

export function animateTierDecorations(group, t) {
  if (group.userData.tierStars) {
    group.userData.tierStars.rotation.y = t * 1.5;
    group.userData.tierStars.children.forEach((s, i) => {
      s.rotation.x = t * 2;
      s.position.y = Math.sin(t * 3 + i) * 0.06;
    });
  }
  if (group.userData.tierRing) {
    group.userData.tierRing.rotation.z = t * 0.4;
    group.userData.tierRing.material.opacity = 0.5 + Math.sin(t * 2.5) * 0.2;
  }
  if (group.userData.tierAura) {
    const base = group.userData.tierAura.material.opacity;
    group.userData.tierAura.scale.x = 0.75 + Math.sin(t * 1.5) * 0.05;
    group.userData.tierAura.scale.z = 0.75 + Math.cos(t * 1.5) * 0.05;
  }
}
