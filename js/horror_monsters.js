import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const black = () => new THREE.MeshBasicMaterial({ color: 0x000000 });
const cyl = (rt, rb, h, m, s = 14) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), m);
const sph = (r, m, s = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, s, s), m);

function makeFaceTexture(eyeColor = '#ffe455', grinColor = '#fff8cc') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  // Glow around eyes
  for (const [ex, ey] of [[90, 100], [166, 100]]) {
    const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 36);
    grad.addColorStop(0, eyeColor);
    grad.addColorStop(0.4, eyeColor + 'aa');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(ex - 40, ey - 40, 80, 80);
    // pupil-less hollow eye
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.ellipse(ex, ey, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.ellipse(ex, ey + 1, 5, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Wide grin — arc with vertical teeth
  ctx.strokeStyle = grinColor;
  ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(128, 150, 60, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
  // Inner darkness of mouth
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(128, 150, 52, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineTo(128 + 52 * Math.cos(0.15 * Math.PI), 150 + 52 * Math.sin(0.15 * Math.PI));
  ctx.fill();
  // Teeth (gaps in the grin)
  ctx.strokeStyle = grinColor;
  ctx.lineWidth = 4;
  for (let i = 0; i < 14; i++) {
    const t = 0.15 + (i / 13) * 0.7;
    const a = t * Math.PI;
    const x1 = 128 + 52 * Math.cos(a);
    const y1 = 150 + 52 * Math.sin(a);
    const x2 = 128 + 68 * Math.cos(a);
    const y2 = 150 + 68 * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSmiler() {
  const g = new THREE.Group();
  const bodyM = black();

  // Tall torso
  const torso = cyl(0.24, 0.32, 1.3, bodyM, 16);
  torso.position.y = 1.0; g.add(torso);

  // Hunched shoulders
  const sh = sph(0.36, bodyM, 16);
  sh.position.y = 1.55; sh.scale.set(1.4, 0.5, 1.1); g.add(sh);

  // Large head
  const head = sph(0.34, bodyM, 22);
  head.position.y = 1.95; head.scale.set(1, 1.1, 0.95);
  g.add(head);

  // Face plane with texture (eyes + grin)
  const faceTex = makeFaceTexture();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false })
  );
  face.position.set(0, 1.93, 0.33);
  g.add(face);

  // Long thin arms — angled forward
  for (const s of [-1, 1]) {
    const upper = cyl(0.07, 0.06, 0.7, bodyM, 10);
    upper.position.set(s * 0.32, 1.3, 0.05);
    upper.rotation.z = s * 0.15; g.add(upper);
    const lower = cyl(0.055, 0.045, 0.7, bodyM, 10);
    lower.position.set(s * 0.42, 0.7, 0.18);
    lower.rotation.z = s * 0.25; lower.rotation.x = -0.3; g.add(lower);
    const hand = sph(0.075, bodyM, 12);
    hand.position.set(s * 0.5, 0.4, 0.32); g.add(hand);
    // 4 long bony fingers
    for (let f = 0; f < 4; f++) {
      const finger = cyl(0.013, 0.01, 0.22, bodyM, 6);
      finger.position.set(s * (0.5 + f * 0.015), 0.28, 0.38);
      finger.rotation.x = 0.3 + f * 0.08;
      g.add(finger);
    }
  }

  // Long thin legs
  for (const s of [-1, 1]) {
    const leg = cyl(0.09, 0.07, 0.95, bodyM, 12);
    leg.position.set(s * 0.13, 0.45, 0); g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.28), bodyM);
    foot.position.set(s * 0.13, -0.03, 0.04); g.add(foot);
  }

  // Subtle red aura (you can sense it before you see it)
  const auraM = new THREE.MeshBasicMaterial({
    color: 0xff0022, transparent: true, opacity: 0.08,
    side: THREE.BackSide, blending: THREE.AdditiveBlending,
  });
  const aura = sph(1.6, auraM, 16);
  aura.position.y = 1.1; aura.scale.set(0.55, 1.4, 0.55);
  g.add(aura);
  g.userData.aura = aura;
  g.userData.face = face;
  g.userData.faceTex = faceTex;
  return g;
}

export function animateSmiler(monster, t, dist) {
  // Aura pulse with proximity
  if (monster.userData.aura) {
    const proxScale = dist < 6 ? 1 + (6 - dist) * 0.1 : 1;
    monster.userData.aura.material.opacity = 0.08 + Math.sin(t * 2) * 0.04 + (dist < 6 ? (6 - dist) * 0.03 : 0);
    monster.userData.aura.scale.set(0.55 * proxScale, 1.4 * proxScale, 0.55 * proxScale);
  }
  // Subtle hunching/breathing
  monster.position.y = Math.sin(t * 0.8) * 0.04;
  // Face slightly tilts
  if (monster.userData.face) {
    monster.userData.face.rotation.z = Math.sin(t * 0.5) * 0.04;
  }
}

export function disposeMonster(obj) {
  obj.traverse(c => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (c.material.map) c.material.map.dispose();
      c.material.dispose();
    }
  });
}
