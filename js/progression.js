export const ACHIEVEMENTS = [
  { id: 'first_catch',    icon: '🎯', name: 'Первый улов',      desc: 'Поймай первого скибиди',          reward: { coins: 20 },             check: (s, ev) => ev?.type === 'catch' && s.collection.length === 1 },
  { id: 'catch_10',       icon: '🏹', name: 'Скибиди-охотник',  desc: '10 скибиди в коллекции',          reward: { coins: 50, balls: 5 },   check: s => s.collection.length >= 10 },
  { id: 'catch_25',       icon: '📚', name: 'Коллекционер',     desc: '25 скибиди в декс',                reward: { coins: 100, balls: 10 }, check: s => s.collection.length >= 25 },
  { id: 'catch_rare',     icon: '⭐', name: 'Редкая встреча',   desc: 'Поймай редкого (★★★+)',          reward: { coins: 80 },             check: (s, ev) => ev?.type === 'catch' && ev?.rarity >= 3 },
  { id: 'catch_titan',    icon: '🦾', name: 'Титан в кармане',  desc: 'Поймай титана (★★★★)',          reward: { coins: 200, balls: 20 }, check: (s, ev) => ev?.type === 'catch' && ev?.rarity >= 4 },
  { id: 'catch_legend',   icon: '👑', name: 'ЛЕГЕНДА!',          desc: 'Поймай легендарного (★★★★★)', reward: { coins: 500, balls: 30 }, check: (s, ev) => ev?.type === 'catch' && ev?.rarity >= 5 },
  { id: 'win_1',          icon: '🥇', name: 'Первая победа',    desc: 'Выиграй первый бой',              reward: { coins: 30 },             check: (s, ev) => ev?.type === 'win' },
  { id: 'win_10',         icon: '🥊', name: 'Бойцовский клуб',  desc: '10 побед в боях',                  reward: { coins: 150, balls: 10 }, check: s => (s.stats?.wins || 0) >= 10 },
  { id: 'perfect_catch',  icon: '💯', name: 'Идеально!',         desc: 'Идеальный бросок',                 reward: { coins: 40 },             check: (s, ev) => ev?.type === 'perfect_catch' },
  { id: 'level_5',        icon: '⚡', name: 'Опытный',           desc: 'Достигни 5 уровня',                reward: { coins: 60 },             check: s => s.player.level >= 5 },
  { id: 'level_10',       icon: '🌟', name: 'Мастер',            desc: 'Достигни 10 уровня',               reward: { coins: 200, balls: 20 }, check: s => s.player.level >= 10 },
  { id: 'all_common',     icon: '🎴', name: 'Все обычные',      desc: 'Все 4 обычных вида в декс',       reward: { coins: 100 },            check: s => ['toilet','singer','bigtoilet','dj'].every(sp => s.collection.some(c => c.species === sp)) },
  { id: 'all_rare',       icon: '🎁', name: 'Все редкие',        desc: 'Все 3 редких вида в декс',        reward: { coins: 200 },            check: s => ['camera','speaker','tvman'].every(sp => s.collection.some(c => c.species === sp)) },
  { id: 'team_full',      icon: '⚔️', name: 'Команда мечты',    desc: 'Полная команда из 3 бойцов',      reward: { coins: 40 },             check: s => s.team.length >= 3 },
  { id: 'crit_master',    icon: '✦',  name: 'Критмен',            desc: 'Сделай 10 критов',                  reward: { coins: 80 },             check: s => (s.stats?.crits || 0) >= 10 },
];

export function checkAchievements(state, event) {
  if (!state.achievements) state.achievements = [];
  const newOnes = [];
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements.includes(ach.id)) continue;
    if (ach.check(state, event)) {
      newOnes.push(ach);
      state.achievements.push(ach.id);
    }
  }
  return newOnes;
}

export const SHOP_ITEMS = [
  { id: 'vac5',    icon: '🧹',  name: 'Вакуум-набор',      desc: '+5 вакуумов',                            cost: 25,  color: '#fbbf24', apply: s => { s.player.balls += 5; } },
  { id: 'vac20',   icon: '🪣',  name: 'Бочка вакуумов',    desc: '+20 вакуумов',                           cost: 90,  color: '#fbbf24', apply: s => { s.player.balls += 20; } },
  { id: 'heal',    icon: '💊',  name: 'Универсальная аптечка', desc: 'Полное лечение команды (на след бой)', cost: 50,  color: '#4ade80', apply: s => { s.modifiers = s.modifiers || {}; s.modifiers.healNext = true; } },
  { id: 'bait',    icon: '🎁',  name: 'Редкая приманка',   desc: 'Следующий спавн — гарантированно ★★★+', cost: 120, color: '#a855f7', apply: s => { s.modifiers = s.modifiers || {}; s.modifiers.rareBait = true; } },
  { id: 'lucky',   icon: '🍀',  name: 'Талисман удачи',    desc: '+30% к шансу поимки (3 броска)',         cost: 70,  color: '#10b981', apply: s => { s.modifiers = s.modifiers || {}; s.modifiers.luckyCharms = (s.modifiers.luckyCharms || 0) + 3; } },
  { id: 'xp_boost',icon: '⚡',  name: 'XP-буст',            desc: '+50% XP на 5 минут',                     cost: 80,  color: '#5a4fff', apply: s => { s.modifiers = s.modifiers || {}; s.modifiers.xpBoostUntil = Date.now() + 5 * 60 * 1000; } },
  { id: 'revive',  icon: '💖',  name: 'Воскрешение',        desc: 'Не теряешь монеты при поражении (раз)',  cost: 60,  color: '#ff44aa', apply: s => { s.modifiers = s.modifiers || {}; s.modifiers.savedFromLoss = (s.modifiers.savedFromLoss || 0) + 1; } },
  { id: 'mega',    icon: '🌟',  name: 'МЕГА-набор',          desc: '+10 вакуумов, +50 монет, лечение',     cost: 150, color: '#ff8800', apply: s => { s.player.balls += 10; s.player.coins += 50; s.modifiers = s.modifiers || {}; s.modifiers.healNext = true; } },
];

export function powerUpCost(level) { return 15 + level * 10; }

export function canPowerUp(state, creature) {
  return state.player.coins >= powerUpCost(creature.level);
}

export function powerUp(state, creature, speciesData) {
  const cost = powerUpCost(creature.level);
  if (state.player.coins < cost) return false;
  state.player.coins -= cost;
  creature.level++;
  creature.hp = Math.floor(speciesData.baseHp + creature.level * 4);
  creature.xp = 0;
  return true;
}
