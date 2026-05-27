import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { CHARACTER_BUILDERS, setupSceneLights, disposeCharacter, getTier, animateTierDecorations } from './models.js';
import { EffectsLayer, playMoveEffects, makeParticleBurst, makeShockwave, makeSphereWave, makeFloatingGlows } from './effects.js';

let spriteRenderer = null, spriteScene = null, spriteCamera = null;
const spriteCache = {};

function initSpriteRenderer() {
  spriteRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  spriteRenderer.setPixelRatio(2);
  spriteRenderer.setSize(128, 128);
  spriteRenderer.outputColorSpace = THREE.SRGBColorSpace;
  spriteScene = new THREE.Scene();
  setupSceneLights(spriteScene);
  spriteCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  spriteCamera.position.set(2.8, 1.7, 3.5);
  spriteCamera.lookAt(0, 1.0, 0);
}

export function renderSpriteForSpecies(speciesKey, level = 1) {
  const tier = getTier(level);
  const key = `${speciesKey}_t${tier}`;
  if (spriteCache[key]) return spriteCache[key];
  if (!spriteRenderer) initSpriteRenderer();
  const char = CHARACTER_BUILDERS[speciesKey](level);
  spriteScene.add(char);
  spriteRenderer.render(spriteScene, spriteCamera);
  const url = spriteRenderer.domElement.toDataURL('image/png');
  spriteCache[key] = url;
  spriteScene.remove(char);
  disposeCharacter(char);
  return url;
}
export function preloadAllSprites() {
  Object.keys(CHARACTER_BUILDERS).forEach(k => renderSpriteForSpecies(k, 1));
}

/* ====================================================================
   CATCH SCENE
   ==================================================================== */
export const catchSc = {
  renderer: null, scene: null, camera: null, effects: null,
  char: null, raf: null, t: 0, shake: 0, _camBase: null,
  pulseGlow: null, magicCircle: null, ambientGlow: null,
};

export function initCatchScene(canvasEl, isActiveFn) {
  catchSc.renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  catchSc.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  catchSc.renderer.outputColorSpace = THREE.SRGBColorSpace;
  catchSc.scene = new THREE.Scene();
  setupSceneLights(catchSc.scene);

  catchSc.magicCircle = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.1, 64),
    new THREE.MeshBasicMaterial({ color: 0x5a4fff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  catchSc.magicCircle.rotation.x = -Math.PI / 2;
  catchSc.magicCircle.position.y = -0.05;
  catchSc.scene.add(catchSc.magicCircle);

  const innerCircle = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.55, 48),
    new THREE.MeshBasicMaterial({ color: 0xff66cc, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  innerCircle.rotation.x = -Math.PI / 2;
  innerCircle.position.y = -0.04;
  catchSc.scene.add(innerCircle);
  catchSc._innerCircle = innerCircle;

  catchSc.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  catchSc.camera.position.set(0, 1.6, 4.5);
  catchSc.camera.lookAt(0, 1.0, 0);
  catchSc._camBase = catchSc.camera.position.clone();

  catchSc.effects = new EffectsLayer(catchSc.scene);

  const resize = () => {
    const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    if (!w || !h) return;
    catchSc.renderer.setSize(w, h, false);
    catchSc.camera.aspect = w / h;
    catchSc.camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  setTimeout(resize, 50); setTimeout(resize, 200);

  function loop() {
    catchSc.raf = requestAnimationFrame(loop);
    if (!isActiveFn()) return;
    catchSc.t += 0.016;

    catchSc.magicCircle.rotation.z = catchSc.t * 0.3;
    catchSc.magicCircle.material.opacity = 0.35 + Math.sin(catchSc.t * 2) * 0.15;
    catchSc._innerCircle.rotation.z = -catchSc.t * 0.5;

    if (catchSc.char) {
      catchSc.char.position.y = Math.sin(catchSc.t * 1.8) * 0.1;
      catchSc.char.rotation.y = Math.sin(catchSc.t * 0.5) * 0.25;
      if (catchSc.shake > 0) {
        catchSc.char.position.x = (Math.random() - 0.5) * catchSc.shake;
        catchSc.char.position.z = (Math.random() - 0.5) * catchSc.shake;
        catchSc.shake *= 0.85;
        if (catchSc.shake < 0.005) { catchSc.shake = 0; catchSc.char.position.x = 0; catchSc.char.position.z = 0; }
      }
      if (catchSc.char.userData.head) catchSc.char.userData.head.rotation.z = Math.sin(catchSc.t * 2.5) * 0.07;
      animateTierDecorations(catchSc.char, catchSc.t);
    }

    catchSc.effects.update(0.016);
    catchSc.renderer.render(catchSc.scene, catchSc.camera);
  }
  loop();
}

export function setCatchCharacter(speciesKey, level = 1) {
  if (catchSc.char) { catchSc.scene.remove(catchSc.char); disposeCharacter(catchSc.char); }
  catchSc.char = CHARACTER_BUILDERS[speciesKey](level);
  catchSc.char.position.set(0, 0, 0);
  catchSc.scene.add(catchSc.char);
  if (catchSc.effects) {
    const pos = new THREE.Vector3(0, 1, 0);
    catchSc.effects.add(makeShockwave(pos, 0xff66cc, { maxScale: 3, duration: 0.5 }));
    catchSc.effects.add(makeFloatingGlows(pos, 0xff66cc, 8));
  }
}
export function shakeCatchCharacter(intensity = 0.15) { catchSc.shake = intensity; }

export function throwVacuumAtCatch(onArrive) {
  if (!catchSc.scene) { onArrive && onArrive(); return; }
  const vacGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.55, 16);
  const vacMat = new THREE.MeshStandardMaterial({
    color: 0x4488ff, metalness: 0.7, roughness: 0.25,
    emissive: 0x224488, emissiveIntensity: 0.6,
  });
  const vac = new THREE.Mesh(vacGeo, vacMat);
  const hose = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.06, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.6 })
  );
  hose.position.y = -0.3;
  const group = new THREE.Group();
  group.add(vac); group.add(hose);

  const start = new THREE.Vector3(0, -2, 2.5);
  const end = new THREE.Vector3(0, 1.0, 0);
  group.position.copy(start);
  catchSc.scene.add(group);

  let t = 0; const duration = 0.55;
  function animate() {
    t += 0.016;
    const p = Math.min(1, t / duration);
    const eased = 1 - (1 - p) * (1 - p);
    group.position.lerpVectors(start, end, eased);
    group.position.y += Math.sin(p * Math.PI) * 0.9;
    group.rotation.z += 0.42; group.rotation.x += 0.32;
    if (p < 1) requestAnimationFrame(animate);
    else {
      catchSc.scene.remove(group);
      vacGeo.dispose(); vacMat.dispose();
      hose.geometry.dispose(); hose.material.dispose();
      catchSc.effects.add(makeShockwave(end, 0x4488ff, { maxScale: 4 }));
      catchSc.effects.add(makeParticleBurst(end, { color: 0x88aaff, count: 25, spread: 1.5, lifetime: 0.5 }));
      onArrive && onArrive();
    }
  }
  animate();
}

export function catchSuccessAnim(onDone) {
  if (!catchSc.char) { onDone && onDone(); return; }
  const char = catchSc.char;
  let t = 0;
  const duration = 0.8;
  function loop() {
    t += 0.016;
    const p = Math.min(1, t / duration);
    char.rotation.y += 0.4;
    char.scale.setScalar(Math.max(0.01, 1 - p));
    char.position.y = p * 0.5;
    if (p < 1) requestAnimationFrame(loop);
    else {
      catchSc.effects.add(makeShockwave(new THREE.Vector3(0, 1, 0), 0xffd700, { maxScale: 8, duration: 0.7 }));
      catchSc.effects.add(makeParticleBurst(new THREE.Vector3(0, 1, 0), { color: 0xffd700, count: 60, spread: 2.5, lifetime: 1 }));
      onDone && onDone();
    }
  }
  loop();
}

/* ====================================================================
   BATTLE SCENE
   ==================================================================== */
export const battleSc = {
  renderer: null, scene: null, camera: null, effects: null,
  player: null, enemy: null, raf: null, t: 0,
  shakePlayer: 0, shakeEnemy: 0,
  playerLunge: 0, enemyLunge: 0,
  playerHitFlash: 0, enemyHitFlash: 0,
  camShake: 0, camBasePos: null,
  stageRings: [],
};

export function initBattleScene(canvasEl, isActiveFn) {
  battleSc.renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  battleSc.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  battleSc.renderer.outputColorSpace = THREE.SRGBColorSpace;
  battleSc.scene = new THREE.Scene();
  setupSceneLights(battleSc.scene);

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.2, 0.18, 64),
    new THREE.MeshStandardMaterial({ color: 0x1a0a3a, roughness: 0.45, metalness: 0.55, emissive: 0x220844, emissiveIntensity: 0.35 })
  );
  pad.position.y = -0.1;
  battleSc.scene.add(pad);

  const ringColors = [0x5a4fff, 0xff44aa, 0x44ffaa];
  for (let i = 0; i < 3; i++) {
    const r = 2 + i * 0.7;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r, r + 0.07, 64),
      new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.005 + i * 0.005;
    battleSc.scene.add(ring);
    battleSc.stageRings.push({ ring, speed: (i + 1) * 0.3 * (i % 2 ? -1 : 1), phase: i });
  }

  const centerGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 48),
    new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  centerGlow.rotation.x = -Math.PI / 2;
  centerGlow.position.y = 0.001;
  battleSc.scene.add(centerGlow);
  battleSc._centerGlow = centerGlow;

  battleSc.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  battleSc.camera.position.set(0, 2.7, 6.2);
  battleSc.camera.lookAt(0, 1.0, 0);
  battleSc.camBasePos = battleSc.camera.position.clone();

  battleSc.effects = new EffectsLayer(battleSc.scene);

  const resize = () => {
    const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    if (!w || !h) return;
    battleSc.renderer.setSize(w, h, false);
    battleSc.camera.aspect = w / h;
    battleSc.camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  setTimeout(resize, 50); setTimeout(resize, 200);

  function loop() {
    battleSc.raf = requestAnimationFrame(loop);
    if (!isActiveFn()) return;
    battleSc.t += 0.016;

    battleSc.stageRings.forEach(({ ring, speed, phase }) => {
      ring.rotation.z = battleSc.t * speed;
      ring.material.opacity = 0.45 + Math.sin(battleSc.t * 2 + phase) * 0.25;
    });
    battleSc._centerGlow.material.opacity = 0.25 + Math.sin(battleSc.t * 1.5) * 0.1;
    battleSc._centerGlow.scale.setScalar(1 + Math.sin(battleSc.t * 1.5) * 0.1);

    const sides = [
      ['enemy', battleSc.enemy, 'enemyLunge', 'shakeEnemy', 'enemyHitFlash', -1.4, 1],
      ['player', battleSc.player, 'playerLunge', 'shakePlayer', 'playerHitFlash', 1.4, -1],
    ];
    for (const [side, char, lungeKey, shakeKey, flashKey, baseX, lungeDir] of sides) {
      if (!char) continue;
      const lunge = battleSc[lungeKey];
      const baseY = Math.sin(battleSc.t * 1.5 + (side === 'enemy' ? 1 : 0)) * 0.08;
      char.position.x = baseX + lunge * lungeDir * 1.5;
      char.position.y = baseY + Math.abs(lunge) * 0.7;
      const shake = battleSc[shakeKey];
      if (shake > 0) {
        char.position.x += (Math.random() - 0.5) * shake;
        char.position.z = (Math.random() - 0.5) * shake;
        battleSc[shakeKey] *= 0.82;
        if (battleSc[shakeKey] < 0.005) battleSc[shakeKey] = 0;
      } else char.position.z = 0;
      if (battleSc[flashKey] > 0) {
        char.traverse(o => {
          if (o.material && o.material.emissive) {
            if (o.userData._origEmissive === undefined) o.userData._origEmissive = o.material.emissive.getHex();
            o.material.emissive.setHex(0xff0000);
            o.material.emissiveIntensity = battleSc[flashKey];
          }
        });
        battleSc[flashKey] -= 0.05;
        if (battleSc[flashKey] <= 0) {
          battleSc[flashKey] = 0;
          char.traverse(o => {
            if (o.material && o.material.emissive && o.userData._origEmissive !== undefined) {
              o.material.emissive.setHex(o.userData._origEmissive);
              o.material.emissiveIntensity = 1;
            }
          });
        }
      }
      if (char.userData.head) char.userData.head.rotation.z = Math.sin(battleSc.t * 2 + (side === 'enemy' ? 0 : 1.5)) * 0.06;
      animateTierDecorations(char, battleSc.t);
    }

    if (battleSc.playerLunge > 0) battleSc.playerLunge = Math.max(0, battleSc.playerLunge - 0.08);
    if (battleSc.enemyLunge > 0) battleSc.enemyLunge = Math.max(0, battleSc.enemyLunge - 0.08);

    if (battleSc.camShake > 0) {
      battleSc.camera.position.x = battleSc.camBasePos.x + (Math.random() - 0.5) * battleSc.camShake;
      battleSc.camera.position.y = battleSc.camBasePos.y + (Math.random() - 0.5) * battleSc.camShake;
      battleSc.camera.position.z = battleSc.camBasePos.z + (Math.random() - 0.5) * battleSc.camShake * 0.5;
      battleSc.camShake *= 0.86;
      if (battleSc.camShake < 0.015) { battleSc.camShake = 0; battleSc.camera.position.copy(battleSc.camBasePos); }
    }

    battleSc.effects.update(0.016);
    battleSc.renderer.render(battleSc.scene, battleSc.camera);
  }
  loop();
}

export function setBattleFighters(playerSpecies, enemySpecies, playerLevel = 1, enemyLevel = 1) {
  if (battleSc.player) { battleSc.scene.remove(battleSc.player); disposeCharacter(battleSc.player); }
  if (battleSc.enemy) { battleSc.scene.remove(battleSc.enemy); disposeCharacter(battleSc.enemy); }
  battleSc.player = CHARACTER_BUILDERS[playerSpecies](playerLevel);
  battleSc.player.position.set(1.4, 0, 0);
  battleSc.player.rotation.y = -Math.PI / 2;
  battleSc.scene.add(battleSc.player);
  battleSc.enemy = CHARACTER_BUILDERS[enemySpecies](enemyLevel);
  battleSc.enemy.position.set(-1.4, 0, 0);
  battleSc.enemy.rotation.y = Math.PI / 2;
  battleSc.scene.add(battleSc.enemy);
  if (battleSc.effects) {
    battleSc.effects.add(makeShockwave(new THREE.Vector3(1.4, 0, 0), 0x44ffaa, { maxScale: 4 }));
    battleSc.effects.add(makeShockwave(new THREE.Vector3(-1.4, 0, 0), 0xff4488, { maxScale: 4 }));
  }
}

export function performAttack(attackerSide, moveName, hit) {
  if (attackerSide === 'player') battleSc.playerLunge = 1.0;
  else battleSc.enemyLunge = 1.0;
  setTimeout(() => {
    if (!battleSc.player || !battleSc.enemy) return;
    const attacker = attackerSide === 'player' ? battleSc.player : battleSc.enemy;
    const defender = attackerSide === 'player' ? battleSc.enemy : battleSc.player;
    const attPos = attacker.position.clone(); attPos.y += 1.3;
    const defPos = defender.position.clone(); defPos.y += 1.3;
    playMoveEffects(moveName, attPos, defPos,
      eff => battleSc.effects.add(eff),
      amt => { battleSc.camShake = Math.max(battleSc.camShake, amt); }
    );
    if (hit) {
      if (attackerSide === 'player') { battleSc.shakeEnemy = 0.3; battleSc.enemyHitFlash = 1.0; }
      else { battleSc.shakePlayer = 0.3; battleSc.playerHitFlash = 1.0; }
    }
  }, 260);
}

export function getFighterScreenPos(side) {
  const f = side === 'player' ? battleSc.player : battleSc.enemy;
  if (!f || !battleSc.camera || !battleSc.renderer) return null;
  const worldPos = f.position.clone(); worldPos.y += 1.6;
  const projected = worldPos.project(battleSc.camera);
  const canvas = battleSc.renderer.domElement;
  return {
    x: (projected.x + 1) / 2 * canvas.clientWidth,
    y: (-projected.y + 1) / 2 * canvas.clientHeight,
  };
}

export function shakeBattleCamera(amt) {
  battleSc.camShake = Math.max(battleSc.camShake, amt);
}
