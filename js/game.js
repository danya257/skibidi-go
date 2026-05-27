import { CHARACTER_BUILDERS } from './models.js';
import {
  renderSpriteForSpecies, preloadAllSprites,
  initCatchScene, setCatchCharacter, shakeCatchCharacter,
  throwVacuumAtCatch, catchSuccessAnim,
  initBattleScene, setBattleFighters, performAttack, getFighterScreenPos,
} from './scenes.js';
import { MOVE_COLORS } from './effects.js';
import { ACHIEVEMENTS, checkAchievements, SHOP_ITEMS, powerUpCost, canPowerUp, powerUp } from './progression.js';
import { getTier } from './models.js';
import { startHorror, stopHorror } from './horror.js';

function enterHorror() {
  showScreen('horror-screen');
  const endEl = document.querySelector('.horror-end');
  if (endEl) { endEl.classList.remove('show', 'dead', 'won'); }
  setTimeout(() => startHorror(), 50);
}
function exitHorror() {
  stopHorror();
  showScreen('map-screen');
}
function retryHorror() {
  stopHorror();
  const endEl = document.querySelector('.horror-end');
  if (endEl) endEl.classList.remove('show', 'dead', 'won');
  setTimeout(() => startHorror(), 100);
}
window._horrorReward = function(coins) {
  state.player.coins += coins;
  saveState(); refreshHUD();
};
window.enterHorror = enterHorror;
window.exitHorror = exitHorror;
window.retryHorror = retryHorror;

function spawnDamageNumber(dmg, side, isCrit) {
  setTimeout(() => {
    const pos = getFighterScreenPos(side);
    if (!pos) return;
    const el = document.createElement('div');
    el.className = 'dmg-number' + (isCrit ? ' crit' : '');
    el.textContent = (isCrit ? '✦ ' : '') + '−' + dmg;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    document.getElementById('battle-canvas-wrap').appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }, 400);
}
function showMoveCallout(moveName) {
  const el = document.createElement('div');
  el.className = 'move-callout';
  el.textContent = moveName + '!';
  el.style.setProperty('--callout-color', MOVE_COLORS[moveName] || '#5a4fff');
  document.getElementById('battle-canvas-wrap').appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

export const SPECIES = {
  toilet:    { name: 'Скибиди-туалет',   rarity: 1, baseHp: 40,  atk: 8,  def: 5,  spd: 6,  moves: ['Скибиди-рык', 'Сливная атака'] },
  singer:    { name: 'Певучий туалет',   rarity: 1, baseHp: 35,  atk: 10, def: 4,  spd: 8,  moves: ['Скибиди-рык', 'Высокая нота'] },
  bigtoilet: { name: 'Жирный туалет',    rarity: 2, baseHp: 80,  atk: 9,  def: 12, spd: 3,  moves: ['Слив-таран', 'Вонючий газ'] },
  dj:        { name: 'DJ-туалет',        rarity: 2, baseHp: 50,  atk: 11, def: 6,  spd: 9,  moves: ['Бит дропа', 'Высокая нота'] },
  camera:    { name: 'Камерхед',         rarity: 3, baseHp: 60,  atk: 14, def: 9,  spd: 8,  moves: ['Лазер-зум', 'Удар штативом'] },
  speaker:   { name: 'Спикерхед',        rarity: 3, baseHp: 55,  atk: 13, def: 7,  spd: 10, moves: ['Звуковой бум', 'Громовой рёв'] },
  tvman:     { name: 'ТВ-Мен',           rarity: 3, baseHp: 65,  atk: 12, def: 10, spd: 7,  moves: ['Помеха-удар', 'Лазер-зум'] },
  titancam:  { name: 'Титан-камерамен',  rarity: 4, baseHp: 110, atk: 22, def: 15, spd: 10, moves: ['Лазер-зум', 'Удар штативом', 'Титаническая ярость'] },
  titansp:   { name: 'Титан-спикермен',  rarity: 4, baseHp: 100, atk: 24, def: 12, spd: 13, moves: ['Звуковой бум', 'Громовой рёв', 'Титаническая ярость'] },
  titantv:   { name: 'Титан-ТВ-Мен',     rarity: 4, baseHp: 105, atk: 21, def: 17, spd: 9,  moves: ['Помеха-удар', 'Лазер-зум', 'Титаническая ярость'] },
  gman:      { name: 'G-Мен туалет',     rarity: 5, baseHp: 140, atk: 28, def: 20, spd: 14, moves: ['Скибиди-рык', 'Слив-таран', 'Тёмная воля', 'Титаническая ярость'] },
  darksp:    { name: 'Тёмный спикермен', rarity: 5, baseHp: 130, atk: 30, def: 18, spd: 16, moves: ['Громовой рёв', 'Звуковой бум', 'Тёмная воля'] },
};

const MOVES = {
  'Скибиди-рык':         { power: 12, acc: 0.95 },
  'Сливная атака':       { power: 14, acc: 0.9 },
  'Высокая нота':        { power: 13, acc: 0.95 },
  'Слив-таран':          { power: 18, acc: 0.85 },
  'Вонючий газ':         { power: 10, acc: 1.0 },
  'Бит дропа':           { power: 16, acc: 0.9 },
  'Лазер-зум':           { power: 20, acc: 0.85 },
  'Удар штативом':       { power: 17, acc: 0.95 },
  'Звуковой бум':        { power: 22, acc: 0.8 },
  'Громовой рёв':        { power: 19, acc: 0.9 },
  'Помеха-удар':         { power: 18, acc: 0.9 },
  'Титаническая ярость': { power: 32, acc: 0.7 },
  'Тёмная воля':         { power: 28, acc: 0.8 },
};

const RARITY_WEIGHTS = [
  { ids: ['toilet','singer'],          weight: 60 },
  { ids: ['bigtoilet','dj'],           weight: 25 },
  { ids: ['camera','speaker','tvman'], weight: 12 },
  { ids: ['titancam','titansp','titantv'], weight: 2.5 },
  { ids: ['gman','darksp'],            weight: 0.5 },
];

const rarityColor = r => ['#fff','#cbd5e1','#60a5fa','#c084fc','#fbbf24','#f87171'][r] || '#fff';
const rarityStars = r => '★'.repeat(r) + '☆'.repeat(5 - r);

/* ============== STATE ============== */
const DEFAULT_STATE = {
  player: { name: 'Игрок', level: 1, xp: 0, coins: 0, balls: 10 },
  collection: [], team: [], lastSpawn: 0, spawns: [], playerPos: null,
  achievements: [], stats: { wins: 0, crits: 0, catches: 0 }, modifiers: {},
};
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem('skibidi-go');
    if (!raw) return structuredClone(DEFAULT_STATE);
    return Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(raw));
  } catch (e) { return structuredClone(DEFAULT_STATE); }
}
function saveState() { try { localStorage.setItem('skibidi-go', JSON.stringify(state)); } catch(e) {} }

const xpForLevel = lvl => 80 + lvl * 40;
function addXP(amount) {
  state.player.xp += amount;
  let leveled = false;
  while (state.player.xp >= xpForLevel(state.player.level)) {
    state.player.xp -= xpForLevel(state.player.level);
    state.player.level++;
    state.player.balls += 5;
    toast(`🎉 Уровень ${state.player.level}! +5 🧹`);
    leveled = true;
  }
  refreshHUD(); saveState();
  if (leveled) triggerAchievementCheck({ type: 'levelup' });
}

function refreshHUD() {
  document.getElementById('hud-level').textContent = state.player.level;
  const pct = Math.min(100, (state.player.xp / xpForLevel(state.player.level)) * 100);
  document.getElementById('hud-xp-fill').style.width = pct + '%';
  document.getElementById('hud-balls').textContent = state.player.balls;
  document.getElementById('hud-coins').textContent = state.player.coins;
}

/* ============== TOAST / MODAL ============== */
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function showModal({ thumb = null, title = '', text = '', stats = null }) {
  const wrap = document.getElementById('modal-thumb-wrap');
  wrap.innerHTML = thumb ? `<img class="modal-thumb" src="${thumb}">` : '';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-text').textContent = text;
  const s = document.getElementById('modal-stats');
  if (stats) { s.innerHTML = stats; s.style.display = 'block'; } else s.style.display = 'none';
  document.getElementById('modal-overlay').classList.add('show');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('show'); }

/* ============== ACHIEVEMENTS & INTERACTIONS ============== */
function triggerAchievementCheck(event) {
  const newOnes = checkAchievements(state, event);
  for (const ach of newOnes) {
    if (ach.reward.coins) state.player.coins += ach.reward.coins;
    if (ach.reward.balls) state.player.balls += ach.reward.balls;
    showAchPopup(ach);
  }
  if (newOnes.length) { saveState(); refreshHUD(); }
}

function showAchPopup(ach) {
  const stack = document.getElementById('ach-popup-stack');
  const div = document.createElement('div');
  div.className = 'ach-popup';
  const rewardText = [
    ach.reward.coins ? `+${ach.reward.coins} 💰` : '',
    ach.reward.balls ? `+${ach.reward.balls} 🧹` : '',
  ].filter(Boolean).join(' · ');
  div.innerHTML = `
    <div class="pop-icon">${ach.icon}</div>
    <div class="pop-text">
      <div class="pop-label">ДОСТИЖЕНИЕ</div>
      <div class="pop-name">${ach.name}</div>
      <div class="pop-reward">${rewardText}</div>
    </div>`;
  stack.appendChild(div);
  setTimeout(() => div.classList.add('fade'), 3600);
  setTimeout(() => div.remove(), 4100);
}

function flyCoinTo(fromX, fromY, kind = 'coin') {
  const hud = document.querySelector(kind === 'xp' ? '#hud-level' : '.hud-pill.green');
  if (!hud) return;
  const rect = hud.getBoundingClientRect();
  const toX = rect.left + rect.width / 2;
  const toY = rect.top + rect.height / 2;
  const layer = document.getElementById('fly-coin-layer');
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('div');
    el.className = kind === 'xp' ? 'fly-coin fly-xp' : 'fly-coin';
    el.textContent = kind === 'xp' ? '+XP' : '💰';
    const spreadX = (Math.random() - 0.5) * 80;
    const spreadY = (Math.random() - 0.5) * 60;
    el.style.left = (fromX + spreadX) + 'px';
    el.style.top = (fromY + spreadY) + 'px';
    el.style.transition = 'transform 0.85s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.85s';
    layer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transform = `translate(${toX - (fromX + spreadX)}px, ${toY - (fromY + spreadY)}px) scale(0.6)`;
      el.style.opacity = '0';
    }));
    setTimeout(() => el.remove(), 900);
  }
  setTimeout(() => bumpPill(kind === 'xp' ? document.querySelectorAll('.hud-pill')[0] : hud.closest('.hud-pill')), 800);
}
function bumpPill(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

/* ============== SHOP ============== */
function renderShop() {
  document.getElementById('shop-coins').textContent = state.player.coins;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = SHOP_ITEMS.map(item => {
    const canBuy = state.player.coins >= item.cost;
    return `<div class="shop-card ${canBuy ? 'affordable' : 'cant-afford'}" style="--shop-color:${item.color}" onclick="buyShopItem('${item.id}')">
      <div class="shop-icon">${item.icon}</div>
      <div class="shop-name">${item.name}</div>
      <div class="shop-desc">${item.desc}</div>
      <div class="shop-cost ${canBuy ? 'affordable' : 'cant-afford'}">💰 ${item.cost}</div>
    </div>`;
  }).join('');
  const ach = document.getElementById('ach-grid');
  ach.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = (state.achievements || []).includes(a.id);
    return `<div class="ach-card ${unlocked ? 'unlocked' : 'locked'}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-info">
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
      ${unlocked ? '<div class="ach-check">✓</div>' : ''}
    </div>`;
  }).join('');
}
function buyShopItem(id) {
  const item = SHOP_ITEMS.find(x => x.id === id);
  if (!item) return;
  if (state.player.coins < item.cost) { toast('Не хватает монет!'); return; }
  state.player.coins -= item.cost;
  item.apply(state);
  saveState(); refreshHUD(); renderShop();
  toast(`✓ Куплено: ${item.name}`);
}

/* ============== AR ============== */
let cameraStream = null;
let arEnabled = (() => { try { return localStorage.getItem('skibidi-ar') === '1'; } catch(e) { return false; } })();
const AR_SCREENS = ['catch-screen', 'battle-screen'];

async function startCamera() {
  if (cameraStream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Камера не поддерживается'); arEnabled = false;
    try { localStorage.setItem('skibidi-ar', '0'); } catch(e) {}
    updateARButtons(); return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    const v = document.getElementById('ar-video');
    v.srcObject = cameraStream;
    try { await v.play(); } catch(e) {}
    document.body.classList.add('ar-on');
  } catch (e) {
    arEnabled = false;
    try { localStorage.setItem('skibidi-ar', '0'); } catch(e) {}
    document.body.classList.remove('ar-on');
    toast('Камера: ' + (e.name === 'NotAllowedError' ? 'разреши доступ' : (e.message || e.name)));
    updateARButtons();
  }
}
function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  const v = document.getElementById('ar-video');
  if (v) v.srcObject = null;
  document.body.classList.remove('ar-on');
}
async function toggleAR() {
  arEnabled = !arEnabled;
  try { localStorage.setItem('skibidi-ar', arEnabled ? '1' : '0'); } catch(e) {}
  const active = document.querySelector('.screen.active');
  if (arEnabled && active && AR_SCREENS.includes(active.id)) await startCamera();
  else stopCamera();
  updateARButtons();
}
function updateARButtons() {
  document.querySelectorAll('.ar-toggle').forEach(b => {
    if (arEnabled) { b.classList.add('on'); b.textContent = '📷 AR вкл'; }
    else { b.classList.remove('on'); b.textContent = '📷 AR выкл'; }
  });
}

/* ============== SCREENS ============== */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'map-screen' && map) setTimeout(() => map.invalidateSize(), 50);
  if (arEnabled && AR_SCREENS.includes(id)) startCamera(); else stopCamera();
  updateARButtons();
  if (id === 'catch-screen' || id === 'battle-screen') {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }
}
const isCatchActive = () => document.getElementById('catch-screen').classList.contains('active');
const isBattleActive = () => document.getElementById('battle-screen').classList.contains('active');

/* ============== MAP & GPS ============== */
let map = null, playerMarker = null, spawnMarkers = {};

function initMap(lat, lng) {
  map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lng], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  const playerIcon = L.divIcon({ className: '', html: '<div class="player-marker"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
  playerMarker = L.marker([lat, lng], { icon: playerIcon, interactive: false }).addTo(map);
  state.playerPos = { lat, lng }; saveState();
  spawnIfNeeded(); renderSpawns();
}
function updatePlayerPos(lat, lng) {
  state.playerPos = { lat, lng };
  if (playerMarker) playerMarker.setLatLng([lat, lng]);
  saveState();
  spawnIfNeeded(); renderSpawns();
}
function centerOnPlayer() {
  if (state.playerPos && map) map.setView([state.playerPos.lat, state.playerPos.lng], 17);
}
function startGeolocation() {
  if (!navigator.geolocation) { toast('GPS не поддерживается'); initMap(55.7558, 37.6173); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      initMap(pos.coords.latitude, pos.coords.longitude);
      navigator.geolocation.watchPosition(
        p => updatePlayerPos(p.coords.latitude, p.coords.longitude),
        e => console.warn(e),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    },
    err => { toast('Нет GPS — тестовая точка'); initMap(55.7558, 37.6173); },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/* ============== SPAWN ============== */
function pickSpecies() {
  if (state.modifiers?.rareBait) {
    state.modifiers.rareBait = false;
    const rarePool = RARITY_WEIGHTS.filter(t => t.ids.some(id => SPECIES[id].rarity >= 3));
    const total = rarePool.reduce((s, r) => s + r.weight, 0);
    let r = Math.random() * total;
    for (const t of rarePool) {
      if (r < t.weight) return t.ids[Math.floor(Math.random() * t.ids.length)];
      r -= t.weight;
    }
    return 'camera';
  }
  const total = RARITY_WEIGHTS.reduce((s, r) => s + r.weight, 0);
  let r = Math.random() * total;
  for (const t of RARITY_WEIGHTS) {
    if (r < t.weight) return t.ids[Math.floor(Math.random() * t.ids.length)];
    r -= t.weight;
  }
  return 'toilet';
}
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function spawnIfNeeded() {
  const now = Date.now();
  if (state.spawns.length >= 8 && now - state.lastSpawn < 60000) return;
  if (state.playerPos) {
    state.spawns = state.spawns.filter(s => {
      const d = haversine(s.lat, s.lng, state.playerPos.lat, state.playerPos.lng);
      return d < 0.5 && (now - s.spawnedAt) < 20 * 60 * 1000;
    });
  }
  while (state.spawns.length < 8 && state.playerPos) {
    const sp = pickSpecies();
    const data = SPECIES[sp];
    const angle = Math.random() * Math.PI * 2;
    const distM = 50 + Math.random() * 180;
    const dLat = (distM * Math.cos(angle)) / 111000;
    const dLng = (distM * Math.sin(angle)) / (111000 * Math.cos(state.playerPos.lat * Math.PI / 180));
    const level = Math.max(1, Math.floor(state.player.level + (Math.random() * 4 - 2) + (data.rarity - 1)));
    state.spawns.push({
      id: 's' + now + Math.floor(Math.random() * 9999),
      species: sp, level,
      lat: state.playerPos.lat + dLat, lng: state.playerPos.lng + dLng,
      spawnedAt: now,
    });
  }
  state.lastSpawn = now; saveState();
}
function renderSpawns() {
  if (!map) return;
  for (const id in spawnMarkers) {
    if (!state.spawns.find(s => s.id === id)) {
      map.removeLayer(spawnMarkers[id]); delete spawnMarkers[id];
    }
  }
  for (const sp of state.spawns) {
    if (spawnMarkers[sp.id]) continue;
    const data = SPECIES[sp.species];
    const url = renderSpriteForSpecies(sp.species, sp.level);
    const icon = L.divIcon({
      className: '',
      html: `<div class="toilet-sprite-wrap"><img src="${url}"><div class="rarity-tag r${data.rarity}">L${sp.level} ${rarityStars(data.rarity)}</div></div>`,
      iconSize: [72, 90], iconAnchor: [36, 60],
    });
    const m = L.marker([sp.lat, sp.lng], { icon }).addTo(map);
    m.on('click', () => onSpawnClick(sp));
    spawnMarkers[sp.id] = m;
  }
}
function onSpawnClick(sp) {
  if (!state.playerPos) return;
  const distKm = haversine(state.playerPos.lat, state.playerPos.lng, sp.lat, sp.lng);
  if (distKm > 0.15) { toast(`Слишком далеко — ${Math.round(distKm * 1000)} м.`); return; }
  startCatch(sp);
}

/* ============== CATCH ============== */
let currentCatch = null;
let catchRingScale = 2.0, catchRingDir = -1, catchRingTimer = null;

function startCatch(sp) {
  if (state.player.balls <= 0) { toast('Нет вакуумов! Победи в бою.'); return; }
  currentCatch = sp;
  const data = SPECIES[sp.species];
  document.getElementById('catch-name').textContent = data.name;
  document.getElementById('catch-name').style.color = rarityColor(data.rarity);
  document.getElementById('catch-lvl').textContent = `Ур. ${sp.level} · ${rarityStars(data.rarity)}`;
  document.getElementById('catch-feedback').textContent = 'Жми «Бросить» когда круг сожмётся до пунктира';
  document.getElementById('catch-throw-btn').disabled = false;
  showScreen('catch-screen');
  setCatchCharacter(sp.species, sp.level);
  catchRingScale = 2.0; catchRingDir = -1;
  if (catchRingTimer) clearInterval(catchRingTimer);
  catchRingTimer = setInterval(animateCatchRing, 30);
}
function animateCatchRing() {
  catchRingScale += catchRingDir * 0.025;
  if (catchRingScale <= 0.7) { catchRingScale = 0.7; catchRingDir = 1; }
  if (catchRingScale >= 2.0) { catchRingScale = 2.0; catchRingDir = -1; }
  const ring = document.getElementById('catch-ring');
  ring.style.transform = `translate(-50%, -50%) scale(${catchRingScale})`;
  const dist = Math.abs(catchRingScale - 1.15);
  ring.classList.toggle('danger', dist > 0.5);
}
function throwBall() {
  if (!currentCatch) return;
  document.getElementById('catch-throw-btn').disabled = true;
  if (catchRingTimer) { clearInterval(catchRingTimer); catchRingTimer = null; }
  const dist = Math.abs(catchRingScale - 1.15);
  let timing, bonus;
  if (dist < 0.08) { timing = 'perfect'; bonus = 0.4; }
  else if (dist < 0.2) { timing = 'good'; bonus = 0.2; }
  else if (dist < 0.4) { timing = 'mid'; bonus = 0.0; }
  else { timing = 'miss'; bonus = -0.3; }

  state.player.balls--; refreshHUD(); saveState();

  const data = SPECIES[currentCatch.species];
  let charmBonus = 0;
  if (state.modifiers?.luckyCharms > 0) {
    charmBonus = 0.3;
    state.modifiers.luckyCharms--;
  }
  const baseChance = 0.85 - (data.rarity - 1) * 0.15 - (currentCatch.level * 0.01);
  const chance = Math.max(0.05, Math.min(0.98, baseChance + bonus + charmBonus));
  if (timing === 'perfect') triggerAchievementCheck({ type: 'perfect_catch' });
  const fb = document.getElementById('catch-feedback');
  fb.textContent = ({ perfect: '💯 ИДЕАЛЬНО!', good: '👍 Хорошо', mid: '😐 Так себе', miss: '😬 Промах' })[timing] + ` · шанс ${Math.round(chance * 100)}%`;

  throwVacuumAtCatch(() => {
    shakeCatchCharacter(0.22);
    setTimeout(() => {
      if (Math.random() < chance) {
        catchSuccessAnim(() => caughtCreature(currentCatch));
      } else {
        toast('Вырвался!');
        shakeCatchCharacter(0.4);
        if (state.player.balls > 0 && Math.random() < 0.5) setTimeout(() => startCatch(currentCatch), 800);
        else { toast('Скибидик сбежал...'); endCatch(); }
      }
    }, 400);
  });
}
function caughtCreature(sp) {
  const data = SPECIES[sp.species];
  const newC = {
    uid: 'c' + Date.now() + Math.floor(Math.random() * 999),
    species: sp.species, level: sp.level, xp: 0,
    hp: Math.floor(data.baseHp + sp.level * 4),
  };
  state.collection.push(newC);
  state.spawns = state.spawns.filter(s => s.id !== sp.id);
  if (spawnMarkers[sp.id]) { map.removeLayer(spawnMarkers[sp.id]); delete spawnMarkers[sp.id]; }
  let xpGain = 20 + sp.level * 5 + (data.rarity - 1) * 30;
  const coinGain = 5 + (data.rarity - 1) * 10;
  if (state.modifiers?.xpBoostUntil && Date.now() < state.modifiers.xpBoostUntil) xpGain = Math.floor(xpGain * 1.5);
  state.player.coins += coinGain;
  state.stats = state.stats || { wins: 0, crits: 0, catches: 0 };
  state.stats.catches++;
  addXP(xpGain); saveState(); endCatch();
  flyCoinTo(window.innerWidth / 2, window.innerHeight / 2, 'coin');
  flyCoinTo(window.innerWidth / 2, window.innerHeight / 2 - 30, 'xp');
  showModal({
    thumb: renderSpriteForSpecies(sp.species, sp.level),
    title: 'Поймал!',
    text: `${data.name} (ур. ${sp.level})`,
    stats: `<b>HP:</b> ${newC.hp} · <b>ATK:</b> ${data.atk + sp.level} · <b>DEF:</b> ${data.def + Math.floor(sp.level / 2)}<br><span style="color:#fbbf24">+${xpGain} XP · +${coinGain} 💰</span>`,
  });
  triggerAchievementCheck({ type: 'catch', rarity: data.rarity });
}
function endCatch() {
  if (catchRingTimer) { clearInterval(catchRingTimer); catchRingTimer = null; }
  currentCatch = null;
  showScreen('map-screen');
}

/* ============== COLLECTION & TEAM ============== */
function renderCollection() {
  const grid = document.getElementById('collection-grid');
  if (state.collection.length === 0) { grid.innerHTML = '<div class="empty-state">Пока пусто. Иди лови скибидиков!</div>'; return; }
  grid.innerHTML = state.collection.map(c => {
    const d = SPECIES[c.species];
    const t = getTier(c.level);
    const tierBadge = t > 1 ? `<div class="tier-badge t${t}">${'★'.repeat(t)}</div>` : '';
    return `<div class="col-card r${d.rarity} tier-${t}" onclick="onCollectionCardClick('${c.uid}')">
      ${tierBadge}
      <div class="col-thumb"><img src="${renderSpriteForSpecies(c.species, c.level)}"></div>
      <div class="col-name" style="color:${rarityColor(d.rarity)}">${d.name}</div>
      <div class="col-lvl">Ур. ${c.level} · HP ${c.hp}</div>
    </div>`;
  }).join('');
}
function onCollectionCardClick(uid) {
  const c = state.collection.find(x => x.uid === uid); if (!c) return;
  const d = SPECIES[c.species];
  const cost = powerUpCost(c.level);
  const canPow = canPowerUp(state, c);
  const t = getTier(c.level);
  const nextTier = t < 3 ? (t === 1 ? 10 : 20) : null;
  const tierLine = `<div style="margin-top:6px"><b>Тир:</b> ${'★'.repeat(t)}${'☆'.repeat(3 - t)}${nextTier ? ` · Эволюция на ур. ${nextTier}` : ''}</div>`;
  showModal({
    thumb: renderSpriteForSpecies(c.species, c.level),
    title: d.name,
    text: `Ур. ${c.level} · ${rarityStars(d.rarity)}`,
    stats: `<b>HP:</b> ${c.hp}<br><b>ATK:</b> ${d.atk + c.level}<br><b>DEF:</b> ${d.def + Math.floor(c.level / 2)}<br><b>SPD:</b> ${d.spd}<br><b>Атаки:</b> ${d.moves.join(', ')}${tierLine}
    <div class="modal-action-row" style="margin-top:14px; display:flex; gap:8px">
      <button class="big-btn ${canPow ? 'gold' : ''}" ${canPow ? '' : 'disabled'} style="flex:1; padding:11px; font-size:13px" onclick="doPowerUp('${c.uid}')">⚡ Прокачать ${cost}💰</button>
    </div>`,
  });
}
function doPowerUp(uid) {
  const c = state.collection.find(x => x.uid === uid); if (!c) return;
  const d = SPECIES[c.species];
  const oldTier = getTier(c.level);
  if (!powerUp(state, c, d)) { toast('Не хватает монет'); return; }
  const newTier = getTier(c.level);
  saveState(); refreshHUD();
  closeModal();
  if (newTier > oldTier) {
    showEvolution(c);
  } else {
    toast(`⬆️ ${d.name} → ур. ${c.level}!`);
    setTimeout(() => onCollectionCardClick(uid), 250);
  }
}
function showEvolution(creature) {
  const d = SPECIES[creature.species];
  const t = getTier(creature.level);
  const overlay = document.createElement('div');
  overlay.id = 'evolution-overlay';
  overlay.innerHTML = `
    <div class="evo-stars"></div>
    <div class="evo-content">
      <div class="evo-title">★ ЭВОЛЮЦИЯ! ★</div>
      <img class="evo-thumb" src="${renderSpriteForSpecies(creature.species, creature.level)}">
      <div class="evo-name">${d.name}</div>
      <div class="evo-tier">ТИР ${t} · УР. ${creature.level}</div>
      <button class="big-btn primary" onclick="closeEvolution('${creature.uid}')">Невероятно!</button>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
}
function closeEvolution(uid) {
  const o = document.getElementById('evolution-overlay');
  if (o) o.remove();
  if (uid) setTimeout(() => onCollectionCardClick(uid), 200);
}
window.closeEvolution = closeEvolution;
function renderTeamScreen() {
  const cur = document.getElementById('team-current');
  cur.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const uid = state.team[i];
    const div = document.createElement('div');
    if (uid) {
      const c = state.collection.find(x => x.uid === uid);
      if (c) { div.className = 'team-slot filled'; div.innerHTML = `<img src="${renderSpriteForSpecies(c.species, c.level)}">`; }
      else div.className = 'team-slot';
    } else { div.className = 'team-slot'; div.textContent = '+'; }
    cur.appendChild(div);
  }
  const grid = document.getElementById('team-grid');
  if (state.collection.length === 0) { grid.innerHTML = '<div class="empty-state">Сначала поймай кого-нибудь!</div>'; return; }
  grid.innerHTML = state.collection.map(c => {
    const d = SPECIES[c.species];
    const inTeam = state.team.includes(c.uid);
    const t = getTier(c.level);
    const tierBadge = t > 1 ? `<div class="tier-badge t${t}">${'★'.repeat(t)}</div>` : '';
    return `<div class="col-card r${d.rarity} tier-${t} ${inTeam ? 'col-selected' : ''}" onclick="toggleTeam('${c.uid}')">
      ${tierBadge}
      <div class="col-thumb"><img src="${renderSpriteForSpecies(c.species, c.level)}"></div>
      <div class="col-name" style="color:${rarityColor(d.rarity)}">${d.name}</div>
      <div class="col-lvl">Ур. ${c.level}</div>
    </div>`;
  }).join('');
}
function toggleTeam(uid) {
  const idx = state.team.indexOf(uid);
  if (idx >= 0) state.team.splice(idx, 1);
  else { if (state.team.length >= 3) { toast('Команда уже полная!'); return; } state.team.push(uid); }
  saveState(); renderTeamScreen();
}

/* ============== BATTLE ============== */
let battleState = null;

function startTrainerBattle() {
  if (state.team.length === 0) { toast('Сначала собери команду!'); return; }
  const enemyTeam = [];
  const teamSize = Math.min(state.team.length, 3);
  for (let i = 0; i < teamSize; i++) {
    const sp = pickSpecies(); const d = SPECIES[sp];
    const lvl = Math.max(1, state.player.level + Math.floor(Math.random() * 3 - 1));
    enemyTeam.push({ uid: 'e' + i, species: sp, level: lvl, hp: Math.floor(d.baseHp + lvl * 4), maxHp: Math.floor(d.baseHp + lvl * 4) });
  }
  const playerTeam = state.team.map(uid => {
    const c = state.collection.find(x => x.uid === uid); const d = SPECIES[c.species];
    return { uid: c.uid, species: c.species, level: c.level, hp: Math.floor(d.baseHp + c.level * 4), maxHp: Math.floor(d.baseHp + c.level * 4) };
  });
  if (state.modifiers?.healNext) {
    state.modifiers.healNext = false;
    saveState();
    toast('💊 Команда восстановлена!');
  }
  battleState = { player: playerTeam, enemy: enemyTeam, pIdx: 0, eIdx: 0, turn: 'player', log: 'Дикий тренер бросает вызов!' };
  showScreen('battle-screen');
  setBattleFighters(playerTeam[0].species, enemyTeam[0].species, playerTeam[0].level, enemyTeam[0].level);
  renderBattle();
}
function renderBattle() {
  const p = battleState.player[battleState.pIdx], e = battleState.enemy[battleState.eIdx];
  const pd = SPECIES[p.species], ed = SPECIES[e.species];
  document.getElementById('player-name').textContent = pd.name;
  document.getElementById('player-lvl').textContent = 'Ур. ' + p.level;
  document.getElementById('enemy-name').textContent = ed.name;
  document.getElementById('enemy-lvl').textContent = 'Ур. ' + e.level;
  const pPct = Math.max(0, p.hp / p.maxHp * 100), ePct = Math.max(0, e.hp / e.maxHp * 100);
  const pHp = document.getElementById('player-hp'), eHp = document.getElementById('enemy-hp');
  pHp.style.width = pPct + '%'; eHp.style.width = ePct + '%';
  pHp.className = 'hp-fill ' + (pPct < 25 ? 'low' : pPct < 50 ? 'mid' : '');
  eHp.className = 'hp-fill ' + (ePct < 25 ? 'low' : ePct < 50 ? 'mid' : '');
  document.getElementById('player-hp-text').textContent = `${Math.max(0, p.hp)}/${p.maxHp}`;
  document.getElementById('enemy-hp-text').textContent = `${Math.max(0, e.hp)}/${e.maxHp}`;
  document.getElementById('battle-log').innerHTML = battleState.log;
  const grid = document.getElementById('moves-grid');
  if (battleState.turn === 'player') {
    grid.innerHTML = pd.moves.map((m, i) => {
      const mv = MOVES[m]; const cls = mv.power >= 25 ? 'special' : '';
      return `<button class="move-btn ${cls}" onclick="useMove(${i})"><div class="move-name">${m}</div><div class="move-dmg">мощь ${mv.power} · точн ${Math.round(mv.acc * 100)}%</div></button>`;
    }).join('');
    if (battleState.player.length > 1 && battleState.player.some((x, i) => i !== battleState.pIdx && x.hp > 0)) {
      grid.innerHTML += `<button class="move-btn special" onclick="swapNext()"><div class="move-name">🔄 Сменить</div><div class="move-dmg">следующий боец</div></button>`;
    }
    grid.innerHTML += `<button class="move-btn danger" onclick="fleeBattle()"><div class="move-name">🏃 Бежать</div><div class="move-dmg">сдаться</div></button>`;
  } else {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:14px; opacity:0.7">Ход противника...</div>';
  }
}
function computeDamage(att, def, moveName) {
  const am = SPECIES[att.species], dm = SPECIES[def.species], mv = MOVES[moveName];
  if (Math.random() > mv.acc) return { miss: true, dmg: 0 };
  const a = am.atk + att.level, d = dm.def + Math.floor(def.level / 2);
  let dmg = Math.floor((a * mv.power / (d + 30)) + Math.random() * 3);
  let crit = false;
  if (Math.random() < 0.1) { dmg = Math.floor(dmg * 1.5); crit = true; }
  return { miss: false, dmg: Math.max(1, dmg), crit };
}
function trackCrit() {
  state.stats = state.stats || { wins: 0, crits: 0, catches: 0 };
  state.stats.crits++;
}
function useMove(moveIdx) {
  if (battleState.turn !== 'player') return;
  const p = battleState.player[battleState.pIdx], e = battleState.enemy[battleState.eIdx];
  const pd = SPECIES[p.species]; const moveName = pd.moves[moveIdx];
  const res = computeDamage(p, e, moveName);
  showMoveCallout(moveName);
  performAttack('player', moveName, !res.miss);
  battleState.log = res.miss
    ? `${pd.name} использует <b>${moveName}</b>... <span style="color:#94a3b8">мимо!</span>`
    : `${pd.name} использует <b>${moveName}</b>! ${res.crit ? '<span class="crit">КРИТ!</span> ' : ''}−${res.dmg} HP`;
  if (!res.miss) {
    e.hp -= res.dmg;
    spawnDamageNumber(res.dmg, 'enemy', res.crit);
    if (res.crit) trackCrit();
  }
  battleState.turn = 'enemy';
  renderBattle();
  setTimeout(checkBattleState, 1500);
}
function enemyTurn() {
  const p = battleState.player[battleState.pIdx], e = battleState.enemy[battleState.eIdx];
  const ed = SPECIES[e.species]; const moveName = ed.moves[Math.floor(Math.random() * ed.moves.length)];
  const res = computeDamage(e, p, moveName);
  showMoveCallout(moveName);
  performAttack('enemy', moveName, !res.miss);
  battleState.log = res.miss
    ? `${ed.name} использует <b>${moveName}</b>... <span style="color:#94a3b8">мимо!</span>`
    : `${ed.name} использует <b>${moveName}</b>! ${res.crit ? '<span class="crit">КРИТ!</span> ' : ''}−${res.dmg} HP`;
  if (!res.miss) {
    p.hp -= res.dmg;
    spawnDamageNumber(res.dmg, 'player', res.crit);
  }
  battleState.turn = 'player';
  renderBattle();
  setTimeout(checkBattleState, 1500);
}
function checkBattleState() {
  const p = battleState.player[battleState.pIdx], e = battleState.enemy[battleState.eIdx];
  if (e.hp <= 0) {
    battleState.log = `${SPECIES[e.species].name} <span style="color:#f87171">повержен!</span>`; renderBattle();
    battleState.eIdx++;
    if (battleState.eIdx >= battleState.enemy.length) return setTimeout(winBattle, 900);
    setTimeout(() => {
      battleState.turn = 'player'; battleState.log = 'Враг выпускает следующего!';
      setBattleFighters(p.species, battleState.enemy[battleState.eIdx].species, p.level, battleState.enemy[battleState.eIdx].level);
      renderBattle();
    }, 900); return;
  }
  if (p.hp <= 0) {
    battleState.log = `${SPECIES[p.species].name} в нокауте!`; renderBattle();
    const next = battleState.player.findIndex((x, i) => i > battleState.pIdx && x.hp > 0);
    if (next === -1) return setTimeout(loseBattle, 900);
    battleState.pIdx = next;
    setTimeout(() => {
      battleState.turn = 'player'; battleState.log = 'Выпускаешь следующего!';
      setBattleFighters(battleState.player[battleState.pIdx].species, e.species, battleState.player[battleState.pIdx].level, e.level);
      renderBattle();
    }, 900); return;
  }
  if (battleState.turn === 'enemy') setTimeout(enemyTurn, 600);
}
function swapNext() {
  if (battleState.turn !== 'player') return;
  const next = battleState.player.findIndex((x, i) => i !== battleState.pIdx && x.hp > 0);
  if (next === -1) { toast('Некого выпустить'); return; }
  battleState.pIdx = next;
  battleState.log = 'Меняешь бойца! Противник атакует.';
  battleState.turn = 'enemy';
  setBattleFighters(battleState.player[next].species, battleState.enemy[battleState.eIdx].species, battleState.player[next].level, battleState.enemy[battleState.eIdx].level);
  renderBattle();
  setTimeout(enemyTurn, 800);
}
function fleeBattle() { battleState = null; toast('Ты сбежал'); showScreen('map-screen'); }
function winBattle() {
  let xpGain = 0, coinGain = 0;
  for (const e of battleState.enemy) {
    const d = SPECIES[e.species];
    xpGain += 15 + e.level * 4 + (d.rarity - 1) * 15;
    coinGain += 10 + (d.rarity - 1) * 5;
  }
  state.player.coins += coinGain; state.player.balls += 2;
  state.stats = state.stats || { wins: 0, crits: 0, catches: 0 };
  state.stats.wins++;
  if (state.modifiers?.xpBoostUntil && Date.now() < state.modifiers.xpBoostUntil) xpGain = Math.floor(xpGain * 1.5);
  addXP(xpGain);
  triggerAchievementCheck({ type: 'win' });
  for (const p of battleState.player) {
    if (p.hp <= 0) continue;
    const c = state.collection.find(x => x.uid === p.uid); if (!c) continue;
    c.xp = (c.xp || 0) + Math.floor(xpGain / battleState.player.length);
    const need = 50 + c.level * 20;
    if (c.xp >= need) {
      c.xp -= need; c.level++;
      const d = SPECIES[c.species]; c.hp = Math.floor(d.baseHp + c.level * 4);
      toast(`⬆️ ${d.name} вырос до ур. ${c.level}!`);
    }
  }
  saveState(); battleState = null;
  showModal({ title: 'Победа!', text: 'Ты разбил команду противника', stats: `+${xpGain} XP · +${coinGain} 💰 · +2 🧹` });
  showScreen('map-screen');
}
function loseBattle() {
  battleState = null;
  let lost = Math.min(state.player.coins, 10);
  let saved = false;
  if (state.modifiers?.savedFromLoss > 0) {
    state.modifiers.savedFromLoss--;
    lost = 0; saved = true;
  }
  state.player.coins -= lost; saveState(); refreshHUD();
  showModal({
    title: 'Поражение',
    text: saved ? '💖 Тебя спасла защита!' : 'Подлечись и поймай новых бойцов',
    stats: lost > 0 ? `−${lost} 💰` : (saved ? '0 💰 (защита!)' : ''),
  });
  showScreen('map-screen');
}

/* ============== INIT ============== */
window.addEventListener('load', () => {
  initCatchScene(document.getElementById('catch-canvas'), isCatchActive);
  initBattleScene(document.getElementById('battle-canvas'), isBattleActive);
  preloadAllSprites();
  refreshHUD();
  updateARButtons();
  startGeolocation();
});

window.showScreen = showScreen;
window.centerOnPlayer = centerOnPlayer;
window.renderCollection = renderCollection;
window.renderTeamScreen = renderTeamScreen;
window.toggleTeam = toggleTeam;
window.onCollectionCardClick = onCollectionCardClick;
window.startTrainerBattle = startTrainerBattle;
window.throwBall = throwBall;
window.useMove = useMove;
window.swapNext = swapNext;
window.fleeBattle = fleeBattle;
window.endCatch = endCatch;
window.closeModal = closeModal;
window.toggleAR = toggleAR;
window.renderShop = renderShop;
window.buyShopItem = buyShopItem;
window.doPowerUp = doPowerUp;
