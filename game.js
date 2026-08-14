'use strict';
/* ============================================================
   ANGLER! — Game engine: world, boat, fishing, economy
   Made by Dave-VR
   ============================================================ */

window.fmt = n => n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e3 ? (n/1e3).toFixed(1)+'K' : ''+Math.floor(n);
window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => document.getElementById(id);

/* ---------------- catalog ---------------- */
const MASTER = [], BY_LOC = {}, BY_NAME = {};
(function buildCatalog(){
  for(const loc in FISH_DATA){
    BY_LOC[loc] = [];
    for(const f of FISH_DATA[loc]){
      const e = {
        key: loc+'|'+f[0], name: f[0], rar: f[1], water: f[2],
        weather: f[3], time: f[4],
        min: (+f[5])>0 ? +f[5] : null, max: (+f[6])>0 ? +f[6] : null,
        img: f[7], loc
      };
      MASTER.push(e); BY_LOC[loc].push(e);
      if(!BY_NAME[e.name]) BY_NAME[e.name] = e;
    }
  }
})();

const RARITY_ORDER = ['Abundant','Common','Curious','Elusive','Fabled','Mythic','Exotic'];
const gearById = (arr,id) => arr.find(x => x.id===id) || arr[0];
const islandById = id => ISLANDS.find(x => x.id===id);
const mulberry = (a)=>{ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };

/* ---------------- save ---------------- */
const SAVE_KEY = 'fishvr_save';
function freshSave(){
  return {
    ver: 1, id: '', name: '',
    coins: 0, lifetime: 0, level: 1, xp: 0,
    index: {}, caught: [], items: {},
    rod: 'sunleaf', line: 'basic', bobber: 'basic', boat: 'surf',
    ownedRods: ['stick','sunleaf'], ownedLines: ['basic'], ownedBobbers: ['basic'], ownedBoats: ['surf'],
    enchant: null, pity: 0, enchantLog: [],
    quests: { done: {}, active: {} },
    titles: { done: {} }, selectedTitle: '',
    codes: {},
    autopets: {}, autoSell: false, badges: {},
    avatar: { gender:'female', skin:'warm', hair:'long', hairColor:'brown', outfit:'teal' },
    potionLuck: 0, potionSpeed: 0,
    bounties: { date: '', list: [] },
    stats: { totalCaught:0, totalSold:0, perfect:0, big:0, maxWt:0, bounties:0 },
    sound: true
  };
}
let save = freshSave();
function loadSave(){
  let raw = null;
  try{ raw = JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){}
  if(raw && raw.ver){
    save = Object.assign(freshSave(), raw);
    save.quests = Object.assign({done:{},active:{}}, raw.quests||{});
    save.titles = Object.assign({done:{}}, raw.titles||{});
    save.selectedTitle = (raw.selectedTitle && save.titles.done[raw.selectedTitle]) ? raw.selectedTitle : '';
    /* Keep the title old saves were already showing selected after this upgrade. */
    if(!Object.prototype.hasOwnProperty.call(raw,'selectedTitle')) save.selectedTitle=activeTitle()||'';
    save.stats = Object.assign({totalCaught:0,totalSold:0,perfect:0,big:0,maxWt:0,bounties:0}, raw.stats||{});
    save.badges = Object.assign({}, raw.badges||{});
    save.avatar = Object.assign({gender:'female', skin:'warm', hair:'long', hairColor:'brown', outfit:'teal'}, raw.avatar||{});
    if(raw.codes&&raw.codes.WITCHY&&!save.avatar.special) save.avatar=Object.assign(save.avatar,{gender:'female',hair:'long',hairColor:'black',outfit:'violet',special:'witchy'});
  }
}
function persist(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){}
}
function resetSave(){
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
  save = freshSave();
  G.state.weather = 'Clear'; G.state.time = 'Day';
  G.boat.x = 650; G.boat.y = 700; G.boat.head = -Math.PI/2;
  G.player.onFoot=false; G.player.x=650; G.player.y=700; G.player.island=null;
}

/* ---------------- state ---------------- */
const G = {
  get save(){ return save; },
  state: { weather:'Clear', time:'Day', weatherT:0, timeT:0, levi:null, running:false },
  cam: { x:650, y:700, zoom:0.7 },
  boat: { x:650, y:700, head:-Math.PI/2, speed:0, boost:0, boostCd:0 },
  player: { onFoot:false, x:650, y:700, head:0, island:null },
  input: { x:0, y:0, boost:false, hold:false, joyAng:null, joyMag:0 },
  joy: { x:0, y:0 },
  fish: { state:'idle', pool:null, t:0, biteAt:0, game:null, catch:null },
  effects: [], sparkles: [],
  blockedIsland: null,
  saveTimer: 0, hudTimer: 0, mmTimer: 0, leviSyncTimer: 0, pinkTrailTimer: 0, witchTrailTimer: 0, jackTrailTimer: 0, betaTrailTimer: 0, betaTrailIndex: 0, weatherDur: 0,
  frame: 0
};
const Fishing = { lastBiteCheck:0, held:false, lastStatus:'' };

/* ---------------- stats & gear ---------------- */
function curRod(){ return gearById(RODS, save.rod); }
function curEnchant(){
  if(!save.enchant) return null;
  return ENCHANTS.find(e => e.id === save.enchant) || null;
}
function statSums(){
  const rod = curRod(), line = gearById(LINES, save.line), bob = gearById(BOBBERS, save.bobber), ench = curEnchant();
  const w = G.state.weather, t = G.state.time;
  let luck=0, str=0, exp=0, att=0, big=0, maxW=rod.maxW||0, xp=0, val=0;
  const add = o => { luck+=(o.luck||0); str+=(o.str||0); exp+=(o.exp||0); att+=(o.att||0); big+=(o.big||0); maxW+=(o.maxW||0); xp+=(o.xp||0); };
  add(rod); add(line); add(bob);
  if(ench){
    add(ench);
    if(ench.name==='Day Walker' && t==='Day') add({luck:50});
    if(ench.name==='Fog Dweller' && w==='Foggy') add({luck:50});
    if(ench.name==='Night Stalker' && t==='Night') add({att:35});
    if(ench.name==='Rain Lover' && (w==='Rainy'||w==='Stormy')) add({luck:50});
    if(ench.name==='The Night Watcher' && t==='Night') add({luck:30,str:10,exp:10,att:30,big:30,maxW:25000});
    if(ench.name==='Son of Kriptan' && t==='Day') add({luck:50,str:10,exp:10,att:50,big:50,maxW:50000});
    if(ench.name==='Money Maker') val += 20;
    if(ench.name==='Pocket Watcher') val += 5;
  }
  for(const tl of TITLES){ if(tl.type==='index' && save.titles.done[tl.name]) luck += 15; }
  return { luck, str, exp, att, big, maxW, xp, val, ench };
}
function luckMultipliers(){
  const w = G.state.weather;
  let luckMult = 1;
  if(w === 'Moonrain') luckMult *= 2;
  const pool = G.fish.pool;
  if(pool && pool.pool && POOL_MODS[pool.pool] && POOL_MODS[pool.pool].luck) luckMult *= POOL_MODS[pool.pool].luck;
  if(save.potionLuck > 0) luckMult *= 1.5;
  return luckMult;
}
function currentPoolObj(){
  const pool = G.fish.pool;
  return pool && pool.pool ? POOL_MODS[pool.pool] : null;
}
function effLuck(){
  const s = statSums();
  return s.luck * luckMultipliers();
}
function effAtt(){
  const s = statSums();
  let a = s.att;
  if(save.potionSpeed > 0) a += 100;
  return a;
}

/* ---------------- weather & time ---------------- */
function nextWeather(){
  const roll = Math.random()*100;
  let w;
  if(roll < 34) w='Clear';
  else if(roll < 56) w='Rainy';
  else if(roll < 72) w='Stormy';
  else if(roll < 86) w='Foggy';
  else if(roll < 96) w='Moonrain';
  else w='Ancient Tide';
  G.state.weather = w;
  G.state.weatherDur = 90 + Math.random()*150;
  toast('🌦️ Weather: '+w+' '+(WEATHER_ICONS[w]||''));
}
function advanceTime(){
  const seq=['Morning','Day','Evening','Night'];
  const i=seq.indexOf(G.state.time);
  G.state.time = seq[(i+1)%seq.length];
}
function leviStatus(){
  const now = new Date();
  const start = new Date(now); start.setUTCMinutes(0,0,0);
  const end = new Date(start.getTime()); end.setUTCMinutes(end.getUTCMinutes()+10);
  if(now >= start && now < end) return { active:true, start, end };
  const next = new Date(start.getTime()); next.setUTCHours(next.getUTCHours()+1);
  return { active:false, start:next, end:null };
}
function leviHealth(){
  const lv=leviStatus();
  const event=G.state.levi;
  const hunters=Math.max(1,(event&&event.hunters)||leviHunterCount());
  const fallback=16+14*hunters;
  if(!lv.active||!event) return {hp:fallback,maxHp:fallback,hunters,winner:null};
  const maxHp=event.maxHp||fallback;
  return {hp:Math.max(0,Math.min(maxHp,event.hp==null?maxHp:event.hp)),maxHp,hunters,winner:event.winner||null};
}
function leviHunterCount(){
  let n=0;
  if(Math.hypot(G.boat.x-LEVIATHAN_SPOT.x,G.boat.y-LEVIATHAN_SPOT.y)<LEVIATHAN_SPOT.r) n++;
  const players=(window.Multi&&Multi.players)||{};
  for(const id in players){
    const p=players[id];
    if(Math.hypot(p.x-LEVIATHAN_SPOT.x,p.y-LEVIATHAN_SPOT.y)<LEVIATHAN_SPOT.r) n++;
  }
  return Math.max(1,n);
}

/* ---------------- location ---------------- */
function detectLoc(){
  const b = G.player.onFoot ? G.player : G.boat;
  for(const isl of ISLANDS){
    const d = Math.hypot(b.x-isl.x, b.y-isl.y);
    if(d < isl.r*0.85) return { name:isl.name, island:isl };
  }
  const lv = leviStatus();
  if(lv.active){
    const d = Math.hypot(b.x-LEVIATHAN_SPOT.x, b.y-LEVIATHAN_SPOT.y);
    if(d < LEVIATHAN_SPOT.r) return { name:'Leviathan', levi:true, pool:'Leviathan' };
  }
  for(const p of POOLS){
    const d = Math.hypot(b.x-p.x, b.y-p.y);
    if(d < p.r) return { name:p.name, pool:p.name };
  }
  return { name:OPEN_SEA.name, sea:true };
}
const SECRET_LOC = {};
(function(){
  for(const f of BY_LOC['Secret Fish']){
    const w = f.water||'';
    if(w.indexOf('/')>-1) SECRET_LOC[f.name] = w.split('/')[0];
  }
})();

/* ---------------- fishing: pool selection ---------------- */
function buildPool(loc){
  let list = [], poolMod = null, levi = false;
  if(loc.levi){ list = BY_LOC['Leviathan'].slice(); levi = true; }
  else if(loc.island){ list = BY_LOC[loc.island.name].slice(); }
  else if(loc.pool){ list = BY_LOC['Open Sea'].slice(); poolMod = POOL_MODS[loc.pool]; }
  else { list = BY_LOC['Open Sea'].slice(); }
  const t = G.state.time, w = G.state.weather;
  list = list.filter(f => (f.time==='Any'||f.time===t) && (f.weather==='Any'||f.weather===w));
  return { list, poolMod, levi, name:loc.name, island:loc.island||null, pool:loc.pool||null };
}

function pickFromWeighted(pairs){
  let total = 0;
  for(const p of pairs) total += p[1];
  if(total <= 0) return null;
  let r = Math.random()*total;
  for(const p of pairs){ r -= p[1]; if(r <= 0) return p[0]; }
  return pairs[pairs.length-1][0];
}

function pickNormalFish(list){
  const luck = effLuck();
  const w = G.state.weather;
  const pairs = list.map(f => {
    let weight = RARITIES[f.rar].w || 1;
    const idx = RARITY_ORDER.indexOf(f.rar);
    if(idx >= 0) weight *= Math.max(0.1, 1 + (luck/100)*(idx/6));
    if(f.weather !== 'Any' && f.weather === w) weight *= 1.5;
    return [f, weight];
  });
  return pickFromWeighted(pairs);
}

function rollWeight(f, stat){
  let mn = f.min, mx = f.max;
  if(mn == null) mn = 0.5;
  if(mx == null) mx = 5;
  if(mx <= mn){ mx = mn + 0.5; }
  let t = Math.random();
  const big = stat.big||0;
  if(big > 0) t = Math.pow(t, 1/(1+big/70));
  else if(big < 0) t = Math.pow(t, 1/(1+(-big)/45));
  let huge = false, tiny = false, wt;
  if(Math.random() < 0.08){ huge = true; wt = mn + (mx-mn)*(0.85+Math.random()*0.15); }
  else if(Math.random() < 0.1){ tiny = true; wt = mn + (mx-mn)*Math.random()*0.35; }
  else wt = mn + (mx-mn)*t;
  return { wt, huge, tiny };
}

function rollMutation(){
  const ench = curEnchant();
  let chance = 0.04;
  if(ench && ench.name==='Unstable') chance *= 1.5;
  if(ench && ench.name==='Mutator') chance *= 2;
  const pmod = currentPoolObj();
  if(pmod && pmod.mutation) chance *= pmod.mutation;
  if(Math.random() > chance) return null;
  let boosts = {};
  if(pmod && pmod.mut) for(const m of pmod.mut) boosts[m] = 1;
  if(ench && ench.name==='Shiny Hunter' && Math.random() < 0.20) return mut('Shiny');
  if(ench && (ench.name==='Demon Hunter') && Math.random() < 0.15) return mut('Cursed');
  if(ench && (ench.name==='Speed Demon') && Math.random() < 0.05) return mut('Cursed');
  const pairs = MUTATIONS.map(m => [m, 1 + (boosts[m.name]?6:0)]);
  return pickFromWeighted(pairs);
  function mut(n){ return MUTATIONS.find(m => m.name===n); }
}

function relicWeight(){
  return { 'Old Relic Piece':40, 'Mossy Relic':30, 'Powerful Relic':20,
    'Mysterious Red Gem':3.5, 'Ghastly Skull':3.5, 'Dimensional Dongle':2.5, 'Fuel Compositor':1.5 };
}

function rollFish(){
  const pool = G.fish.pool;
  const stat = statSums();
  const ench = stat.ench;
  const weather = G.state.weather;
  const ancient = weather === 'Ancient Tide';

  if(pool.levi){
    const f = pickNormalFish(pool.list);
    return makeCatch(f, stat);
  }

  const r = Math.random();
  let roll;
  if(r < 0.0011){ roll = { type:'secret' }; }
  else if(r < 0.0011 + (ancient?0.0075:0.0025)){ roll = { type:'relic' }; }
  else if(r < 0.0011 + (ancient?0.0075:0.0025) + 0.09){ roll = { type:'trash' }; }
  else if(r < 0.0011 + (ancient?0.0075:0.0025) + 0.09 + 0.03){ roll = { type:'event' }; }
  else roll = { type:'normal' };

  if(roll.type === 'secret'){
    const here = locName();
    let secrets = BY_LOC['Secret Fish'].filter(f => {
      const sl = SECRET_LOC[f.name];
      return !sl || sl === here;
    });
    const ult = secrets.filter(f => f.rar === 'Ultimate Secret');
    const reg = secrets.filter(f => f.rar === 'Secret');
    if(Math.random() < 0.3 && ult.length) return makeCatch(ult[Math.floor(Math.random()*ult.length)], stat, true);
    if(reg.length) return makeCatch(reg[Math.floor(Math.random()*reg.length)], stat, true);
  }
  if(roll.type === 'relic'){
    const item = pickFromWeighted(Object.entries(relicWeight()));
    const f = BY_NAME[item] || BY_LOC['Relics'][0];
    return makeRelic(f, stat);
  }
  if(roll.type === 'trash'){
    const trash = BY_LOC['Trash'];
    return makeCatch(trash[Math.floor(Math.random()*trash.length)], stat);
  }
  if(roll.type === 'event'){
    let ev = BY_LOC['Event Fish'].filter(f => {
      if(f.water === 'Lucky Pool') return ancient || weather === 'Moonrain';
      return true;
    });
    if(!ev.length) ev = BY_LOC['Event Fish'].filter(f => f.water !== 'Lucky Pool');
    return makeCatch(ev[Math.floor(Math.random()*ev.length)], stat);
  }
  const f = pickNormalFish(pool.list);
  if(!f) return null;
  return makeCatch(f, stat);
}

function makeCatch(f, stat, secretRoll){
  const w = rollWeight(f, stat);
  const mut = secretRoll ? (Math.random()<0.05?rollMutation():null) : rollMutation();
  const huge = w.huge, tiny = w.tiny, wt = w.wt;
  let rar = f.rar;
  if(secretRoll && rar === 'Secret' && mut) rar = mut.name === 'Shiny' ? 'Secret' : rar;
  const valBase = Math.max(1, Math.round(wt * (RARITIES[rar].val||1) * (mut?mut.mult:1) * (huge?1.5:1) * (tiny?0.7:1)));
  const catchObj = {
    name: f.name, img: f.img, rar, wt: Math.round(wt*100)/100,
    mut: mut ? mut.name : null, huge, tiny,
    perfect: false, val: valBase, xp: 0, new: false, sold: false,
    key: f.key, loc: f.loc, emoji: '🐟'
  };
  return catchObj;
}
function makeRelic(f, stat){
  return { relic:true, name:f.name, img:f.img, key:f.key, loc:f.loc, emoji:'🏺' };
}
function locName(){ return G.fish.pool ? G.fish.pool.name : ''; }

/* ---------------- fishing state machine ---------------- */
function biteDelay(){
  const att = effAtt();
  const base = (2.5 + Math.random()*4.5) * Math.max(0.15, (1 - Math.min(100,att)/100));
  return Math.max(0.35, base) * (0.8 + Math.random()*0.4);
}

function cast(){
  if(G.fish.state !== 'idle') return;
  if(G.player.onFoot){ toast('🚤 Board your boat before casting.','bad'); return; }
  const loc = detectLoc();
  const pool = buildPool(loc);
  if(!pool.list.length){
    toast('No fish are biting here right now…','bad');
    return;
  }
  G.fish.state = 'waiting';
  G.fish.pool = pool;
  G.fish.biteAt = performance.now() + biteDelay()*1000;
  G.fish.t = 0;
  if(save.potionLuck > 0) save.potionLuck--;
  if(save.potionSpeed > 0) save.potionSpeed--;
  persist();
  showFishUI();
  setStatus('Waiting for a bite…', '');
  sfx(640,0.05,0.1,'sine');
}

function onBite(){
  const stat = statSums();
  const catchObj = rollFish();
  if(!catchObj){ escape('…the bait is gone.'); return; }
  G.fish.catch = catchObj;
  if(catchObj.relic){ resolveCatch(); return; }
  const maxW = stat.maxW || 5;
  if(catchObj.wt > maxW){
    escape('It was too heavy for your rod! '+(catchObj.wt>1000?fmt(catchObj.wt)+'kg':'')+' broke the line…');
    sfx(180,0.25,0.12,'square');
    return;
  }
  beginReel(catchObj, stat);
}

function beginReel(c, stat){
  G.fish.state = 'reeling';
  G.fish.catch = c;
  const diff = Math.min(1, (c.wt/25)) + Math.max(0, RARITY_ORDER.indexOf(c.rar))*0.055;
  const str = stat.str||0;
  const m = {
    marker: 0.5, sweetC: 0.5,
    sweetW: Math.min(0.44, 0.3 + (stat.exp||0)*0.0020),
    progress: 0.5, t: 0, diff,
    drift: 0.30 + diff*0.30,
    pull: 0.95 - diff*0.30 + Math.min(0.4, str*0.003),
    jitter: 0.02 + diff*0.05,
    yankT: 1.2 + Math.random()*1.5,
    yankMag: 0,
    catchObj: c
  };
  G.fish.game = m;
  showReelUI();
  const col = (RARITIES[c.rar] && RARITIES[c.rar].color) || '#7fe7ff';
  const mk = byId('marker');
  mk.classList.remove('rainbow','us');
  if(c.rar === 'Secret') mk.classList.add('rainbow');
  else if(c.rar === 'Ultimate Secret') mk.classList.add('us');
  mk.style.background = col;
  mk.style.boxShadow = '0 0 14px '+col+', 0 0 30px '+col;
  byId('progFill').style.background = col;
  byId('progFill').style.boxShadow = '0 0 10px '+col;
  byId('fishDot').style.background = col;
  byId('fishDot').style.boxShadow = '0 0 12px '+col;
  byId('fishStatus').style.color = col;
  byId('fishName').textContent = '🎣 '+c.rar+' fish on the line!';
  updateReelUI();
  sfx(880,0.06,0.08,'sine');
}

function updateReelUI(){
  const m = G.fish.game;
  if(!m) return;
  const S = byId('sweet'), P = byId('perfect'), M = byId('marker'), F = byId('progFill');
  S.style.top = ((m.sweetC-m.sweetW/2)*100)+'%';
  S.style.height = (m.sweetW*100)+'%';
  const pw = m.sweetW*0.4;
  P.style.top = ((m.sweetC-pw/2)*100)+'%';
  P.style.height = (pw*100)+'%';
  M.style.top = (m.marker*100)+'%';
  F.style.height = (m.progress*100)+'%';
}

function tickReel(dt){
  const m = G.fish.game;
  if(!m) return;
  m.t += dt;

  m.yankT -= dt;
  if(m.yankT <= 0){
    m.yankT = 1.2 + Math.random()*2.5;
    m.yankMag = (Math.random() < 0.5 ? -1 : 1) * (0.06 + m.diff*0.10);
  }
  m.yankMag *= Math.max(0, 1 - dt*2.5);

  const held = G.input.hold || Fishing.held;
  if(held){
    const toC = m.sweetC - m.marker;
    m.marker += Math.sign(toC) * Math.min(Math.abs(toC), m.pull*dt);
    m.marker += (Math.random()*2-1) * m.jitter * dt * 1.5;
  } else {
    const dir = m.marker < m.sweetC ? -1 : 1;
    m.marker += dir * m.drift * dt;
    m.marker += (Math.random()*2-1) * m.jitter * dt;
  }
  m.marker += m.yankMag * dt * 3;
  m.marker = Math.min(1, Math.max(0, m.marker));

  const inZ = Math.abs(m.marker - m.sweetC) <= m.sweetW/2;
  const inP = Math.abs(m.marker - m.sweetC) <= m.sweetW*0.25;
  if(held){
    if(inZ) m.progress += (0.35 + (inP?0.15:0)) * dt;
    else m.progress -= 0.03 * dt;
  } else {
    m.progress -= 0.10 * dt;
  }
  m.progress = Math.min(1, Math.max(0, m.progress));
  if(m.progress <= 0){ escape('The fish got away!'); return; }
  if(m.progress >= 1){
    const c = m.catchObj;
    c.perfect = inP;
    resolveCatch();
    return;
  }
  updateReelUI();
}

function escape(msg){
  G.fish.state = 'idle';
  G.fish.game = null;
  G.fish.catch = null;
  hideFishUI();
  toast(msg, 'bad');
  sfx(150,0.3,0.12,'square');
}

function resolveCatch(){
  const c = G.fish.catch;
  G.fish.state = 'idle';
  G.fish.game = null;
  G.fish.catch = null;
  hideFishUI();
  if(c.relic){
    const wasNewR = !save.index[c.name];
    addItem(relicToKey(c.name), 1);
    save.index[c.name] = true;
    updateQuests({name:c.name, rar:'Relic', relic:true});
    checkIndexCompletion(c.name);
    persist();
    UI.showCatch(c, {relic:true, newF:wasNewR});
    sfx(660,0.12,0.1,'triangle');
    return;
  }
  const stat = statSums();
  let xp = Math.floor((c.perfect ? (RARITIES[c.rar].xpPerfect||RARITIES[c.rar].xp) : (RARITIES[c.rar].xp||10))
    * (c.huge?1.5:1) * (1 + (stat.xp||0)/100));
  c.xp = xp;
  let bonusCoins = 0;
  if(stat.ench){
    if(stat.ench.name==='Pocket Watcher') bonusCoins += Math.round(c.val*0.05);
    if(stat.ench.name==='Money Maker') bonusCoins += Math.round(c.val*0.20);
  }
  const wasNew = !save.index[c.name];
  c.new = wasNew;
  save.index[c.name] = true;
  save.caught.push(c);
  if(save.caught.length > 250) save.caught.shift();
  save.stats.totalCaught++;
  if(c.huge) save.stats.big++;
  if(c.perfect) save.stats.perfect++;
  save.stats.maxWt = Math.max(save.stats.maxWt, c.wt);
  updateQuests(c);
  updateBounties(c);
  checkIndexCompletion(c.name);
  addXp(xp);
  let sold = null;
  if(save.autoSell && (save.autopets.vlad || save.autopets.levi)){
    const v = c.val + bonusCoins;
    save.coins += v; save.lifetime += v; save.stats.totalSold++;
    c.sold = true; sold = v;
    save.caught = save.caught.filter(x => x !== c);
  } else if(bonusCoins > 0){
    save.coins += bonusCoins; save.lifetime += bonusCoins;
  }
  if(stat.ench && stat.ench.name==='Double Up!!' && Math.random() < 0.25){
    const c2 = Object.assign({}, c, { sold: sold!==null });
    if(sold!==null){ save.coins += c.val; save.lifetime += c.val; save.stats.totalSold++; }
    else save.caught.push(c2);
    c.double = true;
  }
  persist();
  UI.showCatch(c, { sold, bonusCoins });
  sfx(c.perfect ? 1200 : 980, 0.15, 0.12, c.perfect?'triangle':'sine');
  Net.throttledSubmit();
  if(G.fish.pool && G.fish.pool.levi) damageLeviathanCatch();
}

function damageLeviathanCatch(){
  Net.damageLeviathan(leviHunterCount()).then(result=>{
    if(!result.ok) return;
    if(result.won) awardLeviathanWinner(result.event.hour);
  });
}
function awardLeviathanWinner(hour){
  const prizeKey='fishvr_levi_prize_'+hour;
  try{ if(localStorage.getItem(prizeKey)) return; localStorage.setItem(prizeKey,'1'); }catch(e){}
  const f=BY_NAME['Leviathan Eye'];
  if(!f) return;
  const prize=makeCatch(f,statSums());
  prize.wt=10; prize.val=Math.max(prize.val,5000); prize.new=!save.index[prize.name];
  save.index[prize.name]=true; save.caught.push(prize); save.stats.totalCaught++;
  updateQuests(prize); updateBounties(prize); checkIndexCompletion(prize.name);
  addXp(RARITIES.Exotic.xpPerfect||75); persist();
  toast('🏆 FINAL CATCH! You claimed the Leviathan Eye!','gold');
  UI.showCatch(prize,{bonusCoins:0}); Net.bump();
}

function relicToKey(name){
  return { 'Old Relic Piece':'relicOld', 'Mossy Relic':'relicMos', 'Powerful Relic':'relicPow',
    'Mysterious Red Gem':'relicOld', 'Ghastly Skull':'relicOld', 'Dimensional Dongle':'relicMos', 'Fuel Compositor':'relicPow' }[name] || 'relicOld';
}

/* ---------------- quests & bounties ---------------- */
function questUnlocked(q){
  if(q.lvl && save.level < q.lvl) return false;
  if(q.unlock === 'twilight' && !save.quests.done.breakin) return false;
  if(q.unlock === 'boat_galleon' && !save.quests.done.galleon) return false;
  if(q.unlock === 'quest_alien' && !save.quests.done.alien) return false;
  return true;
}
function activeQuests(){
  return QUESTS.filter(q => !save.quests.done[q.id] && questUnlocked(q));
}
function questProg(q){
  const a = save.quests.active[q.id] || (save.quests.active[q.id] = q.req.map(()=>0));
  return a;
}
function updateQuests(c){
  for(const q of activeQuests()){
    const prog = questProg(q);
    q.req.forEach((r,i) => {
      if(prog[i] >= (r.count||1)) return;
      if(r.fish && c.name === r.fish) prog[i] += (c.relic?0:1);
      else if(r.rarity && (r.rarity === c.rar || (r.rarity==='Relic' && c.relic))) prog[i]++;
      else if(r.trash && c.rar === 'Trash') prog[i]++;
    });
  }
}
function claimQuest(qid){
  const q = QUESTS.find(x => x.id === qid);
  if(!q) return;
  const prog = questProg(q);
  if(q.req.some((r,i) => prog[i] < (r.count||1))) return;
  save.quests.done[q.id] = true;
  delete save.quests.active[q.id];
  if(q.coins){ save.coins += q.coins; save.lifetime += q.coins; }
  if(q.xp) addXp(q.xp);
  if(q.items) for(const k in q.items) addItem(k, q.items[k]);
  if(q.bobber) save.ownedBobbers.push(q.bobber);
  if(q.title) grantTitle(q.title, true);
  if(q.unlock === 'boat_galleon') save.ownedBoats.push('galleon');
  if(q.id === 'alien') save.ownedLines.push('ethereal');
  if(q.id === 'ominousegg') addItem('egg', 1);
  persist();
  checkTitle('quest', q.id);
  toast('✅ Quest complete: '+q.name+'!', 'good');
  UI.refreshQuests();
  Net.bump();
}

/* daily bounties */
const BOUNTY_REWARD = { Abundant:300, Common:400, Curious:600, Elusive:900, Fabled:1400, Mythic:2000, Exotic:2800, Relic:2200, Secret:5000 };
function genBounties(){
  const today = new Date().toISOString().slice(0,10);
  if(save.bounties.date !== today){
    const pool = MASTER.filter(f => RARITY_ORDER.includes(f.rar));
    const picked = new Set(); const list = [];
    let guard = 0;
    while(list.length < 3 && guard++ < 200){
      const f = pool[Math.floor(Math.random()*pool.length)];
      if(picked.has(f.name)) continue;
      picked.add(f.name);
      list.push({ name:f.name, rar:f.rar, count: f.rar==='Abundant'||f.rar==='Common' ? 3 : 2, got:0, claimed:false });
    }
    save.bounties = { date: today, list };
    persist();
    Net.saveBounties({ date: today, list }).catch(()=>{});
  }
}
function updateBounties(c){
  for(const b of save.bounties.list){
    if(!b.claimed && b.name === c.name && b.got < b.count){
      b.got++;
      break;
    }
  }
}
function claimBounty(i){
  const b = save.bounties.list[i];
  if(!b || b.claimed || b.got < b.count) return;
  b.claimed = true;
  const reward = BOUNTY_REWARD[b.rar] || 500;
  save.coins += reward; save.lifetime += reward;
  save.stats.bounties++;
  persist();
  toast('💰 Bounty claimed: $'+fmt(reward), 'gold');
  UI.refreshQuests();
  checkTitle('bounty', null);
  Net.bump();
}

/* ---------------- titles ---------------- */
function activeTitle(){
  if(save.selectedTitle && save.titles.done[save.selectedTitle]) return save.selectedTitle;
  let best = null, bestRank = -1;
  for(const name in save.titles.done){
    const rank = TITLES.findIndex(t => t.name === name);
    const r = rank < 0 ? TITLES.length + 10 : rank;
    if(r > bestRank){ bestRank = r; best = name; }
  }
  return best;
}
function equipTitle(name){
  if(name && !save.titles.done[name]) return false;
  save.selectedTitle=name||'';
  persist(); Net.bump();
  return true;
}
function grantTitle(name, silent){
  if(save.titles.done[name]) return;
  save.titles.done[name] = true;
  if(!save.selectedTitle) save.selectedTitle=name;
  if(!silent) toast('🏅 Title unlocked: '+name+'!', 'gold');
  Net.bump();
}
function checkTitle(type, arg){
  for(const tl of TITLES){
    if(save.titles.done[tl.name]) continue;
    let ok = false;
    if(tl.type === 'catch' && save.stats.totalCaught >= tl.n) ok = true;
    else if(tl.type === 'sell' && save.stats.totalSold >= tl.n) ok = true;
    else if(tl.type === 'level' && save.level >= tl.n) ok = true;
    else if(tl.type === 'bounty' && save.stats.bounties >= tl.n) ok = true;
    else if(tl.type === 'quest' && tl.q === arg) ok = true;
    else if(tl.type === 'index'){
      const total = FISH_DATA[tl.loc] ? FISH_DATA[tl.loc].length : 0;
      const caught = new Set(FISH_DATA[tl.loc].map(f => f[0]).filter(n => save.index[n])).size;
      if(total && caught >= total) ok = true;
    }
    if(ok) grantTitle(tl.name);
  }
}
function checkIndexCompletion(name){
  for(const tl of TITLES){
    if(tl.type !== 'index') continue;
    if(save.titles.done[tl.name]) continue;
    const locList = FISH_DATA[tl.loc];
    if(!locList) continue;
    const names = locList.map(f => f[0]);
    if(names.indexOf(name) > -1){
      let all = true;
      for(const n of names){ if(!save.index[n]){ all = false; break; } }
      if(all){ grantTitle(tl.name); toast('📖 '+tl.loc+' index complete! +15 luck', 'gold'); }
    }
  }
}

/* ---------------- economy & level ---------------- */
function xpNeed(l){ return Math.floor(100 + (l-1)*30 + Math.pow(l,1.55)*4); }
function addXp(n){
  if(n <= 0) return;
  save.xp += Math.floor(n);
  let ups = 0;
  while(save.xp >= xpNeed(save.level)){
    save.xp -= xpNeed(save.level);
    save.level++;
    ups++;
  }
  if(ups){
    toast('⬆️ Level up! You are now Level '+save.level+'!', 'good');
    checkTitle('level', null);
    Net.bump();
  }
}
function fishValue(c){ return Math.max(1, Math.round(c.val)); }
function sellFish(i){
  const c = save.caught[i];
  if(!c) return;
  const v = fishValue(c);
  save.coins += v; save.lifetime += v;
  save.stats.totalSold++;
  save.caught.splice(i,1);
  persist();
  UI.refreshInv();
  UI.updateHud();
  checkTitle('sell', null);
  Net.throttledSubmit();
}
function sellAll(){
  let total = 0;
  for(const c of save.caught){ total += fishValue(c); save.stats.totalSold++; }
  save.caught = [];
  save.coins += total; save.lifetime += total;
  persist();
  toast('💰 Sold all for $'+fmt(total), 'gold');
  UI.refreshInv();
  UI.updateHud();
  checkTitle('sell', null);
  Net.bump();
}

/* ---------------- items ---------------- */
function addItem(key, n){
  if(key === 'autopet'){
    const pet = AUTOPETS[n];
    if(pet){ save.autopets[n] = true; toast('🤖 You got '+pet.name+'!', 'good'); }
    return;
  }
  save.items[key] = (save.items[key]||0) + n;
}
function useItem(key){
  if(!save.items[key]) return;
  if(key === 'speedP'){ save.items[key]--; save.potionSpeed = 5; toast('🧪 Speed Potion: instant bites for 5 casts!', 'gold'); }
  else if(key === 'luckP'){ save.items[key]--; save.potionLuck = 5; toast('🍀 Luck Potion: 1.5x luck for 5 casts!', 'gold'); }
  else if(key === 'egg'){ save.items[key]--; save.autopets.levi = true; toast('🐣 The egg hatches — Leviathan Autopet!', 'good'); save.autoSell = true; }
  else if(key === 'scrap'){ return; }
  persist(); UI.refreshInv(); UI.updateHud();
}
function sellItem(key){
  if(!save.items[key]) return;
  const it = ITEMS[key];
  if(!it || it.sell <= 0) return;
  save.coins += it.sell;
  save.items[key]--;
  persist(); UI.refreshInv(); UI.updateHud();
}

/* ---------------- shop & enchanting ---------------- */
function itemCanShow(it, locName){
  if(save.ownedRods.indexOf(it.id)>-1 || save.ownedLines.indexOf(it.id)>-1 ||
     save.ownedBobbers.indexOf(it.id)>-1 || save.ownedBoats.indexOf(it.id)>-1) return true;
  const src = it.src || '';
  if(src === 'Default Rod' || src === 'Default Line' || src === 'Default Bobber' || src === 'Sell Shops') return true;
  if(src === locName) return true;
  if(it.unlock === 'quest_alien' && save.quests.done.alien) return true;
  if(it.unlock === 'quest_paulie' && save.quests.done.paulie) return true;
  if(it.unlock === 'quest_undying' && save.quests.done.undying) return true;
  if(it.unlock === 'quest_galleon' && save.quests.done.galleon) return true;
  if(src === 'Alien Quest' && save.quests.done.alien) return true;
  if(src === 'Vlad' && locName === 'Luxian Dunes') return true;
  if(src === "Tomina's Crafting" && locName === 'Tanglewood') return true;
  if(src === 'Quest: Our Ship... It\'s Broken!' && save.quests.done.alien) return true;
  if(src === 'Reach level 500' && save.level >= 500) return true;
  if(src === 'Quest: Paulie\'s Lost Saw' && save.quests.done.paulie) return true;
  if(src === 'Quest: Undying Love' && save.quests.done.undying) return true;
  if(src === 'Roulette (1% — $50,000 a spin)' && false) return true;
  return false;
}
function buyGear(kind, id){
  const arr = kind === 'rods' ? RODS : kind === 'lines' ? LINES : BOBBERS;
  const it = arr.find(x => x.id === id);
  if(!it) return;
  if(it.cost > save.coins){ toast('Not enough coins!','bad'); return; }
  save.coins -= it.cost;
  if(kind === 'rods'){ save.ownedRods.push(id); save.rod = id; }
  else if(kind === 'lines'){ save.ownedLines.push(id); save.line = id; }
  else { save.ownedBobbers.push(id); save.bobber = id; }
  persist();
  toast('🛍️ Bought '+it.name+'!', 'good');
  UI.refreshShop();
  UI.updateHud();
}
function equipGear(kind, id){
  if(kind === 'rods') save.rod = id;
  else if(kind === 'lines') save.line = id;
  else save.bobber = id;
  persist(); UI.refreshShop(); UI.updateHud();
}
function buyBoat(id){
  const b = BOATS.find(x => x.id === id);
  if(!b) return;
  if(b.cost == null){ toast('Stego III is only from the Boat Roulette!', 'bad'); return; }
  if(b.cost > save.coins){ toast('Not enough coins!','bad'); return; }
  save.coins -= b.cost;
  save.ownedBoats.push(id); save.boat = id;
  persist();
  toast('🚤 Bought '+b.name+'!', 'good');
  UI.refreshBoats();
  UI.updateHud();
}
function equipBoat(id){
  if(save.ownedBoats.indexOf(id) === -1) return;
  save.boat = id; persist(); UI.refreshBoats();
}
function boatRoulette(){
  if(save.coins < 50000){ toast('The roulette costs $50,000!','bad'); return; }
  save.coins -= 50000;
  if(Math.random() < 0.01 && save.ownedBoats.indexOf('stego') === -1){
    save.ownedBoats.push('stego'); save.boat = 'stego';
    toast('🦖 JACKPOT! You won the Stego III!', 'gold');
  } else {
    toast('😔 No Stego this time… (1% chance)');
  }
  persist(); UI.refreshBoats(); UI.updateHud();
}
function doEnchant(relicKey){
  const pts = RELIC_POINTS[ITEMS[relicKey].name] || 1;
  if(!save.items[relicKey]) { toast('You need ' + ITEMS[relicKey].name + '!', 'bad'); return; }
  save.items[relicKey]--;
  save.pity = (save.pity||0) + pts;
  let rarity;
  if(save.pity >= ENCHANT_PITY){ rarity = 'Legendary'; save.pity = 0; }
  else {
    const entries = Object.entries(ENCHANT_RARITY_W);
    rarity = pickFromWeighted(entries);
  }
  const pool = ENCHANTS.filter(e => e.rarity === rarity);
  const ench = pool[Math.floor(Math.random()*pool.length)];
  save.enchant = ench.id;
  save.enchantLog.unshift({ name: ench.name, rarity: ench.rarity });
  if(save.enchantLog.length > 40) save.enchantLog.pop();
  persist();
  toast('✨ '+ench.rarity+' enchant: '+ench.name+'!', ench.rarity==='Legendary'?'gold':'good');
  UI.refreshEnchant();
  UI.updateHud();
}

/* ---------------- codes ---------------- */
function redeemCode(code){
  code = (code||'').toUpperCase().trim();
  const c = CODES.find(x => x.code === code);
  if(!c){ toast('That code doesn\'t exist!', 'bad'); return false; }
  if(!c.active){ toast('That code has expired.', 'bad'); return false; }
  if(save.codes[c.code]){ toast('You already redeemed this code.', 'bad'); return false; }
  save.codes[c.code] = true;
  if(c.coins){ save.coins+=c.coins; save.lifetime+=c.coins; }
  for(const k in (c.items||{})) addItem(k, c.items[k]);
  for(const id of (c.boats||[])){
    if(save.ownedBoats.indexOf(id)===-1) save.ownedBoats.push(id);
    save.boat=id;
  }
  for(const title of (c.titles||[])) grantTitle(title, true);
  for(const badge of (c.badges||[])) save.badges[badge]=true;
  if(c.avatar) save.avatar=Object.assign({gender:'female',skin:'warm',hair:'long',hairColor:'brown',outfit:'teal'},save.avatar||{},c.avatar);
  if(c.equipTitle && save.titles.done[c.equipTitle]) save.selectedTitle=c.equipTitle;
  persist();
  toast('🎟️ Code redeemed: '+c.reward+'!', 'gold');
  UI.refreshCodes();
  UI.refreshInv();
  return true;
}

/* ---------------- input ---------------- */
const keys = {};
function bindInput(){
  const typingIn = e => e.target && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable);
  window.addEventListener('keydown', e => {
    if(typingIn(e)){
      if(e.code === 'Enter' && e.target.id === 'nameInput') UI.submitName();
      return;
    }
    keys[e.code] = true;
    if(typeof Sound !== 'undefined') Sound.init();
    if(e.code === 'Space'){
      e.preventDefault();
      if(G.fish.state === 'idle') cast();
      else if(G.fish.state === 'reeling'){ G.input.hold = true; Fishing.held = true; }
    }
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => {
    if(typingIn(e)) return;
    keys[e.code] = false;
    if(e.code === 'Space'){ G.input.hold = false; Fishing.held = false; }
  });
  byId('btnCast').addEventListener('click', () => { if(typeof Sound !== 'undefined') Sound.init(); if(G.fish.state === 'idle') cast(); });
  byId('btnBoost').addEventListener('click', () => { if(typeof Sound !== 'undefined') Sound.init(); G.input.boost = true; });
  const reel = byId('reelBtn');
  reel.addEventListener('pointerdown', e => { e.preventDefault(); G.input.hold = true; Fishing.held = true; reel.classList.add('pressed'); });
  const up = e => { G.input.hold = false; Fishing.held = false; reel.classList.remove('pressed'); };
  reel.addEventListener('pointerup', up);
  reel.addEventListener('pointercancel', up);
  reel.addEventListener('pointerleave', up);

  const joy = byId('joyZone'), knob = byId('joyKnob');
  let jId = null, baseX = 0, baseY = 0;
  const jRadius = 46;
  const setKnob = (dx,dy) => {
    const d = Math.min(jRadius, Math.hypot(dx,dy));
    const a = Math.atan2(dy,dx);
    knob.style.transform = 'translate(-50%,-50%) translate('+(Math.cos(a)*d)+'px,'+(Math.sin(a)*d)+'px)';
    if(d < 10){ G.joy.x = 0; G.joy.y = 0; return; }
    G.joy.x = (dx/jRadius);
    G.joy.y = (dy/jRadius);
  };
  joy.addEventListener('pointerdown', e => {
    e.preventDefault();
    jId = e.pointerId;
    baseX = e.clientX; baseY = e.clientY;
    joy.setPointerCapture && joy.setPointerCapture(jId);
    setKnob(0,0);
    joy.style.opacity = '0.85';
  });
  joy.addEventListener('pointermove', e => {
    if(e.pointerId !== jId) return;
    setKnob(e.clientX - baseX, e.clientY - baseY);
  });
  const joyUp = e => {
    if(e.pointerId !== jId) return;
    jId = null;
    G.joy.x = 0; G.joy.y = 0;
    knob.style.transform = 'translate(-50%,-50%)';
    joy.style.opacity = '0.5';
  };
  joy.addEventListener('pointerup', joyUp);
  joy.addEventListener('pointercancel', joyUp);
}

function readKeyboardInput(){
  const ix = (keys.ArrowLeft||keys.KeyA ? -1 : 0) + (keys.ArrowRight||keys.KeyD ? 1 : 0);
  const iy = (keys.ArrowUp||keys.KeyW ? 1 : 0) + (keys.ArrowDown||keys.KeyS ? -1 : 0);
  const usingKeys = ix !== 0 || iy !== 0;
  if(usingKeys){
    G.input.x = ix; G.input.y = iy;
    G.input.joyAng = null; G.input.joyMag = 0;
  } else if(G.joy.x || G.joy.y){
    G.input.x = 0; G.input.y = 0;
    G.input.joyAng = Math.atan2(G.joy.x, -G.joy.y);
    G.input.joyMag = Math.min(1, Math.hypot(G.joy.x, G.joy.y));
  } else {
    G.input.x = 0; G.input.y = 0;
    G.input.joyAng = null; G.input.joyMag = 0;
  }
  if(G.input.boost){ G.input.boost = false; if(G.boat.boostCd <= 0 && G.fish.state==='idle'){ G.boat.boost = 1.6; G.boat.boostCd = 3.2; } }
}

/* ---------------- boat physics ---------------- */
function updateBoat(dt){
  if(G.player.onFoot){ updatePlayer(dt); return; }
  const b = G.boat;
  const boat = gearById(BOATS, save.boat);
  const fishingNow = G.fish.state !== 'idle';
  let fwd = fishingNow ? 0 : G.input.y;
  let turn = fishingNow ? 0 : G.input.x;
  const joyMode = !fishingNow && G.input.joyAng != null && G.input.joyMag > 0.02;
  if(joyMode){
    let diff = G.input.joyAng - b.head;
    while(diff > Math.PI) diff -= Math.PI*2;
    while(diff < -Math.PI) diff += Math.PI*2;
    const rev = Math.abs(diff) > Math.PI/2;
    turn = Math.max(-1, Math.min(1, diff*1.4));
    b.head += turn * 2.6 * dt;
    fwd = rev ? -G.input.joyMag*0.7 : G.input.joyMag*(Math.abs(diff) > 0.6 ? 0.85 : 1);
    turn = 0;
  }
  const maxV = 85 * boat.speed;
  const accel = 70 * boat.accel;
  const target = fwd * maxV;
  if(b.speed < target) b.speed = Math.min(target, b.speed + accel*dt);
  else if(b.speed > target) b.speed = Math.max(target, b.speed - accel*2*dt);
  if(b.speed !== 0){
    const turnR = 1.7 * boat.speed * Math.min(1, Math.abs(b.speed)/maxV);
    b.head += turn * turnR * dt * (b.speed < 0 ? -1 : 1);
  }
  if(b.boost > 0){
    b.boost -= dt;
    b.speed = maxV * 1.9 * Math.sign(target || 1);
  }
  if(typeof Sound !== 'undefined') Sound.setEngine(Math.abs(b.speed)/Math.max(1, maxV*1.9), b.boost, b.speed !== 0 || b.boost > 0);
  if(b.boostCd > 0) b.boostCd -= dt;
  if(G.boat.boost > 0) byId('btnBoost').classList.add('boosted');
  else byId('btnBoost').classList.remove('boosted');

  b.x += Math.sin(b.head) * b.speed * dt;
  b.y -= Math.cos(b.head) * b.speed * dt;

  if(b.boostCd > 0){ byId('btnBoost').classList.add('cd'); }
  else { byId('btnBoost').classList.remove('cd'); }

  b.x = Math.min(WORLD_W-40, Math.max(40, b.x));
  b.y = Math.min(WORLD_H-40, Math.max(40, b.y));

  for(const isl of ISLANDS){
    const d = Math.hypot(b.x-isl.x, b.y-isl.y);
    const minD = isl.r * 0.55;
    if(d < minD){
      if(isl.unlock === 'volcanic' && save.level < 50){
        pushOut(isl, d, minD);
        if(G.blockedIsland !== isl.id){
          G.blockedIsland = isl.id;
          toast('🔥 Reach Level 50 to enter the Volcanic Depths!', 'bad');
        }
        continue;
      }
      if(isl.unlock === 'twilight' && !save.quests.done.breakin){
        pushOut(isl, d, minD);
        if(G.blockedIsland !== isl.id){
          G.blockedIsland = isl.id;
          toast('🔒 Unlock the Twilight Realm by completing "The Break-in"!', 'bad');
        }
        continue;
      }
      const boatT = boat.tough || 1;
      pushOut(isl, d, minD);
      b.speed *= Math.max(0.55, 1 - (1/boatT)*dt*3);
    }
  }
  if(G.blockedIsland){
    const blocked=islandById(G.blockedIsland);
    if(!blocked || Math.hypot(b.x-blocked.x,b.y-blocked.y)>blocked.r*.9) G.blockedIsland=null;
  }
  function pushOut(isl, d, minD){
    if(d === 0) d = 1;
    const push = (minD - d)/minD;
    const nx = (b.x - isl.x)/d, ny = (b.y - isl.y)/d;
    b.x += nx * push * 55 * dt;
    b.y += ny * push * 55 * dt;
  }
  if(b.speed > 8 && Math.random() < 0.5){
    G.effects.push({ type:'wake', x:b.x - Math.sin(b.head)*6, y:b.y + Math.cos(b.head)*6, t:0 });
  }
  if(save.boat === 'pinkfong' && Math.abs(b.speed) > 10){
    G.pinkTrailTimer += dt;
    if(G.pinkTrailTimer >= 0.14){
      G.pinkTrailTimer = 0;
      const side=(Math.random()-.5)*12;
      G.effects.push({type:'pinkStar',x:b.x-Math.sin(b.head)*14+Math.cos(b.head)*side,y:b.y+Math.cos(b.head)*14+Math.sin(b.head)*side,t:0,spin:Math.random()*Math.PI*2});
      if(typeof Sound !== 'undefined') Sound.pinkTrail();
    }
  } else G.pinkTrailTimer=0;
  if(save.boat === 'witchy' && Math.abs(b.speed) > 10){
    G.witchTrailTimer+=dt;
    if(G.witchTrailTimer>=.18){
      G.witchTrailTimer=0;
      const side=(Math.random()-.5)*16;
      G.effects.push({type:'witchMote',x:b.x-Math.sin(b.head)*18+Math.cos(b.head)*side,y:b.y+Math.cos(b.head)*18+Math.sin(b.head)*side,t:0,phase:Math.random()*Math.PI*2});
      if(typeof Sound!=='undefined') Sound.witchTrail();
    }
  }else G.witchTrailTimer=0;
  if(save.boat==='jack' && Math.abs(b.speed)>10){
    G.jackTrailTimer+=dt;
    if(G.jackTrailTimer>=.2){ G.jackTrailTimer=0; const side=(Math.random()-.5)*24; G.effects.push({type:'tentacle',x:b.x-Math.sin(b.head)*24+Math.cos(b.head)*side,y:b.y+Math.cos(b.head)*24+Math.sin(b.head)*side,t:0,phase:Math.random()*6.28}); if(typeof Sound!=='undefined') Sound.jackTrail(); }
  }else G.jackTrailTimer=0;
  if(save.boat === 'davetest' && Math.abs(b.speed) > 10){
    G.betaTrailTimer += dt;
    if(G.betaTrailTimer >= 0.13){
      G.betaTrailTimer=0;
      const side=(Math.random()-.5)*15, label='BETA TESTER';
      const letter=label[G.betaTrailIndex++%label.length];
      const x=b.x-Math.sin(b.head)*17+Math.cos(b.head)*side, y=b.y+Math.cos(b.head)*17+Math.sin(b.head)*side;
      G.effects.push({type:'betaGold',x,y,t:0,size:2.5+Math.random()*2});
      if(letter!==' ') G.effects.push({type:'betaLetter',x,y,t:0,letter,spin:(Math.random()-.5)*.22});
    }
  } else { G.betaTrailTimer=0; G.betaTrailIndex=0; }
  for(let i = G.effects.length-1; i >= 0; i--){
    G.effects[i].t += dt;
    if(G.effects[i].t > 1.4) G.effects.splice(i,1);
  }
}

function landableIsland(){
  for(const isl of ISLANDS){
    if(Math.hypot(G.boat.x-isl.x,G.boat.y-isl.y)<isl.r*.85) return isl;
  }
  return null;
}
function toggleLand(){
  if(G.fish.state !== 'idle'){ toast('Finish fishing before leaving the boat.','bad'); return; }
  const p=G.player, b=G.boat;
  if(p.onFoot){
    if(Math.hypot(p.x-b.x,p.y-b.y)>105){ toast('🚤 Walk back to your boat to board it.','bad'); return; }
    p.onFoot=false; p.island=null; b.speed=0;
    toast('🚤 Back aboard!','good');
    return;
  }
  const isl=landableIsland();
  if(!isl){ toast('Sail close to an island shore first.','bad'); return; }
  const dx=b.x-isl.x, dy=b.y-isl.y, d=Math.max(1,Math.hypot(dx,dy));
  p.onFoot=true; p.island=isl.id; p.x=isl.x+dx/d*isl.r*.50; p.y=isl.y+dy/d*isl.r*.50; p.head=b.head; b.speed=0;
  toast('🧍 You stepped ashore. Explore the island!','good');
}
function updatePlayer(dt){
  const p=G.player;
  /* Walking is screen-relative: W always goes up the screen and A always goes left.
     Convert that direction through the tilted camera so it still follows the world correctly. */
  const sx=G.input.joyAng!=null ? G.joy.x : G.input.x;
  const sy=G.input.joyAng!=null ? G.joy.y : -G.input.y;
  const mag=Math.min(1,Math.hypot(sx,sy));
  if(mag>.02){
    const qx=sx/mag, qy=(sy/mag)/WORLD_Y_SCALE;
    const c=Math.cos(CAMERA_YAW), s=Math.sin(CAMERA_YAW);
    const wx=c*qx+s*qy, wy=-s*qx+c*qy;
    p.x+=wx*145*mag*dt;
    p.y+=wy*145*mag*dt;
    p.head=Math.atan2(wx,-wy);
  }
  const isl=islandById(p.island);
  if(isl){
    const ox=p.x-isl.x, oy=p.y-isl.y, d=Math.hypot(ox,oy), limit=isl.r*.69;
    if(d>limit){ p.x=isl.x+ox/d*limit; p.y=isl.y+oy/d*limit; }
  }
}

/* ---------------- UI helpers for fishing ---------------- */
function showFishUI(){
  byId('fishUI').classList.remove('hidden');
  byId('btnCast').classList.add('busy');
  byId('reelBtn').style.display = 'none';
  byId('reel').style.display = 'none';
  byId('fishTip').style.display = 'none';
  byId('fishDot').style.display = 'none';
  const rod = curRod(), line = gearById(LINES, save.line), bob = gearById(BOBBERS, save.bobber);
  byId('gearRod').innerHTML = rod.emoji+' <b>'+rod.name+'</b>';
  byId('gearLine').innerHTML = line.emoji+' <b>'+line.name+'</b>';
  byId('gearBobber').innerHTML = bob.emoji+' <b>'+bob.name+'</b>';
}
function showReelUI(){
  byId('reelBtn').style.display = 'block';
  byId('reel').style.display = 'block';
  byId('fishTip').style.display = 'block';
  byId('fishDot').style.display = 'block';
}
function hideFishUI(){
  byId('fishUI').classList.add('hidden');
  byId('btnCast').classList.remove('busy');
  byId('reelBtn').style.display = '';
  byId('reel').style.display = '';
  byId('fishTip').style.display = '';
  byId('fishDot').style.display = '';
  byId('fishStatus').style.color = '';
  byId('progFill').style.background = '';
  byId('progFill').style.boxShadow = '';
  const mk = byId('marker');
  mk.classList.remove('rainbow','us');
  mk.style.background = '';
  mk.style.boxShadow = '';
}
function setStatus(msg, cls){
  const el = byId('fishStatus');
  byId('fishName').textContent = msg;
  el.className = 'fish-status' + (cls ? ' '+cls : '');
  if(msg !== Fishing.lastStatus){
    Fishing.lastStatus = msg;
    if(cls === 'good') byId('fishTip').textContent = 'Hold REEL to keep the fish in the white zone — fill the meter to catch it!';
  }
}

/* ---------------- HUD ---------------- */
function updateHud(){
  byId('hudCoins').textContent = fmt(save.coins);
  byId('hudName').textContent = (save.name || 'Angler').toUpperCase();
  byId('betaBadge').classList.toggle('hidden', !(save.badges&&save.badges.betaTester));
  byId('davetestBadge').classList.toggle('hidden', !(save.badges&&save.badges.daveTest));
  byId('creatorBadge').classList.toggle('hidden', !(save.badges&&save.badges.creator));
  byId('bootyBadge').classList.toggle('hidden', !(save.badges&&save.badges.booty));
  byId('jackBadge').classList.toggle('hidden', !(save.badges&&save.badges.jack));
  byId('chipAnnounce').classList.toggle('hidden', !/dave/i.test(String(save.name||'')));
  byId('pinkfongBadge').classList.toggle('hidden', !(save.badges&&save.badges.pinkfong));
  byId('witchyBadge').classList.toggle('hidden', !(save.badges&&save.badges.witchy));
  byId('hudLv').textContent = 'Lv'+save.level;
  byId('hudIndex').textContent = Object.keys(save.index).length;
  byId('hudWeather').textContent = (WEATHER_ICONS[G.state.weather]||'🌤️');
  byId('hudTime').textContent = (TIME_ICONS[G.state.time]||'');
  const loc = G.curLoc || detectLoc();
  byId('locName').textContent = loc.name;
  byId('locPool').textContent = loc.pool && POOL_MODS[loc.pool] ? POOL_MODS[loc.pool].desc : (loc.levi ? 'The baby leviathan stirs…' : '');
  const lv = leviStatus();
  if(lv.active){
    const health=leviHealth();
    byId('leviWrap').classList.remove('hidden');
    byId('leviCountWrap').classList.remove('hidden');
    const rem = Math.max(0, lv.end.getTime() - Date.now());
    byId('leviHp').textContent=health.hp+' / '+health.maxHp+' · '+Math.max(1,health.hunters||1)+' hunter'+((health.hunters||1)===1?'':'s');
    byId('leviBar').style.width=(health.hp/health.maxHp*100)+'%';
    byId('leviTimer').textContent = health.hp<=0 ? '🏆 '+(health.winner?health.winner.name:'An angler')+' landed the final catch!' : '⌛ Leviathan swims away in '+mmss(rem/1000);
    byId('leviCountdown').textContent = '🦈 '+health.hp+'/'+health.maxHp+' · '+mmss(rem/1000);
  } else {
    byId('leviWrap').classList.add('hidden');
    byId('leviCountWrap').classList.add('hidden');
  }
}
function mmss(sec){
  sec = Math.max(0, Math.floor(sec));
  return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
}

/* ---------------- world rendering ---------------- */
const canvas = byId('world');
const ctx = canvas.getContext('2d');
const mCanvas = byId('minimap');
const mctx = mCanvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

const ISL_POLY = [];
const ISL_TREES = [];
(function buildIslands(){
  ISLANDS.forEach((isl, i) => {
    const rng = mulberry(i*7919 + 17);
    const pts = [];
    const n = 26;
    for(let k = 0; k < n; k++){
      const a = k/n*Math.PI*2;
      const rr = isl.r*(0.8 + rng()*0.35);
      pts.push([isl.x + Math.cos(a)*rr, isl.y + Math.sin(a)*rr]);
    }
    ISL_POLY[i] = pts;
    ISL_TREES[i] = [];
    const count = isl.r > 200 ? 10 : 4;
    for(let t = 0; t < count; t++){
      const a = rng()*Math.PI*2;
      const rr = isl.r*(0.15 + rng()*0.6);
      ISL_TREES[i].push({ x: isl.x + Math.cos(a)*rr, y: isl.y + Math.sin(a)*rr, s: 0.7 + rng()*0.6, a: rng()*Math.PI });
    }
  });
})();

const THEME = {
  tropical:{ water:'#1f7fc2', sand:'#f3dd9a', land:'#4fae5e', dark:'#2f7d3f', decor:'#0b6a2f', halo:'#46bfe0' },
  volcanic:{ water:'#c23f1f', sand:'#4a3026', land:'#3d3a3e', dark:'#2a272b', decor:'#ff7b2f', halo:'#e07a3a' },
  desert:{ water:'#d8b96a', sand:'#ecd9a4', land:'#d8b96a', dark:'#b39352', decor:'#8a6d33', halo:'#e8cf8a' },
  swamp:{ water:'#3c5a3a', sand:'#5d6b4a', land:'#2f4a2c', dark:'#1d331b', decor:'#12331a', halo:'#6f9a5a' },
  twilight:{ water:'#3b2f6e', sand:'#5c4a8f', land:'#4a3a78', dark:'#2f2452', decor:'#c58cff', halo:'#7a6fd0' },
  rock:{ water:'#1f7fc2', sand:'#8f8f8f', land:'#6a6a6a', dark:'#4a4a4a', decor:'#b8f2ff', halo:'#79c8ea' }
};
const WORLD_Y_SCALE=0.56, CAMERA_YAW=-0.42;
function applyWorldTransform(c){
  const z=G.cam.zoom;
  c.translate(W/2,H/2);
  c.scale(z,z*WORLD_Y_SCALE);
  c.rotate(CAMERA_YAW);
  c.translate(-G.cam.x,-G.cam.y);
}
function worldViewport(){
  const reach=Math.hypot(W/(2*G.cam.zoom),H/(2*G.cam.zoom*WORLD_Y_SCALE))*1.12;
  return {x:G.cam.x-reach,y:G.cam.y-reach,w:reach*2,h:reach*2};
}
function worldToScreen(x,y){
  const dx=x-G.cam.x, dy=y-G.cam.y, c=Math.cos(CAMERA_YAW), s=Math.sin(CAMERA_YAW);
  return {x:(c*dx-s*dy)*G.cam.zoom+W/2,y:(s*dx+c*dy)*G.cam.zoom*WORLD_Y_SCALE+H/2};
}

function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W*DPR; canvas.height = H*DPR;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);

function drawOcean(){
  const g = ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#163f5d');
  g.addColorStop(0.42,'#0b4b78');
  g.addColorStop(1,'#041f3b');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  /* A large, moving specular reflection sits above the world plane. */
  const sunX=W*(.22+.06*Math.sin(G.frame*.003)), sunY=H*.08;
  const sheen=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,Math.max(W,H)*.72);
  sheen.addColorStop(0,'rgba(173,235,255,.18)'); sheen.addColorStop(.36,'rgba(94,200,255,.055)'); sheen.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=sheen; ctx.fillRect(0,0,W,H);
  ctx.save();
  applyWorldTransform(ctx);
  const v=worldViewport(); const vx=v.x, vy=v.y, vw=v.w, vh=v.h;
  const spacing = 72;
  const offY = (G.frame*4.5) % spacing;
  const xS = Math.floor(vx/spacing)*spacing, yS = Math.floor(vy/spacing)*spacing;
  for(let y = yS - spacing; y < vy + vh + spacing; y += spacing){
    const yy = y + offY;
    for(let x = xS - spacing; x < vx + vw + spacing; x += spacing){
      const phase=x*.018+y*.026+G.frame*.035;
      const a = 0.035 + 0.045*(.5+.5*Math.sin(phase));
      const wob = Math.sin(phase)*9 + Math.cos(y*.035-G.frame*.022)*4;
      ctx.strokeStyle = 'rgba(190,238,255,'+a+')'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(x-12+wob,yy); ctx.quadraticCurveTo(x+12+wob,yy-3,x+35+wob,yy+.5); ctx.stroke();
      if((x/spacing+y/spacing)%2===0){
        ctx.strokeStyle='rgba(30,117,164,.20)'; ctx.beginPath(); ctx.moveTo(x+30-wob,yy+27); ctx.quadraticCurveTo(x+48-wob,yy+30,x+66-wob,yy+27); ctx.stroke();
      }
    }
  }
  /* broad, slow-moving caustics give the water a layered depth rather than a flat grid */
  for(let i=0;i<24;i++){
    const x=vx+((i*173+G.frame*.8)%vw), y=vy+((i*97+G.frame*.32)%vh);
    const glow=ctx.createRadialGradient(x,y,0,x,y,72);
    glow.addColorStop(0,'rgba(142,231,255,.11)'); glow.addColorStop(.38,'rgba(70,175,230,.045)'); glow.addColorStop(1,'rgba(115,220,255,0)');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.ellipse(x,y,58,18,Math.sin(i+G.frame*.01)*.25,0,Math.PI*2); ctx.fill();
  }
  G.sparkles.forEach(s => {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = '#bfe6ff';
    const sx = s.x + Math.sin(G.frame*0.02 + s.p)*2;
    ctx.fillRect(sx, s.y, s.w, s.w*2);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function islPolyPath(x, y, pts, sc){
  ctx.beginPath();
  ctx.moveTo(x + (pts[0][0]-x)*sc, y + (pts[0][1]-y)*sc);
  for(let k = 1; k < pts.length; k++) ctx.lineTo(x + (pts[k][0]-x)*sc, y + (pts[k][1]-y)*sc);
  ctx.closePath();
}
/* Draw only the camera-facing edges as vertical faces. This is the actual 3D extrusion
   beneath an island top, rather than a flat dark outline. */
function drawIslandCliffs(isl, pts, sc, height, color){
  const s=Math.sin(CAMERA_YAW), c=Math.cos(CAMERA_YAW);
  const dropX=s*height/WORLD_Y_SCALE, dropY=c*height/WORLD_Y_SCALE;
  for(let k=0;k<pts.length;k++){
    const a=pts[k], b=pts[(k+1)%pts.length];
    const ax=isl.x+(a[0]-isl.x)*sc, ay=isl.y+(a[1]-isl.y)*sc;
    const bx=isl.x+(b[0]-isl.x)*sc, by=isl.y+(b[1]-isl.y)*sc;
    const mx=(ax+bx)/2-isl.x, my=(ay+by)/2-isl.y;
    if(s*mx+c*my<0) continue;
    const shade=.55+.28*Math.max(0,(s*mx+c*my)/Math.max(1,isl.r));
    ctx.fillStyle=color; ctx.globalAlpha=shade;
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.lineTo(bx+dropX,by+dropY); ctx.lineTo(ax+dropX,ay+dropY); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawPalm(x, y, s, a){
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(a);
  ctx.fillStyle = 'rgba(0,10,20,.15)';
  ctx.beginPath(); ctx.ellipse(4, 3, 12, 4, -.18, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#7a5426'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(3,-9, -1,-17); ctx.stroke();
  ctx.strokeStyle = '#bd8240'; ctx.lineWidth = .85;
  ctx.beginPath(); ctx.moveTo(-.5,-1); ctx.quadraticCurveTo(2,-9,-.5,-16); ctx.stroke();
  ctx.strokeStyle = '#5f421e'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-1,-8); ctx.quadraticCurveTo(1,-11,0,-15); ctx.stroke();
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(-4,-10,2,3); ctx.fillRect(1,-11,2,3);
  ctx.fillStyle = '#2e7d32';
  for(let f = 0; f < 6; f++){
    const ang = -Math.PI + f*Math.PI/3;
    ctx.save(); ctx.translate(0,-17); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(9,-3, 13,2); ctx.quadraticCurveTo(8,5,0,2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#43a34c';
  for(let f = 0; f < 5; f++){
    const ang = -Math.PI + f*Math.PI/2.55 + .12;
    ctx.save(); ctx.translate(0,-17); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(7,-2,10,1); ctx.quadraticCurveTo(6,2.8,0,1.3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#1b5e20';
  ctx.beginPath(); ctx.arc(0,-17,2.4,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawCactus(x, y, s){
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,10,20,.18)';
  ctx.beginPath(); ctx.ellipse(0, 2, 7, 2.6, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#4c8c3f';
  ctx.fillRect(-2.5,-9,5,15);
  ctx.fillRect(-7,-7,4,4); ctx.fillRect(-7,-10,4,6);
  ctx.fillRect(3,-5,4,4); ctx.fillRect(3,-9,4,6);
  ctx.strokeStyle = '#3a6d2f'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-2.5,-9); ctx.lineTo(-3,-1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2.5,-9); ctx.lineTo(3,-1); ctx.stroke();
  ctx.fillStyle = '#f7d9a0';
  ctx.fillRect(-1.5,-12,3,3);
  ctx.restore();
}
function drawCrystal(x, y, s){
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,10,20,.18)';
  ctx.beginPath(); ctx.ellipse(0, 2, 7, 2.6, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(180,120,255,.16)';
  ctx.beginPath(); ctx.arc(0,-4,13,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#5a3a9f';
  ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(4,-6); ctx.lineTo(0,0); ctx.lineTo(-4,-6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c58cff';
  ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(2,-6); ctx.lineTo(0,-1); ctx.lineTo(-2,-6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawCinder(x, y, s){
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,10,20,.18)';
  ctx.beginPath(); ctx.ellipse(0, 2, 7, 2.6, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#33303a';
  ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(6,0); ctx.lineTo(-6,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a4448';
  ctx.beginPath(); ctx.moveTo(0,-11); ctx.lineTo(3,0); ctx.lineTo(-3,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff8c40';
  ctx.beginPath(); ctx.arc(0,-10,2,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawSwampTree(x, y, s){
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,10,20,.18)';
  ctx.beginPath(); ctx.ellipse(0, 2, 8, 2.8, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#3a5a38'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(2,-7,4,-12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,-12); ctx.quadraticCurveTo(7,-14,9,-10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,-12); ctx.quadraticCurveTo(1,-15,-1,-12); ctx.stroke();
  ctx.fillStyle = '#6f9a5a';
  ctx.beginPath(); ctx.arc(4,-12,3.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(9,-10,2.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-1,-12,2.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#bfe8a0';
  ctx.beginPath(); ctx.arc(3.4,-13,1.2,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ---------------- island name signs ---------------- */
function drawSign(isl){
  const r = isl.r;
  const anchor=worldToScreen(isl.x + r*0.30, isl.y + r*0.02);
  const s = Math.max(0.45, Math.min(1.15, r/290*G.cam.zoom));
  const x = anchor.x, ground = anchor.y;
  const lines = isl.name.length > 12 ? isl.name.split(' ').filter(Boolean) : [isl.name];
  const bh = (lines.length > 1 ? 40 : 26)*s;
  const bw = Math.min(r*0.52, 150*s);
  const ph = r*0.36;
  const postH = ph*G.cam.zoom*WORLD_Y_SCALE;
  const by = ground - postH - bh;
  ctx.save();
  /* Signs stay upright and readable even though the terrain plane is tilted. */
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle = 'rgba(0,10,20,.18)';
  ctx.beginPath(); ctx.ellipse(x, ground, bw*0.55, 5*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(x - 3.5*s, ground - postH, 7*s, postH);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(x + 1.5*s, ground - postH, 2*s, postH);
  ctx.fillStyle = '#7c4f26';
  ctx.strokeStyle = '#4a2f17'; ctx.lineWidth = 2*s;
  ctx.beginPath();
  ctx.moveTo(x - bw/2 + 6*s, by);
  ctx.arcTo(x + bw/2, by, x + bw/2, by + bh, 6*s);
  ctx.arcTo(x + bw/2, by + bh, x - bw/2, by + bh, 6*s);
  ctx.arcTo(x - bw/2, by + bh, x - bw/2, by, 6*s);
  ctx.arcTo(x - bw/2, by, x + bw/2, by, 6*s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.beginPath(); ctx.arc(x - bw*0.18, by + bh*0.3, 3*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + bw*0.18, by + bh*0.6, 2*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffe9c9';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 '+Math.max(11, r*0.052)+'px system-ui,sans-serif';
  if(lines.length > 1){
    ctx.fillText(lines[0], x, by + bh*0.30);
    ctx.fillText(lines[1], x, by + bh*0.72);
  }else{
    ctx.fillText(lines[0], x, by + bh/2 + 1);
  }
  ctx.restore();
}
function updateIslandSigns(){
  const layer=byId('islandSignLayer');
  if(!layer) return;
  if(!layer.children.length){
    ISLANDS.forEach(isl=>{
      const sign=document.createElement('div'); sign.className='island-sign'; sign.dataset.island=isl.id;
      sign.textContent=isl.name; layer.appendChild(sign);
    });
  }
  ISLANDS.forEach(isl=>{
    const sign=layer.querySelector('[data-island="'+isl.id+'"]'); if(!sign) return;
    const p=worldToScreen(isl.x+isl.r*.30,isl.y+isl.r*.02);
    const visible=p.x>-160&&p.x<W+160&&p.y>-90&&p.y<H+90;
    sign.style.display=visible?'block':'none';
    if(visible){
      const scale=Math.max(.62,Math.min(1.05,G.cam.zoom*.95));
      sign.style.left=p.x+'px'; sign.style.top=p.y+'px'; sign.style.transform='translate(-50%,-100%) scale('+scale+')';
    }
  });
}

/* ---------------- special pool shaders ---------------- */
const POOL_PARTS = {};
function poolParts(i){
  if(POOL_PARTS[i]) return POOL_PARTS[i];
  const rng = mulberry(i*7919 + 5);
  const arr = [];
  for(let k = 0; k < 26; k++){
    arr.push({ a: rng()*Math.PI*2, rad: 0.15 + rng()*0.8, ph: rng()*Math.PI*2, sp: 0.4 + rng()*1.2, s: 1 + rng()*2 });
  }
  POOL_PARTS[i] = arr;
  return arr;
}
const POOL_COLOR = {
  'Strange Whirlpool': '#7fe7ff', 'Sandy Updraft': '#f0d08a', 'Savanna Rift': '#ffa050',
  'Shadow Chasm': '#9d6bff', 'Sparkling Pool': '#ffffff', 'Ionized Fissure': '#7dff8f',
  'Celestial Chasm': '#b18cff', 'Midas Rift': '#ffd75e', 'Occult Pool': '#6dff8a'
};

function drawPoolFX(p, i){
  const t = G.frame*0.02;
  const x = p.x, y = p.y, r = p.r;
  const n = p.name;
  const parts = poolParts(i);
  ctx.strokeStyle = 'rgba(150,240,255,'+(0.22 + 0.12*Math.sin(t*2 + i))+')';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r*1.04, 0, Math.PI*2); ctx.stroke();
  if(n === 'Strange Whirlpool'){
    const cg = ctx.createRadialGradient(x,y,0,x,y,r);
    cg.addColorStop(0,'rgba(8,28,46,.85)');
    cg.addColorStop(0.6,'rgba(16,60,90,.45)');
    cg.addColorStop(1,'rgba(16,60,90,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    for(let k = 0; k < 3; k++){
      const rot = t*1.4 + k*Math.PI*2/3;
      ctx.strokeStyle = 'rgba(150,235,255,'+(0.55 - k*0.14)+')';
      ctx.lineWidth = 3.5 - k;
      ctx.beginPath();
      for(let a = 0; a < Math.PI*2.6; a += 0.1){
        const rr = r*0.92*(a/(Math.PI*2.6));
        ctx.lineTo(x + Math.cos(rot+a)*rr, y + Math.sin(rot+a)*rr*0.92);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(200,245,255,.18)';
    ctx.lineWidth = 2;
    for(let k = 0; k < 3; k++){
      const ph = (t*0.6 + k/3) % 1;
      ctx.beginPath(); ctx.arc(x, y, r*(0.25 + ph*0.75), 0, Math.PI*2); ctx.stroke();
    }
  } else if(n === 'Sandy Updraft'){
    const g = ctx.createRadialGradient(x,y,r*0.1,x,y,r);
    g.addColorStop(0,'rgba(238,205,138,.4)');
    g.addColorStop(1,'rgba(238,205,138,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(245,220,160,.55)'; ctx.lineWidth = 2.5;
    for(let k = 0; k < 2; k++){
      ctx.beginPath();
      for(let a = 0; a < Math.PI*2.4; a += 0.12){
        const rr = r*(0.15 + 0.85*(a/(Math.PI*2.4)));
        ctx.lineTo(x + Math.cos(t*1.1 + k*Math.PI + a)*rr, y + Math.sin(t*1.1 + k*Math.PI + a)*rr*0.7);
      }
      ctx.stroke();
    }
    for(const q of parts){
      const sw = q.a + t*q.sp*0.6;
      const rad = q.rad*r;
      const px = x + Math.cos(sw)*rad*0.8;
      const py = y + Math.sin(sw)*rad*0.55 - Math.sin(t*2 + q.ph)*r*0.2;
      ctx.globalAlpha = 0.35 + 0.4*(0.5 + 0.5*Math.sin(t*3 + q.ph));
      ctx.fillStyle = '#f5dc9e';
      ctx.fillRect(px, py, q.s, q.s);
    }
    ctx.globalAlpha = 1;
  } else if(n === 'Savanna Rift'){
    const g = ctx.createRadialGradient(x,y,r*0.1,x,y,r);
    g.addColorStop(0,'rgba(255,150,60,.3)');
    g.addColorStop(1,'rgba(255,150,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,180,90,.4)'; ctx.lineWidth = 2;
    for(let k = 0; k < 5; k++){
      const w = 0.35 + k*0.14;
      const yy = y + (k-2)*r*0.16 + Math.sin(t*2 + k*1.3)*4;
      ctx.beginPath();
      for(let a = 0; a <= Math.PI*2; a += 0.12){
        ctx.lineTo(x + Math.cos(a)*r*w, yy + Math.sin(a)*r*0.05);
      }
      ctx.stroke();
    }
    for(const q of parts){
      const px = x + Math.cos(q.a + t*0.3)*q.rad*r;
      const py = y + Math.sin(q.a*2 + t*0.5)*q.rad*r*0.5;
      ctx.globalAlpha = 0.25 + 0.3*(0.5 + 0.5*Math.sin(t*2 + q.ph));
      ctx.fillStyle = '#ffc878';
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;
  } else if(n === 'Shadow Chasm'){
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(5,3,20,.95)');
    g.addColorStop(0.7,'rgba(20,10,45,.7)');
    g.addColorStop(1,'rgba(20,10,45,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,90,255,'+(0.35 + 0.15*Math.sin(t*3))+')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r*0.85, 0, Math.PI*2); ctx.stroke();
    for(const q of parts){
      const sw = q.a + t*q.sp*0.4;
      const px = x + Math.cos(sw)*q.rad*r*0.8;
      const py = y + Math.sin(sw)*q.rad*r*0.7 + Math.sin(t*1.5 + q.ph)*r*0.15;
      ctx.globalAlpha = 0.3 + 0.4*(0.5 + 0.5*Math.sin(t*2.4 + q.ph));
      ctx.fillStyle = '#9d6bff';
      ctx.fillRect(px, py, 2.2, 2.2);
    }
    ctx.globalAlpha = 1;
  } else if(n === 'Sparkling Pool'){
    const g = ctx.createRadialGradient(x,y,r*0.1,x,y,r);
    g.addColorStop(0,'rgba(255,255,255,.35)');
    g.addColorStop(1,'rgba(160,240,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    const cols = ['#ff7ab8','#ffd24a','#7fe7ff','#b18cff','#7dffc4'];
    for(let k = 0; k < 3; k++){
      ctx.strokeStyle = cols[k%5];
      ctx.globalAlpha = 0.25 + 0.2*Math.sin(t*2.2 + k*2);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r*(0.4 + k*0.14), 0, Math.PI*1.3 + t*0.6 + k*2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for(const q of parts){
      const tw = 0.5 + 0.5*Math.sin(t*3 + q.ph*6);
      const px = x + Math.cos(q.a)*q.rad*r;
      const py = y + Math.sin(q.a)*q.rad*r;
      ctx.globalAlpha = 0.2 + tw*0.7;
      ctx.fillStyle = q.ph > 2.6 ? '#ffef9e' : '#d8f7ff';
      ctx.fillRect(px - 1, py - 1, q.s + 1, q.s + 1);
      if(tw > 0.9){
        ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = tw*0.8; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.lineTo(px + 3, py);
        ctx.moveTo(px, py - 3); ctx.lineTo(px, py + 3); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else if(n === 'Ionized Fissure'){
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(90,255,120,.5)');
    g.addColorStop(0.7,'rgba(30,140,70,.25)');
    g.addColorStop(1,'rgba(30,140,70,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,255,150,.35)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([6,8]);
    ctx.beginPath(); ctx.arc(x, y, r*0.8, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    const e1 = Math.sin(t*1.7), e2 = Math.sin(t*1.3 + 2);
    if(Math.abs(e1) > 0.7 || Math.abs(e2) > 0.7){
      ctx.strokeStyle = 'rgba(200,255,220,.7)'; ctx.lineWidth = 1.8;
      for(let k = 0; k < 3; k++){
        const a0 = (Math.abs(e1) > 0.7 ? 0.4 : 2.4) + k*1.2;
        ctx.beginPath();
        for(let s = 0; s < 6; s++){
          const na = a0 + (Math.random()-0.5)*0.5;
          const nr = r*(0.4 + s*0.12);
          ctx.lineTo(x + Math.cos(na)*nr, y + Math.sin(na)*nr);
        }
        ctx.stroke();
      }
    }
    for(const q of parts){
      const sw = q.a + t*q.sp*0.8;
      const px = x + Math.cos(sw)*q.rad*r*0.9;
      const py = y + Math.sin(sw)*q.rad*r*0.9;
      ctx.globalAlpha = 0.3 + 0.4*(0.5 + 0.5*Math.sin(t*3 + q.ph));
      ctx.fillStyle = '#8dffa8';
      ctx.fillRect(px, py, 2.4, 2.4);
    }
    ctx.globalAlpha = 1;
  } else if(n === 'Celestial Chasm'){
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(15,8,50,.9)');
    g.addColorStop(0.6,'rgba(40,20,80,.55)');
    g.addColorStop(1,'rgba(40,20,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    for(const q of parts){
      const px = x + Math.cos(q.a*2.7)*q.rad*r;
      const py = y + Math.sin(q.a*1.9)*q.rad*r;
      ctx.globalAlpha = 0.3 + 0.6*(0.5 + 0.5*Math.sin(t*2 + q.ph*5));
      ctx.fillStyle = '#e8e2ff';
      ctx.fillRect(px, py, q.s*0.8, q.s*0.8);
    }
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#8f6bff'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(x, y, r*0.55, t*0.5, t*0.5 + 2.2); ctx.stroke();
    ctx.strokeStyle = '#ff6bd6'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, r*0.4, t*0.5 + 3, t*0.5 + 5); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if(n === 'Midas Rift'){
    const g = ctx.createRadialGradient(x,y,r*0.1,x,y,r);
    g.addColorStop(0,'rgba(255,205,70,.4)');
    g.addColorStop(1,'rgba(255,205,70,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,120,.5)'; ctx.lineWidth = 2;
    for(let k = 0; k < 3; k++){
      ctx.beginPath(); ctx.arc(x, y, r*(0.3 + k*0.16), t*0.5 + k*1.5, t*0.5 + k*1.5 + Math.PI*1.2); ctx.stroke();
    }
    for(const q of parts){
      const px = x + Math.cos(q.a + t*0.5)*q.rad*r;
      const py = y + Math.sin(q.a + t*0.5)*q.rad*r;
      ctx.globalAlpha = 0.35 + 0.5*(0.5 + 0.5*Math.sin(t*2.5 + q.ph));
      ctx.fillStyle = '#ffd75e';
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      if(Math.sin(t*3 + q.ph) > 0.85){
        ctx.fillStyle = '#fff3c4';
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  } else if(n === 'Occult Pool'){
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(20,5,40,.92)');
    g.addColorStop(0.7,'rgba(40,10,50,.6)');
    g.addColorStop(1,'rgba(40,10,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(110,255,150,'+(0.4 + 0.25*Math.sin(t*2))+')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r*0.78, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,255,150,.5)'; ctx.lineWidth = 1.5;
    for(let k = 0; k < 10; k++){
      const a = k/10*Math.PI*2 + t*0.2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a)*r*0.7, y + Math.sin(a)*r*0.7);
      ctx.lineTo(x + Math.cos(a)*r*0.86, y + Math.sin(a)*r*0.86);
      ctx.stroke();
    }
    for(const q of parts){
      const sw = q.a + t*q.sp*0.5;
      const px = x + Math.cos(sw)*q.rad*r*0.75;
      const py = y + Math.sin(sw)*q.rad*r*0.75 + Math.sin(t*1.8 + q.ph)*r*0.1;
      ctx.globalAlpha = 0.3 + 0.5*(0.5 + 0.5*Math.sin(t*2.6 + q.ph));
      ctx.fillStyle = q.ph > 3 ? '#8dff96' : '#7a5cff';
      ctx.fillRect(px, py, 2.2, 2.2);
    }
    ctx.globalAlpha = 1;
  }
}

function drawIslands(){
  ctx.save();
  applyWorldTransform(ctx);
  const view = worldViewport();
  ISLANDS.forEach((isl, i) => {
    const r = isl.r;
    if(isl.x + r*1.9 < view.x || isl.x - r*1.9 > view.x + view.w || isl.y + r*1.9 < view.y || isl.y - r*1.9 > view.y + view.h) return;
    const th = THEME[isl.theme] || THEME.tropical;
    const pts = ISL_POLY[i];
    /* shallow-water halo */
    const halo = ctx.createRadialGradient(isl.x, isl.y, r*0.3, isl.x, isl.y, r*1.8);
    halo.addColorStop(0, 'rgba(120,215,255,.22)');
    halo.addColorStop(0.6, 'rgba(90,190,235,.08)');
    halo.addColorStop(1, 'rgba(90,190,235,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(isl.x, isl.y, r*1.8, 0, Math.PI*2); ctx.fill();
    /* Island top plus its camera-facing vertical cliff faces. */
    const shoreScale=.72, cliffHeight=92;
    const dropX=Math.sin(CAMERA_YAW)*cliffHeight/WORLD_Y_SCALE, dropY=Math.cos(CAMERA_YAW)*cliffHeight/WORLD_Y_SCALE;
    islPolyPath(isl.x+dropX,isl.y+dropY,pts,shoreScale);
    ctx.fillStyle='rgba(0,19,31,.32)'; ctx.fill();
    drawIslandCliffs(isl,pts,shoreScale,cliffHeight,th.dark);
    /* sand beach */
    islPolyPath(isl.x, isl.y, pts, shoreScale);
    const beach=ctx.createLinearGradient(isl.x-r*.45,isl.y-r*.5,isl.x+r*.5,isl.y+r*.6);
    const sunlitBeach=(isl.theme==='tropical'||isl.theme==='desert') ? '#fff1bb' : th.sand;
    beach.addColorStop(0,sunlitBeach); beach.addColorStop(.28,th.sand); beach.addColorStop(1,th.dark);
    ctx.fillStyle = beach;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(255,255,255,'+(0.30 + 0.10*Math.sin(G.frame*0.05 + i))+')';
    islPolyPath(isl.x, isl.y, pts, shoreScale-.015);
    ctx.stroke();
    /* The grass/rock interior is a second, smaller raised terrace above the beach. */
    drawIslandCliffs(isl,pts,.49,27,th.dark);
    /* land */
    islPolyPath(isl.x, isl.y, pts, 0.49);
    const lg = ctx.createLinearGradient(0, isl.y - r*0.5, 0, isl.y + r*0.6);
    lg.addColorStop(0, th.land); lg.addColorStop(1, th.dark);
    ctx.fillStyle = lg;
    ctx.fill();
    /* Contour rings and terrain highlights sell a shallow, climbable plateau. */
    ctx.strokeStyle='rgba(255,255,255,.14)'; ctx.lineWidth=1.5;
    islPolyPath(isl.x-r*.02,isl.y-r*.06,pts,.39); ctx.stroke();
    ctx.strokeStyle='rgba(0,24,20,.22)'; ctx.lineWidth=2;
    islPolyPath(isl.x+r*.02,isl.y+r*.055,pts,.44); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.055)';
    for(let g=0;g<7;g++){
      const gx=isl.x+Math.sin(g*19+i*7)*r*.27, gy=isl.y+Math.cos(g*13+i*5)*r*.22;
      ctx.beginPath(); ctx.ellipse(gx,gy,r*.13,r*.045,-.25,0,Math.PI*2); ctx.fill();
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    islPolyPath(isl.x, isl.y, pts, 0.49);
    ctx.stroke();
    /* raised hill with a soft overhead highlight */
    islPolyPath(isl.x, isl.y, pts, 0.22);
    ctx.fillStyle = th.dark;
    ctx.fill();
    const hill=ctx.createRadialGradient(isl.x-r*.09,isl.y-r*.17,2,isl.x,isl.y,r*.26);
    hill.addColorStop(0,'rgba(255,255,225,.24)'); hill.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=hill; ctx.beginPath(); ctx.arc(isl.x,isl.y,r*.27,0,Math.PI*2); ctx.fill();
    if(isl.theme === 'volcanic'){
      const cx = isl.x, cy = isl.y - r*0.10;
      const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, r*0.6);
      gl.addColorStop(0, 'rgba(255,175,70,.5)');
      gl.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(cx, cy, r*0.6, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,150,50,.55)'; ctx.lineWidth = 2.4;
      for(let s = 0; s < 3; s++){
        const sx = cx + (s-1)*r*0.20;
        ctx.beginPath(); ctx.moveTo(sx, cy + 5);
        ctx.quadraticCurveTo(sx + (s-1)*7, cy + r*0.16, sx + (s-1)*9, cy + r*0.34);
        ctx.stroke();
      }
      ctx.fillStyle = '#ff9a40';
      ctx.beginPath(); ctx.arc(cx, cy, r*0.09, 0, Math.PI*2); ctx.fill();
    }
    if(isl.theme === 'rock'){
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.moveTo(isl.x - r*0.22, isl.y - r*0.42);
      ctx.lineTo(isl.x + r*0.22, isl.y - r*0.38);
      ctx.lineTo(isl.x + r*0.10, isl.y + r*0.02);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(180,235,255,.25)';
      ctx.beginPath(); ctx.arc(isl.x + r*0.08, isl.y - r*0.2, r*0.28, 0, Math.PI*2); ctx.fill();
    }
    if(isl.theme === 'twilight'){
      const gl = ctx.createRadialGradient(isl.x, isl.y - r*0.05, 2, isl.x, isl.y - r*0.05, r*0.5);
      gl.addColorStop(0, 'rgba(197,140,255,.5)');
      gl.addColorStop(1, 'rgba(197,140,255,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(isl.x, isl.y - r*0.05, r*0.5, 0, Math.PI*2); ctx.fill();
    }
    const shim = 0.85 + 0.15*Math.sin(G.frame*0.04 + i*3);
    ISL_TREES[i].forEach(t => {
      if(isl.theme === 'desert') drawCactus(t.x, t.y, t.s);
      else if(isl.theme === 'twilight') drawCrystal(t.x, t.y, t.s);
      else if(isl.theme === 'volcanic') drawCinder(t.x, t.y, t.s);
      else if(isl.theme === 'swamp') drawSwampTree(t.x, t.y, t.s);
      else drawPalm(t.x, t.y, t.s, t.a);
    });
    if(isl.name === 'Coconut Bay'){
      const hx = isl.x - r*0.06, hy = isl.y - r*0.42;
      ctx.fillStyle = 'rgba(0,10,20,.18)';
      ctx.beginPath(); ctx.ellipse(hx, hy + r*0.10, r*0.22, r*0.06, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(hx - r*0.16, hy - r*0.04, r*0.32, r*0.12);
      ctx.fillStyle = '#c98a3a';
      ctx.beginPath(); ctx.moveTo(hx - r*0.20, hy - r*0.04); ctx.lineTo(hx, hy - r*0.22); ctx.lineTo(hx + r*0.20, hy - r*0.04); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(hx - r*0.04, hy - r*0.02, r*0.08, r*0.10);
    }
    if(isl.theme === 'twilight'){
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.arc(isl.x - r*0.30, isl.y - r*0.10, 1.6*shim, 0, Math.PI*2);
      ctx.arc(isl.x + r*0.24, isl.y - r*0.26, 1.3*shim, 0, Math.PI*2);
      ctx.arc(isl.x + r*0.06, isl.y + r*0.18, 1.2*shim, 0, Math.PI*2);
      ctx.fill();
    }
    /* Signboards are rendered as screen-upright billboards after the world pass. */
  });

  POOLS.forEach((p, i) => {
    if(p.x + 200 < view.x || p.x - 200 > view.x + view.w || p.y + 200 < view.y || p.y - 200 > view.y + view.h) return;
    drawPoolFX(p, i);
  });

  const lv = leviStatus();
  if(lv.active){
    /* The event is decorative; a rendering fault must never stop the ocean. */
    try{ drawBabyLeviathan(LEVIATHAN_SPOT, leviHealth()); }
    catch(e){ console.error('Baby Leviathan render failed:', e); }
  }
  ctx.restore();
}

function leviRoundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function drawBabyLeviathan(s, health){
  const t=G.frame*0.028;
  const x=s.x+Math.sin(t*.73)*s.r*.42;
  const y=s.y+Math.cos(t*.97)*s.r*.26;
  const a=Math.cos(t*.73)>=0 ? Math.sin(t*.73)*.38 : Math.PI-Math.sin(t*.73)*.38;
  const pulse=.55+.45*Math.sin(t*2.4);

  ctx.save();
  try{
  ctx.fillStyle='rgba(10,9,30,.48)';
  ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,91,114,'+(.55+pulse*.3)+')'; ctx.lineWidth=3;
  ctx.setLineDash([8,8]); ctx.lineDashOffset=-G.frame*.7;
  ctx.beginPath(); ctx.arc(s.x,s.y,s.r*.92,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);

  ctx.translate(x,y); ctx.rotate(a);
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(5,14,62,22,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#101b3d';
  ctx.beginPath(); ctx.moveTo(-53,0); ctx.quadraticCurveTo(-78,-24,-92,-4); ctx.lineTo(-78,4); ctx.quadraticCurveTo(-70,26,-53,12); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#18295c';
  ctx.beginPath(); ctx.ellipse(-4,0,58,26,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#263d7a';
  ctx.beginPath(); ctx.ellipse(14,-7,38,15,-.08,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#101b3d';
  ctx.beginPath(); ctx.moveTo(-8,-18); ctx.lineTo(5,-48); ctx.lineTo(18,-18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(17,18); ctx.lineTo(35,43); ctx.lineTo(42,14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-5,19); ctx.lineTo(10,39); ctx.lineTo(20,17); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#b8d4ff';
  ctx.beginPath(); ctx.ellipse(38,-8,10,9,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ff516b'; ctx.shadowColor='#ff334f'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.arc(40,-8,4,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  ctx.fillStyle='#c9dcff';
  for(let i=0;i<5;i++){ const fx=19+i*8; ctx.beginPath(); ctx.moveTo(fx,17); ctx.lineTo(fx+4,24); ctx.lineTo(fx+7,17); ctx.closePath(); ctx.fill(); }
  } finally { ctx.restore(); }

  const w=156,h=10,barY=y-68,ratio=health.hp/health.maxHp;
  ctx.fillStyle='rgba(3,9,22,.9)'; leviRoundRect(x-w/2-4,barY-21,w+8,29,7); ctx.fill();
  ctx.font='900 10px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#ffe8a8'; ctx.fillText('BABY LEVIATHAN  '+health.hp+'/'+health.maxHp+' · '+Math.max(1,health.hunters||1)+' HUNTER'+((health.hunters||1)===1?'':'S'),x,barY-10);
  ctx.fillStyle='rgba(255,255,255,.16)'; leviRoundRect(x-w/2,barY,w,h,5); ctx.fill();
  if(ratio>0){ ctx.fillStyle=ratio>.4?'#ff6b70':'#ff334f'; leviRoundRect(x-w/2,barY,Math.max(5,w*ratio),h,5); ctx.fill(); }
}

function updateAltarBtn(){
  const alt = islandById('altar');
  const actor=G.player.onFoot?G.player:G.boat;
  const nearAltar = alt && Math.hypot(actor.x-alt.x, actor.y-alt.y) < alt.r*1.4;
  const altBtn = byId('btnAltar');
  if(altBtn) altBtn.classList.toggle('hidden', !nearAltar);
}
function updateLandButton(){
  const btn=byId('btnLand'); if(!btn) return;
  if(G.player.onFoot){
    btn.classList.remove('hidden'); btn.classList.add('board');
    btn.innerHTML='🚤 <span>BOARD BOAT</span>';
  }else{
    const isl=landableIsland();
    btn.classList.toggle('hidden', !isl);
    btn.classList.remove('board'); btn.innerHTML='🧍 <span>GET OUT</span>';
  }
}

function drawBoatSprite(c, id, scale){
  const s = scale || 1;
  c.save();
  c.scale(s,s);
  c.lineWidth = 1.2;
  c.strokeStyle = 'rgba(0,20,35,.5)';
  switch(id){
    case 'surf':
      c.fillStyle = '#ffb347';
      c.beginPath(); c.moveTo(16,0); c.quadraticCurveTo(10,6,-6,6); c.quadraticCurveTo(-12,6,-14,0); c.quadraticCurveTo(-12,-6,-6,-6); c.quadraticCurveTo(10,-6,16,0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2f7bd6'; c.fillRect(3,-6,3,12);
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(4,0,2.6,0,Math.PI*2); c.fill();
      c.fillStyle = '#222'; c.fillRect(-5,-1.5,7,3);
      break;
    case 'canoe':
      c.fillStyle = '#7c4a23';
      c.beginPath(); c.moveTo(17,0); c.quadraticCurveTo(6,5,-7,5); c.lineTo(-12,0); c.lineTo(-7,-5); c.quadraticCurveTo(6,-5,17,0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#a86f3a'; c.fillRect(0,-4.5,4,9);
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(4,0,2.4,0,Math.PI*2); c.fill();
      break;
    case 'rowboat':
      c.fillStyle = '#8a5a2b';
      c.beginPath(); c.moveTo(10,2); c.quadraticCurveTo(2,-11,-10,2); c.quadraticCurveTo(-6,9,10,2); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#5c3a18'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-7,0); c.lineTo(7,0); c.moveTo(-5,3); c.lineTo(5,3); c.stroke();
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(0,-3,2.4,0,Math.PI*2); c.fill();
      break;
    case 'enthusiast':
      c.fillStyle = '#e8423d';
      c.beginPath(); c.moveTo(14,-2); c.quadraticCurveTo(5,-10,-9,-2); c.quadraticCurveTo(-10,4,0,7); c.quadraticCurveTo(8,5,14,-2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#f5f7fa'; c.beginPath(); c.moveTo(0,-8); c.lineTo(7,-8); c.lineTo(5,-2); c.lineTo(0,-2); c.closePath(); c.fill();
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(-1,-6,2.2,0,Math.PI*2); c.fill();
      break;
    case 'dingy':
      c.fillStyle = '#d8b25c';
      c.beginPath(); c.moveTo(12,2); c.quadraticCurveTo(3,-10,-11,2); c.quadraticCurveTo(-7,8,12,2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#f7f2e4'; c.beginPath(); c.moveTo(-2,-6); c.lineTo(-2,7); c.lineTo(8,7); c.closePath(); c.fill();
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(0,-4,2.2,0,Math.PI*2); c.fill();
      break;
    case 'yacht':
      c.fillStyle = '#e8eef4';
      c.beginPath(); c.moveTo(15,0); c.quadraticCurveTo(5,-10,-12,0); c.quadraticCurveTo(5,10,15,0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2c3e50'; c.fillRect(-6,-9,12,9);
      c.fillStyle = '#aee0ff'; c.fillRect(-5,-8,4,6);
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(-1,-6,2.2,0,Math.PI*2); c.fill();
      break;
    case 'luxury':
      c.fillStyle = '#0f7b3f';
      c.beginPath(); c.moveTo(15,-1); c.quadraticCurveTo(6,-9,-10,0); c.quadraticCurveTo(-12,5,0,8); c.quadraticCurveTo(9,6,15,-1); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#eaf2f8'; c.beginPath(); c.moveTo(2,-8); c.lineTo(9,-8); c.lineTo(7,-2); c.lineTo(1,-2); c.closePath(); c.fill();
      c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.beginPath(); c.moveTo(-9,1); c.lineTo(9,1); c.stroke();
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(0,-6,2.2,0,Math.PI*2); c.fill();
      break;
    case 'manta':
      c.fillStyle = '#2a3a52';
      c.beginPath(); c.moveTo(13,0); c.quadraticCurveTo(8,7,-4,14); c.quadraticCurveTo(-6,7,-2,0); c.quadraticCurveTo(-6,-7,-4,-14); c.quadraticCurveTo(8,-7,13,0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(5,0,2.2,0,Math.PI*2); c.fill();
      c.strokeStyle = 'rgba(174,224,255,.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3,-11); c.quadraticCurveTo(-7,0,-3,11); c.stroke();
      break;
    case 'stego':
      c.fillStyle = '#6b7c52'; c.fillRect(-11,-4,22,9);
      c.fillStyle = '#4c5a3a';
      c.beginPath(); c.moveTo(-11,-4); c.lineTo(-7,-9); c.lineTo(-2,-4); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-1,-4); c.lineTo(3,-10); c.lineTo(7,-4); c.closePath(); c.fill();
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(0,-7,2.2,0,Math.PI*2); c.fill();
      break;
    case 'galleon':
      c.fillStyle = '#5d3a1c';
      c.beginPath(); c.moveTo(17,0); c.quadraticCurveTo(7,-9,-13,0); c.quadraticCurveTo(7,10,17,0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#e9dcc0'; c.fillRect(-10,-7,9,7);
      c.fillStyle = '#8a5a2b'; c.fillRect(-4,-11,2,6);
      c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(-3,-5,2,0,Math.PI*2); c.fill();
      break;
    case 'skull':
      c.fillStyle = '#ff5da2';
      c.beginPath(); c.moveTo(18,0); c.quadraticCurveTo(7,-11,-14,0); c.quadraticCurveTo(7,11,18,0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff9bc8'; c.beginPath(); c.ellipse(4,-3,10,5,-.15,0,Math.PI*2); c.fill();
      c.fillStyle = '#fff4fb'; c.beginPath(); c.arc(2,-2,5,0,Math.PI*2); c.fill();
      c.fillStyle = '#4b1640'; c.beginPath(); c.arc(0,-3,1.35,0,Math.PI*2); c.arc(4,-3,1.35,0,Math.PI*2); c.fill(); c.fillRect(1,-.5,3,2);
      c.strokeStyle = '#ffd166'; c.lineWidth=1.4; c.beginPath(); c.moveTo(-12,2); c.lineTo(13,2); c.stroke();
      break;
    case 'pinkfong':
      /* Pink fox character boat: the head and ears are the silhouette, not a decal. */
      c.fillStyle='#f83da1';
      c.beginPath(); c.moveTo(17,4); c.quadraticCurveTo(8,13,-12,8); c.quadraticCurveTo(-17,4,-14,0); c.quadraticCurveTo(-8,-3,13,-2); c.quadraticCurveTo(18,0,17,4); c.closePath(); c.fill(); c.stroke();
      c.fillStyle='#ff6fba'; c.beginPath(); c.ellipse(1,-4,12,10,-.1,0,Math.PI*2); c.fill(); c.stroke();
      c.fillStyle='#7c3dd7';
      c.beginPath(); c.moveTo(-7,-9); c.lineTo(-5,-21); c.lineTo(1,-11); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(5,-11); c.lineTo(10,-21); c.lineTo(13,-8); c.closePath(); c.fill(); c.stroke();
      c.fillStyle='#ffd2e9';
      c.beginPath(); c.ellipse(5,0,8,5,0,0,Math.PI*2); c.fill();
      c.fillStyle='#fff'; c.beginPath(); c.ellipse(-1,-6,4,3.6,0,0,Math.PI*2); c.ellipse(8,-6,4,3.6,0,0,Math.PI*2); c.fill();
      c.fillStyle='#302053'; c.beginPath(); c.arc(0,-6,1.4,0,Math.PI*2); c.arc(7,-6,1.4,0,Math.PI*2); c.fill();
      c.fillStyle='#6d2a75'; c.beginPath(); c.arc(4,-.5,1.8,0,Math.PI*2); c.fill();
      c.strokeStyle='#fff0fa'; c.lineWidth=1.25; c.beginPath(); c.moveTo(5,2); c.quadraticCurveTo(8,5,11,2); c.stroke();
      c.fillStyle='#ffd166'; c.beginPath(); c.arc(-9,2,1.5,0,Math.PI*2); c.arc(-5,5,1.1,0,Math.PI*2); c.fill();
      break;
    case 'witchy':
      c.shadowColor='#8262cc'; c.shadowBlur=14;
      c.fillStyle='#0a0914'; c.beginPath(); c.moveTo(27,0); c.quadraticCurveTo(9,-17,-24,0); c.quadraticCurveTo(8,17,27,0); c.closePath(); c.fill(); c.stroke(); c.shadowBlur=0;
      c.fillStyle='#242038'; c.beginPath(); c.ellipse(3,-5,18,7,-.14,0,Math.PI*2); c.fill();
      c.fillStyle='#12101d'; c.beginPath(); c.moveTo(-6,-5); c.lineTo(0,-24); c.lineTo(7,-5); c.closePath(); c.fill();
      c.strokeStyle='#d9bd70'; c.lineWidth=1.8; c.beginPath(); c.moveTo(-18,4); c.lineTo(22,4); c.stroke();
      c.fillStyle='#f5dc91'; c.beginPath(); c.arc(5,-7,6,0,Math.PI*2); c.fill(); c.fillStyle='#242038'; c.beginPath(); c.arc(8,-8,6,0,Math.PI*2); c.fill();
      c.strokeStyle='#8064d1'; c.lineWidth=1.1; c.beginPath(); c.arc(-8,-3,5,0,Math.PI*2); c.stroke();
      c.fillStyle='#d9bd70'; c.font='900 5px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('☾',-8,-3);
      break;
    case 'davetest':
      c.fillStyle='#9c6810';
      c.beginPath(); c.moveTo(18,0); c.quadraticCurveTo(7,-12,-15,0); c.quadraticCurveTo(7,12,18,0); c.closePath(); c.fill(); c.stroke();
      const gold=c.createLinearGradient(-14,-8,16,8); gold.addColorStop(0,'#ffdc62'); gold.addColorStop(.45,'#fff7b3'); gold.addColorStop(1,'#d89a16');
      c.fillStyle=gold; c.beginPath(); c.moveTo(15,-1); c.quadraticCurveTo(6,-8,-11,0); c.quadraticCurveTo(5,7,15,-1); c.closePath(); c.fill();
      c.fillStyle='#fff4a5'; c.beginPath(); c.arc(1,-4,3.1,0,Math.PI*2); c.fill();
      c.fillStyle='#4b3105'; c.beginPath(); c.arc(0,-4,1,0,Math.PI*2); c.arc(3,-4,1,0,Math.PI*2); c.fill();
      c.fillStyle='#ffe066'; c.beginPath(); c.moveTo(-7,-10); c.lineTo(-4,-16); c.lineTo(-1,-10); c.closePath(); c.fill();
      c.strokeStyle='#fff3a0'; c.lineWidth=1.3; c.beginPath(); c.moveTo(-9,2); c.lineTo(12,2); c.stroke();
      break;
    case 'creator':
      c.fillStyle='#9aa6b2'; c.beginPath(); c.moveTo(22,1); c.quadraticCurveTo(8,-15,-20,0); c.quadraticCurveTo(6,15,22,1); c.closePath(); c.fill(); c.stroke();
      const yachtWhite=c.createLinearGradient(-18,-11,20,12); yachtWhite.addColorStop(0,'#ffffff'); yachtWhite.addColorStop(.5,'#e7f4ff'); yachtWhite.addColorStop(1,'#9db4c8');
      c.fillStyle=yachtWhite; c.beginPath(); c.moveTo(21,0); c.quadraticCurveTo(8,-10,-17,0); c.quadraticCurveTo(5,9,21,0); c.closePath(); c.fill();
      c.fillStyle='#dceefa'; c.beginPath(); c.moveTo(-4,-14); c.lineTo(10,-14); c.lineTo(15,-3); c.lineTo(-8,-3); c.closePath(); c.fill();
      c.fillStyle='#4c7c9d'; c.fillRect(-2,-12,6,5); c.fillRect(6,-12,5,5);
      c.strokeStyle='#d4a927'; c.lineWidth=1.5; c.beginPath(); c.moveTo(-14,2); c.lineTo(17,2); c.stroke();
      c.fillStyle='#284158'; c.font='900 4.8px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('DAVEVR',2,5);
      c.fillStyle='#fff'; c.beginPath(); c.arc(2,-7,2.3,0,Math.PI*2); c.fill();
      break;
    case 'booty':
      c.fillStyle='#3b176a'; c.beginPath(); c.moveTo(21,0); c.quadraticCurveTo(7,-12,-17,0); c.quadraticCurveTo(6,12,21,0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle='#7f39bd'; c.beginPath(); c.moveTo(17,-1); c.quadraticCurveTo(6,-8,-13,0); c.quadraticCurveTo(5,7,17,-1); c.closePath(); c.fill();
      c.strokeStyle='#e4bdff'; c.lineWidth=1.4; c.beginPath(); c.moveTo(-11,2); c.lineTo(15,2); c.stroke();
      c.fillStyle='#2a104d'; c.fillRect(-2,-14,2,12); c.fillStyle='#bd7bff'; c.beginPath(); c.moveTo(0,-14); c.lineTo(10,-10); c.lineTo(0,-5); c.closePath(); c.fill();
      c.fillStyle='#ffd166'; c.beginPath(); c.arc(-7,-2,2.4,0,Math.PI*2); c.fill(); c.fillStyle='#fff1a6'; c.beginPath(); c.arc(-8,-3,0.8,0,Math.PI*2); c.fill();
      break;
    case 'jack':
      c.fillStyle='#2b1b15'; c.beginPath(); c.moveTo(28,0); c.quadraticCurveTo(9,-16,-25,0); c.quadraticCurveTo(8,16,28,0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle='#704225'; c.beginPath(); c.moveTo(24,-1); c.quadraticCurveTo(8,-9,-20,0); c.quadraticCurveTo(7,9,24,-1); c.closePath(); c.fill();
      c.strokeStyle='#c89245'; c.lineWidth=1.6; c.beginPath(); c.moveTo(-19,3); c.lineTo(24,3); c.stroke();
      c.fillStyle='#4b2d1b'; c.fillRect(-1,-27,2,22); c.fillStyle='#17120f'; c.beginPath(); c.moveTo(1,-26); c.lineTo(18,-20); c.lineTo(1,-12); c.closePath(); c.fill();
      c.fillStyle='#eee0bd'; c.font='900 8px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('☠',8,-19);
      c.fillStyle='#d4a05c'; c.beginPath(); c.arc(-7,-4,2.2,0,Math.PI*2); c.fill();
      break;
    default:
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(16,0); c.quadraticCurveTo(4,-11,-14,0); c.quadraticCurveTo(4,11,16,0); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}

function drawBoat(){
  ctx.save();
  applyWorldTransform(ctx);
  const b = G.boat;
  ctx.translate(b.x, b.y);
  if(save.boat==='jack' || activeTitle()==='JACK'){
    const dark=ctx.createRadialGradient(0,0,4,0,0,72); dark.addColorStop(0,'rgba(5,4,12,.68)'); dark.addColorStop(.52,'rgba(13,10,27,.32)'); dark.addColorStop(1,'rgba(10,7,22,0)');
    ctx.fillStyle=dark; ctx.beginPath(); ctx.ellipse(0,0,72,35,0,0,Math.PI*2); ctx.fill();
  }
  if(b.speed > 8){
    for(let i = G.effects.length-1; i >= 0; i--){
      const e = G.effects[i];
      if(e.type === 'pinkStar'){
        const a=1-e.t/1.4, sz=3+a*3;
        ctx.save(); ctx.translate(e.x-b.x,e.y-b.y); ctx.rotate((e.spin||0)+e.t*4);
        ctx.fillStyle='rgba(255,101,183,'+a+')'; ctx.beginPath();
        for(let p=0;p<10;p++){ const r=p%2?sz*.45:sz; const q=-Math.PI/2+p*Math.PI/5; p?ctx.lineTo(Math.cos(q)*r,Math.sin(q)*r):ctx.moveTo(Math.cos(q)*r,Math.sin(q)*r); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,220,104,'+a+')'; ctx.beginPath(); ctx.arc(0,0,sz*.28,0,Math.PI*2); ctx.fill(); ctx.restore();
        continue;
      }
      if(e.type === 'betaGold' || e.type === 'betaLetter'){
        const a=1-e.t/1.4;
        ctx.save(); ctx.translate(e.x-b.x,e.y-b.y-e.t*7);
        if(e.type==='betaGold'){
          const sz=(e.size||3)*(1+.35*Math.sin(e.t*12));
          ctx.fillStyle='rgba(255,207,64,'+a+')'; ctx.shadowColor='#ffd64a'; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.arc(0,0,sz,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,250,190,'+a+')'; ctx.beginPath(); ctx.arc(-sz*.25,-sz*.3,sz*.35,0,Math.PI*2); ctx.fill();
        }else{
          ctx.rotate(e.spin||0); ctx.font='900 8px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillStyle='rgba(255,232,119,'+a+')'; ctx.strokeStyle='rgba(122,73,4,'+a+')'; ctx.lineWidth=1.4; ctx.strokeText(e.letter,0,0); ctx.fillText(e.letter,0,0);
        }
        ctx.restore();
        continue;
      }
      if(e.type==='witchMote'){
        const a=1-e.t/1.4, sz=3+Math.sin(e.t*8+(e.phase||0))*1.4;
        ctx.save(); ctx.translate(e.x-b.x,e.y-b.y-e.t*5); ctx.fillStyle='rgba(139,105,220,'+a+')'; ctx.shadowColor='#8b69dc'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(0,0,sz,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(238,218,255,'+a+')'; ctx.beginPath(); ctx.arc(-1,-1,sz*.3,0,Math.PI*2); ctx.fill(); ctx.restore();
        continue;
      }
      if(e.type==='tentacle'){
        const a=1-e.t/1.4; ctx.save(); ctx.translate(e.x-b.x,e.y-b.y); ctx.strokeStyle='rgba(95,64,126,'+a+')'; ctx.lineWidth=3; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,7); for(let q=1;q<5;q++) ctx.quadraticCurveTo(Math.sin(q*1.8+e.phase+e.t*4)*7,q*5,Math.sin((q+1)*1.8+e.phase+e.t*4)*8,(q+1)*5); ctx.stroke(); ctx.restore();
        continue;
      }
      if(e.type !== 'wake') continue;
      const a = 1 - e.t/1.4;
      ctx.strokeStyle = 'rgba(255,255,255,'+(a*0.4)+')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const ox = -Math.sin(b.head)*e.t*40, oy = Math.cos(b.head)*e.t*40;
      ctx.moveTo(ox, oy+6); ctx.lineTo(ox-8, oy+12);
      ctx.moveTo(ox, oy-6); ctx.lineTo(ox-8, oy-12);
      ctx.stroke();
    }
  }
  ctx.rotate(b.head - Math.PI/2);
  ctx.fillStyle = 'rgba(0,10,20,.18)';
  ctx.beginPath(); ctx.ellipse(2, 3, 16, 10, 0, 0, Math.PI*2); ctx.fill();
  drawBoatSprite(ctx, save.boat, 1);
  ctx.restore();
}
function updateLandAvatar(){
  const el=byId('landAvatar');
  if(!G.player.onFoot){ el.classList.add('hidden'); return; }
  const p=worldToScreen(G.player.x,G.player.y);
  el.style.left=p.x+'px'; el.style.top=(p.y+5)+'px'; el.classList.remove('hidden');
  byId('landName').textContent=(save.name||'Angler')+' · Lv'+save.level;
  const title=activeTitle()||'';
  const meta=TITLES.find(t=>t.name===title);
  byId('landTitle').textContent=title;
  byId('landTitle').style.color=(meta&&meta.color)||'#ffd166';
  byId('landTitle').classList.toggle('creator-title', !!(meta&&meta.size==='large'));
  applyAvatarLook(byId('landWalker'));
}

function applyAvatarLook(el){
  if(!el) return;
  const a=Object.assign({gender:'female', skin:'warm', hair:'long', hairColor:'brown', outfit:'teal'}, save.avatar||{});
  const skins={fair:'#f7d5bc',warm:'#d89b73',deep:'#88563f'};
  const hairs={black:'#202335',brown:'#75442e',blonde:'#efc35f',pink:'#ff75b5',blue:'#5dc9f5'};
  const outfits={teal:'#2fc3c9',coral:'#ff766b',violet:'#8e72ee',gold:'#e7b94d',navy:'#37689b'};
  el.dataset.gender=a.gender;
  el.dataset.hair=a.hair;
  el.dataset.special=a.special||'';
  el.style.setProperty('--skin', skins[a.skin]||skins.warm);
  el.style.setProperty('--hair', hairs[a.hairColor]||hairs.brown);
  el.style.setProperty('--outfit', outfits[a.outfit]||outfits.teal);
}

function drawOverlays(){
  if(G.state.weather === 'Rainy' || G.state.weather === 'Stormy'){
    ctx.strokeStyle = 'rgba(180,210,255,'+(G.state.weather==='Stormy'?0.35:0.2)+')';
    ctx.lineWidth = 1.5;
    const n = 60;
    for(let i = 0; i < n; i++){
      const x = (i*97 + G.frame*6) % W;
      const y = (i*53 + Math.floor(G.frame*0.5)*3) % H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x-4, y+16);
      ctx.stroke();
    }
  }
  if(G.state.weather === 'Foggy'){
    ctx.fillStyle = 'rgba(190,205,220,0.18)';
    ctx.fillRect(0,0,W,H);
  }
  if(G.state.weather === 'Stormy' && Math.random() < 0.004){
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0,0,W,H);
  }
  if(G.state.time === 'Night'){
    ctx.fillStyle = 'rgba(8,14,40,0.32)';
    ctx.fillRect(0,0,W,H);
  }
}

function drawMinimap(){
  const mw = mCanvas.width, mh = mCanvas.height;
  mctx.clearRect(0,0,mw,mh);
  mctx.fillStyle = '#041a2e'; mctx.fillRect(0,0,mw,mh);
  mctx.strokeStyle = 'rgba(90,200,255,.22)'; mctx.strokeRect(0.5,0.5,mw-1,mh-1);
  const sx = mw/WORLD_W, sy = mh/WORLD_H;
  mctx.font = '600 7px system-ui,sans-serif';
  mctx.textAlign = 'center';
  ISLANDS.forEach((isl,i) => {
    const x = isl.x*sx, y = isl.y*sy, rr = Math.max(3, isl.r*sx*0.4);
    mctx.fillStyle = 'rgba(255,220,150,.85)';
    mctx.beginPath(); mctx.arc(x,y,rr,0,Math.PI*2); mctx.fill();
    mctx.fillStyle = isl.theme==='rock' ? '#9fc8e8' : '#3f9e5a';
    mctx.beginPath(); mctx.arc(x,y,rr*0.62,0,Math.PI*2); mctx.fill();
    mctx.fillStyle = 'rgba(233,246,255,.9)';
    mctx.fillText(isl.name, x, y+rr+8);
  });
  POOLS.forEach((p, i) => {
    const col = POOL_COLOR[p.name] || '#78f0ff';
    mctx.fillStyle = col; mctx.globalAlpha = 0.55;
    mctx.beginPath(); mctx.arc(p.x*sx, p.y*sy, 2.5, 0, Math.PI*2); mctx.fill();
    mctx.globalAlpha = 1;
    mctx.strokeStyle = col; mctx.globalAlpha = 0.8;
    mctx.lineWidth = 1;
    mctx.beginPath(); mctx.arc(p.x*sx, p.y*sy, 4, 0, Math.PI*2); mctx.stroke();
    mctx.globalAlpha = 1;
  });
  const lv = leviStatus();
  if(lv.active){
    mctx.fillStyle = 'rgba(255,80,90,.8)';
    mctx.beginPath(); mctx.arc(LEVIATHAN_SPOT.x*sx, LEVIATHAN_SPOT.y*sy, 4, 0, Math.PI*2); mctx.fill();
  }
  const mp = (window.Multi && Multi.players) || null;
  if(mp){
    for(const id in mp){
      const p = mp[id];
      mctx.fillStyle = p.color || '#ffd166';
      mctx.globalAlpha = 0.9;
      mctx.beginPath(); mctx.arc(p.x*sx, p.y*sy, 2.2, 0, Math.PI*2); mctx.fill();
      mctx.globalAlpha = 1;
      mctx.strokeStyle = 'rgba(0,10,20,.6)';
      mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(p.x*sx, p.y*sy, 3.4, 0, Math.PI*2); mctx.stroke();
    }
  }
  const b = G.boat;
  mctx.save();
  mctx.translate(b.x*sx, b.y*sy);
  mctx.rotate(b.head - Math.PI/2);
  mctx.fillStyle = '#ffd166';
  mctx.beginPath(); mctx.moveTo(5,0); mctx.lineTo(-3,-3); mctx.lineTo(-3,3); mctx.closePath(); mctx.fill();
  mctx.restore();
  mctx.strokeStyle = 'rgba(255,255,255,.35)';
  mctx.strokeRect(G.cam.x*sx - (W/(2*G.cam.zoom))*sx, G.cam.y*sy - (H/(2*G.cam.zoom))*sy, (W/G.cam.zoom)*sx, (H/G.cam.zoom)*sy);
}

/* ---------------- main loop ---------------- */
let lastT = 0;
function loop(t){
  requestAnimationFrame(loop);
  let dt = (t - lastT)/1000;
  if(dt > 0.06) dt = 0.06;
  if(dt <= 0) return;
  lastT = t;
  G.frame++;
  const delta = dt;
  G.state.weatherT += delta;
  G.state.timeT += delta;
  if(G.state.weatherT > G.state.weatherDur){ G.state.weatherT = 0; nextWeather(); }
  if(G.state.timeT > 180){ G.state.timeT = 0; advanceTime(); }

  if(G.fish.state === 'waiting'){
    if(t >= G.fish.biteAt) onBite();
  } else if(G.fish.state === 'reeling'){
    tickReel(delta);
  }
  if(G.fish.state === 'idle'){
    readKeyboardInput();
    updateBoat(delta);
  } else {
    updateBoat(delta*0.05);
  }

  G.curLoc = detectLoc();
  G.leviSyncTimer -= delta;
  if(G.leviSyncTimer <= 0){
    G.leviSyncTimer = 3;
    if(leviStatus().active && window.Net) Net.refreshLeviathan(leviHunterCount());
  }
  updateAltarBtn();
  updateLandButton();
  const focus=G.player.onFoot?G.player:G.boat;
  G.cam.x += (focus.x - G.cam.x) * Math.min(1, delta*5);
  G.cam.y += (focus.y - G.cam.y) * Math.min(1, delta*5);
  G.cam.zoom = G.player.onFoot ? Math.max(.8,Math.min(1.72,W/620)) : Math.max(0.5, Math.min(1.5, W/780));

  if(Math.random() < delta*3 && G.sparkles.length < 90){
    G.sparkles.push({ x: G.cam.x - W/(2*G.cam.zoom) + Math.random()*(W/G.cam.zoom),
      y: G.cam.y - H/(2*G.cam.zoom) + Math.random()*(H/G.cam.zoom), w: 1+Math.random()*2, a: 0.2+Math.random()*0.5, p: Math.random()*10 });
  }
  for(let i = G.sparkles.length-1; i >= 0; i--){
    G.sparkles[i].y += 0.3;
    if(G.sparkles[i].y > G.cam.y + H/(2*G.cam.zoom)) G.sparkles.splice(i,1);
  }

  drawOcean();
  drawIslands();
  updateIslandSigns();
  drawBoat();
  updateLandAvatar();
  drawOverlays();
  Multi.draw();
  Multi.tick(delta);

  G.hudTimer -= delta;
  if(G.hudTimer <= 0){ G.hudTimer = 0.5; updateHud(); }
  G.mmTimer -= delta;
  if(G.mmTimer <= 0){ G.mmTimer = 0.25; drawMinimap(); }
  G.saveTimer += delta;
  if(G.saveTimer > 6){ G.saveTimer = 0; persist(); }
}

/* ---------------- public API ---------------- */
const Game = {
  save, G, MASTER, BY_LOC, BY_NAME, RARITY_ORDER, RARITIES, MUTATIONS,
  curRod, curEnchant, statSums, detectLoc, cast, sellFish, sellAll, sellItem, useItem,
  buyGear, equipGear, buyBoat, equipBoat, boatRoulette, doEnchant, redeemCode,
  claimQuest, claimBounty, genBounties, updateBounties, questUnlocked, activeQuests, questProg,
  grantTitle, equipTitle, checkTitle, checkIndexCompletion, addXp, xpNeed, addItem,
  itemCanShow, leviStatus, leviHealth, leviHunterCount, relicToKey, locName, effLuck, effAtt, fishValue, toggleLand,
  updateHud, resetSave, questMap: ()=>QUESTS,
  titles: ()=>TITLES, codes: ()=>CODES, poolMods: POOL_MODS,
  indexCount: ()=>Object.keys(save.index).length,
  persist, applyAvatarLook,
  refreshBounties: ()=>{ genBounties(); },
  init(){
    loadSave();
    resize();
    bindInput();
    genBounties();
    Multi.init();
    if(typeof Social !== 'undefined') Social.init();
    if(!save.name){
      G.state.running = true;
      UI.openName();
    } else {
      G.state.running = true;
      UI.bootstrap();
    }
    G.state.weather = 'Clear';
    G.state.time = 'Day';
    requestAnimationFrame(loop);
  }
};
window.Game = Game;
window.G = G;
