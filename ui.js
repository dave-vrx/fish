'use strict';
/* ============================================================
   FISH! — UI: modals, index, shop, inventory, quests, board
   Made by Dave-VR
   ============================================================ */

let actx = null;
function sfx(freq, dur, vol, type){
  try{
    if(!G.save || !G.save.sound) return;
    actx = actx || new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type||'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol||0.1, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  }catch(e){}
}
function toast(msg, cls){
  const box = byId('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (cls ? ' '+cls : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, 2600);
}

const UI = {
  /* ---------- boot / name ---------- */
  openName(){
    byId('veilName').classList.remove('hidden');
    const inp = byId('nameInput');
    inp.value = '';
    byId('nameLen').textContent = '0/16';
    const av = byId('avatarCircle');
    if(av) av.textContent = '🪝';
    setTimeout(() => inp.focus(), 120);
  },
  previewAvatar(v){
    const av = byId('avatarCircle');
    if(!av) return;
    const c = (v||'').trim().charAt(0);
    av.textContent = c ? c.toUpperCase() : '🪝';
  },
  randomName(){
    const a = ['Angler','Captain','Coral','Drift','Reef','Storm','Bubbles','Tide','Anchor','Sailor','Sunfish','Crabby'];
    const b = ['Skipper','McHook','Bait','Gill','Fisher','Sails','Fin','Bay','Blubber','Rudder','Dock','King'];
    let n;
    do{ n = a[Math.floor(Math.random()*a.length)]+' '+b[Math.floor(Math.random()*b.length)]; }while(n.length>16);
    const inp = byId('nameInput');
    inp.value = n;
    byId('nameLen').textContent = n.length+'/16';
    UI.previewAvatar(n);
    inp.focus();
  },
  submitName(){
    const v = byId('nameInput').value.trim().replace(/\s+/g,' ');
    if(!v){ toast('Pick a name to start!', 'bad'); return; }
    G.save.name = v.slice(0,16);
    Game.persist();
    UI.close('veilName');
    Net.init();
    Net.onNameChange();
    UI.updateHud();
    toast('🎣 Welcome, '+G.save.name+'! Time to fish!', 'good');
  },
  bootstrap(){
    UI.close('veilName');
    Net.init();
    UI.updateHud();
    toast('Welcome back, '+G.save.name+'! 🎣');
  },
  close(id){ byId(id).classList.add('hidden'); },
  updateHud(){ Game.updateHud(); },

  /* ---------- catch modal ---------- */
  showCatch(c, extra){
    const veil = byId('veilCatch');
    byId('catchImg').innerHTML = c.img
      ? '<img src="'+c.img+'" onerror="this.outerHTML=\'<div style=font-size:64px>🎣</div>\'">'
      : '<div style="font-size:64px">🎣</div>';
    byId('catchName').textContent = c.name + (c.double ? '  ✨x2!' : '');
    const r = RARITIES[c.rar] || {};
    let rcls;
    if(c.rar === 'Relic') rcls = 'relic';
    else if(c.rar === 'Secret') rcls = 'secret';
    else if(c.rar === 'Ultimate Secret') rcls = 'ult';
    else rcls = 'rare-' + Math.min(7, Math.max(1, RARITY_ORDER.indexOf(c.rar)+1));
    let badges = '<span class="badge '+rcls+'">'+c.rar+'</span>';
    if(c.relic) badges += '<span class="badge relic">RELIC</span>';
    if(c.mut) badges += '<span class="badge mut">'+c.mut.toUpperCase()+'</span>';
    if(c.huge) badges += '<span class="badge size">HUGE</span>';
    if(c.tiny) badges += '<span class="badge size">TINY</span>';
    if(c.perfect) badges += '<span class="badge perfect">PERFECT</span>';
    byId('catchBadges').innerHTML = badges;
    if(c.relic){
      byId('catchMeta').textContent = 'A relic for the Enchanting Altar!';
      byId('catchNew').classList.toggle('hidden', !extra || !extra.newF);
    } else {
      const size = c.huge ? ' 🐋' : c.tiny ? ' 🐟' : '';
      let meta = c.wt+' kg'+size+' · $'+fmt(c.val)+(c.perfect?' · PERFECT +':'');
      if(extra && extra.bonusCoins) meta += ' · +$'+extra.bonusCoins+' (enchant)';
      if(extra && extra.sold != null) meta += '\nAUTO-SOLD for $'+fmt(extra.sold);
      byId('catchMeta').textContent = meta;
      byId('catchMeta').style.whiteSpace = 'pre-line';
      byId('catchNew').classList.toggle('hidden', !c.new);
    }
    veil.classList.remove('hidden');
  },
  closeCatch(){ UI.close('veilCatch'); },

  /* ---------- index ---------- */
  openIndex(){
    UI.closeAllVeils();
    byId('veilIndex').classList.remove('hidden');
    UI.renderIndex();
  },
  renderIndex(chip){
    const locs = ['All'].concat(Object.keys(FISH_DATA).filter(l => l !== 'Leviathan'));
    const total = new Set(MASTER.map(f => f.name)).size;
    byId('indexCount').textContent = Object.keys(G.save.index).length + ' / ' + total + ' species discovered';
    const chips = byId('indexChips');
    chips.innerHTML = locs.map(l =>
      '<button class="'+(l===(chip||'All')?'on':'')+'">'+l+'</button>').join('');
    chips.querySelectorAll('button').forEach(b => {
      b.onclick = () => UI.renderIndex(b.textContent);
    });
    const sel = chip || 'All';
    let list;
    if(sel === 'All'){
      const seen = {};
      list = [];
      for(const f of MASTER){ if(!seen[f.name]){ seen[f.name] = 1; list.push(f); } }
    } else {
      list = BY_LOC[sel] || [];
    }
    const grid = byId('indexGrid');
    let html = '';
    for(const f of list){
      const caught = !!G.save.index[f.name];
      const star = (RARITY_ORDER.indexOf(f.rar)+1) || 1;
      html += '<div class="fish-card'+(caught?'':' locked')+'">'+
        '<div class="thumb">'+(caught
          ? '<img src="'+f.img+'" loading="lazy" onerror="this.outerHTML=\'<div style=font-size:30px>🐟</div>\'">'
          : '❓')+'</div>'+
        '<div class="fname">'+escapeHtml(f.name)+'</div>'+
        '<div class="star">'+'★'.repeat(star)+'</div>'+
        '<div class="floc">'+(f.rar)+'</div></div>';
    }
    grid.innerHTML = html;
  },

  /* ---------- shop ---------- */
  ShopTab: 'rods',
  openShop(){
    UI.closeAllVeils();
    byId('veilShop').classList.remove('hidden');
    UI.renderShop();
  },
  renderShop(){
    const loc = Game.detectLoc();
    byId('shopLoc').textContent = 'Selling at '+loc.name;
    byId('shopTabs').querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.t === UI.ShopTab);
      b.onclick = () => { UI.ShopTab = b.dataset.t; UI.renderShop(); };
    });
    const arr = UI.ShopTab === 'rods' ? RODS : UI.ShopTab === 'lines' ? LINES : BOBBERS;
    const owned = UI.ShopTab === 'rods' ? G.save.ownedRods : UI.ShopTab === 'lines' ? G.save.ownedLines : G.save.ownedBobbers;
    const cur = G.save[UI.ShopTab === 'rods' ? 'rod' : UI.ShopTab === 'lines' ? 'line' : 'bobber'];
    const list = byId('shopList');
    let html = '';
    for(const it of arr){
      if(!Game.itemCanShow(it, loc.name)) continue;
      const isOwned = owned.indexOf(it.id) > -1;
      const isCur = cur === it.id;
      let stats = '';
      const s = [['Luck','luck'],['Str','str'],['Exp','exp'],['Att','att'],['Big','big'],['MaxW','maxW']];
      for(const [lbl,k] of s){
        const v = it[k];
        if(v === undefined) continue;
        stats += '<span>'+(v>0?'+':'')+v+' '+lbl+'</span> · ';
      }
      stats = stats.replace(/· $/,'');
      html += '<div class="shop-item">'+
        '<div class="si-ico">'+it.emoji+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div class="si-name">'+it.name+(isCur?' <span class="si-equip">(equipped)</span>':'')+'</div>'+
          '<div class="si-stats">'+stats+'</div>'+
          '<div class="si-meta">'+escapeHtml(it.src||'')+(it.unlock?' · '+it.unlock:'')+'</div>'+
        '</div>'+
        '<div class="si-right">'+
          (isOwned
            ? (isCur ? '<span class="si-owned">✔ Equipped</span>' : '<button class="btn-buy" onclick="UI.equip(\''+UI.ShopTab+'\',\''+it.id+'\')">Equip</button>')
            : (it.cost > G.save.coins
                ? '<span class="si-price" style="color:var(--red)">$'+fmt(it.cost)+'</span>'
                : '<span class="si-price">$'+fmt(it.cost)+'</span><button class="btn-buy" onclick="UI.buy(\''+UI.ShopTab+'\',\''+it.id+'\')">Buy</button>')
          )+
        '</div></div>';
    }
    list.innerHTML = html || '<div class="lb-empty">Nothing for sale here.</div>';
  },
  buy(kind, id){
    Game.buyGear(kind, id);
    if(kind === 'rods') UI.ShopTab = 'rods';
    UI.renderShop();
  },
  equip(kind, id){
    Game.equipGear(kind, id);
    UI.renderShop();
  },

  /* ---------- boats ---------- */
  openBoats(){
    UI.closeAllVeils();
    byId('veilBoats').classList.remove('hidden');
    UI.renderBoats();
  },
  refreshShop(){ UI.renderShop(); },
  refreshBoats(){ UI.renderBoats(); },
  renderBoats(){
    const list = byId('boatList');
    let html = '';
    for(const b of BOATS){
      const isOwned = G.save.ownedBoats.indexOf(b.id) > -1;
      const isCur = G.save.boat === b.id;
      const stats = 'Speed '+b.speed+' · Accel '+b.accel+' · Tough '+b.tough+' · Boost '+b.boost;
      html += '<div class="shop-item">'+
        '<div class="si-ico">'+b.emoji+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div class="si-name">'+b.name+(isCur?' <span class="si-equip">(active)</span>':'')+'</div>'+
          '<div class="si-stats">'+stats+'</div>'+
          '<div class="si-meta">'+escapeHtml(b.src||'Nessa\'s Waveworks')+'</div>'+
        '</div>'+
        '<div class="si-right">'+
          (isOwned
            ? (isCur ? '<span class="si-owned">✔ Active</span>' : '<button class="btn-buy" onclick="UI.setBoat(\''+b.id+'\')">Use</button>')
            : (b.cost == null
                ? (G.save.coins >= 50000
                    ? '<span class="si-price">$50k</span><button class="btn-buy" onclick="Game.boatRoulette()">Roulette</button>'
                    : '<span class="si-price" style="color:var(--red)">$50k</span><button class="btn-buy" disabled>Roulette</button>')
                : (b.cost > G.save.coins
                    ? '<span class="si-price" style="color:var(--red)">$'+fmt(b.cost)+'</span>'
                    : '<span class="si-price">$'+fmt(b.cost)+'</span><button class="btn-buy" onclick="Game.buyBoat(\''+b.id+'\')">Buy</button>'))
          )+
        '</div></div>';
    }
    html += '<div class="shop-item" style="opacity:.8">'+
      '<div class="si-ico">🎰</div>'+
      '<div style="flex:1"><div class="si-name">Boat Roulette</div><div class="si-meta">Spin for a 1% chance at the Stego III — $50,000 a spin.</div></div>'+
      '<div class="si-right"><button class="btn-buy" onclick="Game.boatRoulette()">🎰 Spin $50k</button></div></div>';
    list.innerHTML = html;
  },
  setBoat(id){ Game.equipBoat(id); UI.renderBoats(); },

  /* ---------- inventory ---------- */
  openInv(){
    UI.closeAllVeils();
    byId('veilInv').classList.remove('hidden');
    UI.refreshInv();
  },
  refreshInv(){
    const list = byId('invList');
    let total = 0;
    for(const c of G.save.caught) total += Game.fishValue(c);
    byId('invValue').textContent = 'Sell fish for coins!';
    byId('invCount').textContent = G.save.caught.length + ' fish · $'+fmt(total)+' total';
    byId('sellAllBtn').style.opacity = G.save.caught.length ? '1' : '.4';
    let html = '';
    G.save.caught.forEach((c,i) => {
      const col = (RARITIES[c.rar]||{}).color || '#7fe7ff';
      const pills = [];
      if(c.mut) pills.push('<span class="pill">'+escapeHtml(c.mut)+'</span>');
      if(c.huge) pills.push('<span class="pill pill-gold">HUGE</span>');
      if(c.tiny) pills.push('<span class="pill pill-cyan">TINY</span>');
      if(c.perfect) pills.push('<span class="pill pill-green">PERFECT</span>');
      html += '<div class="inv-item" style="border-color:'+col+'44">'+
        '<div class="si-ico inv-thumb">'+
          (c.img
            ? '<img src="'+c.img+'" loading="lazy" onerror="this.outerHTML=\'<div style=font-size:24px>🐟</div>\'">'
            : '<div style="font-size:24px">🐟</div>')+
        '</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div class="iv-name">'+escapeHtml(c.name)+'</div>'+
          '<div class="iv-tags"><span class="pill" style="color:'+col+';border-color:'+col+'99;background:'+col+'1f">'+escapeHtml(c.rar)+'</span>'+pills.join('')+'</div>'+
          '<div class="iv-meta">'+c.wt+' kg</div>'+
        '</div>'+
        '<span class="iv-price">$'+fmt(Game.fishValue(c))+'</span>'+
        '<button class="btn-sell" onclick="Game.sellFish('+i+')">Sell</button></div>';
    });
    list.innerHTML = html || '<div class="lb-empty">Nothing in the hold yet. Go fishing! 🎣</div>';
    const items = byId('invItems');
    let ih = '';
    for(const k in G.save.items){
      const n = G.save.items[k];
      if(!n) continue;
      const it = ITEMS[k];
      const isPet = k === 'autopet';
      if(isPet) continue;
      let act = '';
      if(k === 'speedP' || k === 'luckP') act = '<button onclick="Game.useItem(\''+k+'\')">Use</button>';
      else if(k === 'egg') act = '<button onclick="Game.useItem(\'egg\')">Hatch</button>';
      else if(k === 'scrap') act = '<button onclick="Game.sellItem(\'scrap\')">Sell $'+it.sell+'</button>';
      else act = '<button onclick="UI.openEnchant()">✨ Enchant</button>';
      ih += '<div class="item-card"><span class="ic-n">x'+n+'</span><div class="ic-ico">'+(it?it.emoji:'📦')+'</div><div class="ic-name">'+(it?it.name:k)+'</div>'+act+'</div>';
    }
    for(const p in G.save.autopets){
      if(!G.save.autopets[p]) continue;
      const ap = AUTOPETS[p];
      ih += '<div class="item-card" style="border-color:var(--gold)"><div class="ic-ico">'+(ap?ap.emoji:'🐾')+'</div><div class="ic-name">'+(ap?ap.name:p)+'</div><span style="font-size:9px;color:var(--gold);font-weight:800">AUTOPET</span></div>';
    }
    items.innerHTML = ih || '<div class="lb-empty">No items.</div>';
  },
  sellAll(){ Game.sellAll(); },

  /* ---------- quests & bounties ---------- */
  openQuests(){
    UI.closeAllVeils();
    byId('veilQuests').classList.remove('hidden');
    UI.refreshQuests();
  },
  refreshQuests(){
    const bl = byId('bountyList');
    let bh = '';
    if(!G.save.bounties.list.length){
      bh = '<div class="lb-empty">No bounties today.</div>';
    } else {
      G.save.bounties.list.forEach((b,i) => {
        const done = b.got >= b.count;
        bh += '<div class="bounty-item">'+
          '<div class="q-main"><div class="q-name">🎯 '+escapeHtml(b.name)+' <span class="q-desc">'+b.rar+'</span></div>'+
          '<div class="q-prog">'+Math.min(b.got,b.count)+' / '+b.count+' caught</div></div>'+
          '<div class="si-right">'+(b.claimed
            ? '<span class="q-done">✔ Claimed</span>'
            : (done ? '<button class="btn-claim" onclick="Game.claimBounty('+i+')">Claim $'+fmt(BOUNTY_REWARD[b.rar]||500)+'</button>'
                    : '<span class="si-price">$'+fmt(BOUNTY_REWARD[b.rar]||500)+'</span>'))+
          '</div></div>';
      });
    }
    bl.innerHTML = bh;
    const nextMid = new Date();
    nextMid.setHours(24,0,0,0);
    byId('bountyReset').textContent = 'resets in '+mmss((nextMid - Date.now())/1000);
    const ql = byId('questList');
    const qs = Game.activeQuests();
    let qh = '';
    if(!qs.length) qh = '<div class="lb-empty">All quests complete! You\'re a legend. 🏆</div>';
    for(const q of qs){
      const prog = Game.questProg(q);
      let done = true;
      for(let i = 0; i < q.req.length; i++){
        if(prog[i] < (q.req[i].count||1)){ done = false; break; }
      }
      const reqStr = q.req.map((r,i) => {
        const tgt = r.count||1;
        const cur = Math.min(prog[i], tgt);
        if(r.fish) return escapeHtml(r.fish)+' ('+cur+'/'+tgt+')';
        if(r.rarity) return r.rarity+' ('+cur+'/'+tgt+')';
        return 'Trash ('+cur+'/'+tgt+')';
      }).join(' · ');
      const rewards = [];
      if(q.coins) rewards.push('$'+fmt(q.coins));
      if(q.xp) rewards.push(fmt(q.xp)+' XP');
      if(q.title) rewards.push('🏅 '+q.title);
      if(q.bobber) rewards.push('🎣 '+q.bobber+' bobber');
      if(q.unlock === 'boat_galleon') rewards.push('🚤 Galleon boat');
      if(q.unlock === 'quest_alien') rewards.push('👽 Ethereal line');
      if(q.items) for(const k in q.items){ const it = ITEMS[k]; if(it) rewards.push(q.items[k]+'x '+it.name); }
      qh += '<div class="quest-item">'+
        '<div class="q-main">'+
          '<div class="q-name">'+q.emoji+' '+escapeHtml(q.name)+' <span class="q-desc">'+escapeHtml(q.giver)+'</span></div>'+
          '<div class="q-prog">'+reqStr+'</div>'+
          '<div class="progbar"><div style="width:'+Math.round((q.req.reduce((a,r,i)=>a+Math.min(prog[i],r.count||1),0))/(q.req.reduce((a,r)=>a+(r.count||1),0))*100)+'%"></div></div>'+
          '<div class="q-reward">'+rewards.join(' · ')+'</div>'+
        '</div>'+
        '<div class="si-right">'+(done
          ? '<button class="btn-claim" onclick="Game.claimQuest(\''+q.id+'\')">Claim</button>'
          : '<span class="q-done">In progress</span>')+'</div></div>';
    }
    ql.innerHTML = qh;
  },

  /* ---------- titles ---------- */
  openTitles(){
    UI.closeAllVeils();
    byId('veilTitles').classList.remove('hidden');
    const grid = byId('titleGrid');
    const earned = Object.keys(G.save.titles.done).length;
    byId('titleCount').textContent = earned + ' earned';
    let html = '';
    for(const t of TITLES){
      const is = !!G.save.titles.done[t.name];
      html += '<div class="title-card'+(is?'':' locked')+'">'+
        '<span class="t-title"'+(t.color?' style="color:'+escapeHtml(t.color)+'"':'')+'>'+escapeHtml(t.name)+'</span>'+
        '<span class="t-how">'+escapeHtml(t.how)+'</span>'+
        (is ? '<span class="t-earned">✔</span>' : '')+'</div>';
    }
    grid.innerHTML = html;
  },

  /* ---------- codes ---------- */
  openCodes(){
    UI.closeAllVeils();
    byId('veilCodes').classList.remove('hidden');
    UI.refreshCodes();
  },
  refreshCodes(){
    const list = byId('codeList');
    let html = '';
    for(const c of CODES){
      if(c.hidden) continue;
      const used = !!G.save.codes[c.code];
      html += '<div class="code-item">'+
        '<span class="c-code">'+escapeHtml(c.code)+'</span>'+
        '<span class="c-reward">'+escapeHtml(c.reward)+'</span>'+
        (used ? '<span class="c-used">✔ Used</span>' : (c.active ? '<span class="c-used" style="color:var(--green)">Active</span>' : '<span class="c-expired">Expired</span>'))+
        '</div>';
    }
    list.innerHTML = html;
  },
  redeemCode(){
    const inp = byId('codeInput');
    Game.redeemCode(inp.value);
    inp.value = '';
    UI.refreshCodes();
  },

  /* ---------- enchanting ---------- */
  openEnchant(){
    UI.closeAllVeils();
    byId('veilEnchant').classList.remove('hidden');
    UI.refreshEnchant();
  },
  refreshEnchant(){
    const cur = Game.curEnchant();
    const box = byId('enchantCur');
    if(cur){
      box.innerHTML = '<div class="e-name" style="color:'+(cur.rarity==='Legendary'?'var(--gold)':cur.rarity==='Epic'?'var(--purple)':'var(--cyan)')+'">'+cur.name+'</div>'+
        '<div class="e-desc">'+escapeHtml(cur.rarity)+' enchant'+(cur.fx?' · '+escapeHtml(cur.fx):'')+' · luck '+cur.luck+' · str '+cur.str+' · exp '+cur.exp+' · att '+cur.att+' · big '+cur.big+(cur.maxW?' · +'+cur.maxW+' maxW':'')+'</div>'+
        '<div class="e-pity">Pity: '+Math.min((G.save.pity||0),ENCHANT_PITY)+' / '+ENCHANT_PITY+'</div>';
    } else {
      box.innerHTML = '<div class="e-name" style="color:var(--dim)">No enchant</div><div class="e-desc">Spend a relic to enchant your rod.</div><div class="e-pity">Pity: '+Math.min((G.save.pity||0),ENCHANT_PITY)+' / '+ENCHANT_PITY+'</div>';
    }
    const rel = byId('enchantRelics');
    let html = '';
    for(const key of ['relicOld','relicMos','relicPow']){
      const n = G.save.items[key] || 0;
      const it = ITEMS[key];
      const pts = RELIC_POINTS[it.name] || 1;
      html += '<div class="enchant-row'+(n?'':' disabled')+'">'+
        '<div class="si-ico">'+it.emoji+'</div>'+
        '<div style="flex:1;min-width:0"><div class="er-name">'+it.name+'</div><div class="er-desc">'+pts+' pity point'+(pts>1?'s':'')+' per enchant</div></div>'+
        '<span class="er-n">x'+n+'</span>'+
        '<button class="btn-buy" onclick="Game.doEnchant(\''+key+'\')" '+(n?'':'disabled')+'>Enchant</button></div>';
    }
    rel.innerHTML = html;
    const log = byId('enchantLog');
    let lh = '';
    for(const e of G.save.enchantLog.slice(0,12)){
      lh += '<div class="el-item'+(e.rarity==='Legendary'?' legend':'')+'">✨ '+escapeHtml(e.rarity)+' · '+escapeHtml(e.name)+'</div>';
    }
    log.innerHTML = lh || '<div class="el-item">No enchants yet — visit the Altar with a relic!</div>';
  },

  /* ---------- board ---------- */
  openBoard(){
    UI.closeAllVeils();
    byId('veilBoard').classList.remove('hidden');
    Net.refresh();
    if(!G.save.name){
      Net.init();
    }
  },

  /* ---------- help / settings ---------- */
  openHelp(){
    UI.closeAllVeils();
    byId('veilHelp').classList.remove('hidden');
    byId('autoSellLbl').textContent = '🤖 Auto-Sell: ' + (G.save.autoSell ? 'ON' : 'OFF');
    byId('soundLbl').textContent = '🔊 Sound: ' + (G.save.sound ? 'ON' : 'OFF');
    const hasPet = G.save.autopets.vlad || G.save.autopets.levi;
    if(!hasPet) byId('autoSellLbl').textContent = '🤖 Auto-Sell: need an Autopet';
  },
  toggleAutoSell(){
    const hasPet = G.save.autopets.vlad || G.save.autopets.levi;
    if(!hasPet){ toast('You need an Autopet first — Vlad (MAKESHIP code) or hatch the Leviathan Egg!', 'bad'); return; }
    G.save.autoSell = !G.save.autoSell;
    Game.persist();
    byId('autoSellLbl').textContent = '🤖 Auto-Sell: ' + (G.save.autoSell ? 'ON' : 'OFF');
    toast('🤖 Auto-sell ' + (G.save.autoSell ? 'enabled' : 'disabled'), 'good');
  },
  toggleSound(){
    G.save.sound = !G.save.sound;
    Game.persist();
    byId('soundLbl').textContent = '🔊 Sound: ' + (G.save.sound ? 'ON' : 'OFF');
    if(G.save.sound) sfx(880,0.1,0.1,'sine');
  },
  resetGame(){
    if(!confirm('Reset ALL progress and remove your leaderboard entry? This cannot be undone!')) return;
    Net.removeMe().finally(() => {
      Game.resetSave();
      location.reload();
    });
  },

  closeAllVeils(){
    document.querySelectorAll('.veil').forEach(v => v.classList.add('hidden'));
  }
};
window.UI = UI;

Game.init();
