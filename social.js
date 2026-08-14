'use strict';
/* ============================================================
   ANGLER! — Friends & Private Messages (MantleDB polling)
   - Friends: symmetric buddy list stored in the cloud bucket.
   - DMs: per-sender outbox slots (`dms[from][to]`) so two users
     never write the same key. Inbox = everyone else's slot to me.
   - Unread DMs surface as a badge on the Friends chip + a popup.
   Made by Dave-VR
   ============================================================ */

const Social = (()=>{
  const SOC_URL='https://mantledb.sh/v2/fishvr/social';
  const POLL_MS=5000, DM_MAX=60;

  let cache={ friends:{}, seen:{} };
  let cloudF={}, cloudD={};
  let unread=0, notified={};
  let openWith=null, pollTimer=null, started=false;

  function pid(){
    let p=null;
    try{ p=localStorage.getItem('fishvr_pid'); }catch(e){}
    if(!p){ p='p'+Math.random().toString(36).slice(2,10); try{ localStorage.setItem('fishvr_pid',p); }catch(e){} }
    return p;
  }
  function loadCache(){
    try{ const raw=localStorage.getItem('fishvr_social'); if(raw) cache=JSON.parse(raw)||{friends:{},seen:{}}; }catch(e){}
  }
  function saveCache(){
    try{ localStorage.setItem('fishvr_social', JSON.stringify(cache)); }catch(e){}
  }
  async function getBucket(){
    try{
      const r=await fetch(SOC_URL,{cache:'no-store'});
      if(!r.ok) throw 0;
      const d=await r.json();
      return { f:(d&&d.friends)||{}, m:(d&&d.dms)||{} };
    }catch(e){ return null; }
  }
  async function writeBucket(f,m){
    try{
      await fetch(SOC_URL,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({friends:f,dms:m,updated:Date.now()})});
    }catch(e){}
  }

  /* ---------------- friends ---------------- */
  function friendsList(){
    const me=pid();
    const out=[];
    const seen={};
    for(const k in cloudF){
      if(k===me) continue;
      const f=cloudF[k]||{};
      for(const id in f){
        if(seen[id]) continue;
        seen[id]=1;
        out.push({ id, name:(f[id]&&f[id].name)||cache.friends[id]||'Angler', at:(f[id]&&f[id].at)||0 });
      }
    }
    for(const id in cache.friends){
      if(seen[id]) continue;
      out.push({ id, name:cache.friends[id], at:0 });
    }
    const scores=Net.getScores();
    out.forEach(fr=>{ const e=scores.find(s=>s.id===fr.id); if(e){ fr.lvl=e.level||1; fr.fish=e.fish||0; fr.score=e.lifetime||0; } });
    out.sort((a,b)=>-(a.score||0)+(b.score||0));
    return out;
  }
  async function addFriendByName(name){
    const q=String(name||'').trim();
    if(!q) return {ok:false, error:'Enter a name.'};
    if(q.toLowerCase()===(G.save.name||'').toLowerCase()) return {ok:false, error:'That\u2019s you!'};
    const scores=Net.getScores();
    let tgt=scores.find(s=>(s.name||'').toLowerCase()===q.toLowerCase());
    if(!tgt){
      const online=Multi.players||{};
      for(const id in online){ const p=online[id]; if((p.name||'').toLowerCase()===q.toLowerCase()){ tgt={id,name:p.name}; break; } }
    }
    if(!tgt) return {ok:false, error:'Not on the leaderboard yet.'};
    if(tgt.id===pid()) return {ok:false, error:'That\u2019s you!'};
    const me=pid();
    const b=await getBucket();
    const f=b?b.f:{}; const m=b?b.m:{};
    f[me]=f[me]||{}; f[tgt.id]=f[tgt.id]||{};
    const now=Date.now();
    f[me][tgt.id]={ name:(G.save.name||'Angler').slice(0,16), at:now };
    f[tgt.id][me]={ name:(G.save.name||'Angler').slice(0,16), at:now };
    cloudF=f; cloudD=m;
    await writeBucket(f,m);
    cache.friends[tgt.id]=tgt.name||q; saveCache();
    render(); refresh();
    return {ok:true};
  }
  async function removeFriend(id){
    const me=pid();
    const b=await getBucket();
    const f=b?b.f:{};
    if(f[me]) delete f[me][id];
    if(f[id]) delete f[id][me];
    cloudF=f;
    await writeBucket(f,b?b.m:{});
    delete cache.friends[id]; saveCache();
    render(); refresh();
  }

  /* ---------------- direct messages ---------------- */
  function thread(id){
    const me=pid();
    const msgs=[];
    const mine=(cloudD[me]&&cloudD[me][id])||[];
    const theirs=(cloudD[id]&&cloudD[id][me])||[];
    mine.forEach(x=>msgs.push({m:x.m, at:x.at, out:true}));
    theirs.forEach(x=>msgs.push({m:x.m, at:x.at, out:false}));
    msgs.sort((a,b)=>a.at-b.at);
    return msgs.slice(-80);
  }
  async function sendDm(id, text){
    const msg=String(text||'').trim();
    if(!msg) return {ok:false, error:'Type a message.'};
    const me=pid();
    const b=await getBucket();
    const f=b?b.f:{}; const m=b?b.m:{};
    m[me]=m[me]||{}; m[me][id]=m[me][id]||[];
    m[me][id].push({ m:msg.slice(0,240), at:Date.now() });
    m[me][id]=m[me][id].slice(-DM_MAX);
    cloudF=f; cloudD=m;
    await writeBucket(f,m);
    render();
    return {ok:true};
  }

  async function poll(){
    if(!G.save || !G.save.name) return;
    const b=await getBucket();
    if(!b) return;
    cloudF=b.f; cloudD=b.m;
    const me=pid();
    let unreadNow=0;
    const fresh=[];
    for(const fromPid in b.m){
      if(fromPid===me) continue;
      const inbox=b.m[fromPid]&&b.m[fromPid][me];
      if(!inbox||!inbox.length) continue;
      const base=cache.seen[fromPid];
      const latest=inbox[inbox.length-1].at;
      if(base===undefined){
        cache.seen[fromPid]=latest;
      }else{
        const unseen=inbox.filter(x=>x.at>base);
        if(unseen.length){
          unreadNow+=unseen.length;
          if(!notified[fromPid] || Date.now()-notified[fromPid]>8000){
            notified[fromPid]=Date.now();
            const sender=(cloudF[fromPid]&&cloudF[fromPid][me])||{};
            fresh.push({ from:fromPid, name:(sender.name||cache.friends[fromPid]||'Angler'), msg:unseen[unseen.length-1].m });
          }
        }
        if(latest>base) cache.seen[fromPid]=latest;
      }
    }
    unread=unreadNow;
    saveCache();
    updateBadge();
    fresh.forEach(popup);
  }
  function updateBadge(){
    const el=document.getElementById('dmUnread');
    if(!el) return;
    el.textContent=unread>99?'99+':String(unread);
    el.classList.toggle('hidden', unread===0);
    el.classList.toggle('show', unread>0);
  }
  function popup(p){
    const wrap=document.getElementById('dmPopup');
    if(!wrap) return;
    wrap.innerHTML='<div class="dm-pop">'+
      '<div class="dm-pop-head"><b>💬 '+escapeHtml(p.name)+'</b><button class="dm-pop-x" onclick="Social.dismissPopup()">✕</button></div>'+
      '<div class="dm-pop-msg">'+escapeHtml(p.msg.length>80?p.msg.slice(0,80)+'…':p.msg)+'</div>'+
      '<div class="dm-pop-acts"><button class="btn-primary btn-sm" onclick="Social.dismissPopup();Social.openDm(\''+p.from+'\',\''+escapeHtml(p.name).replace(/'/g,'\\\'')+'\')">💬 Reply</button></div>'+
      '</div>';
    wrap.classList.remove('hidden');
  }
  function dismissPopup(){
    const wrap=document.getElementById('dmPopup');
    if(wrap) wrap.classList.add('hidden');
  }

  /* ---------------- UI ---------------- */
  function openFriends(){
    refresh();
    render();
    const v=document.getElementById('veilFriends');
    if(v){ UI.closeAllVeils(); v.classList.remove('hidden'); }
  }
  function closeFriends(){ UI.close('veilFriends'); }
  function openDm(id, name){
    openWith={ id, name:String(name||cache.friends[id]||'Angler') };
    if(cache.seen[id]===undefined) cache.seen[id]=Date.now();
    saveCache(); updateBadge();
    render();
    const v=document.getElementById('veilDm');
    if(v){ UI.closeAllVeils(); v.classList.remove('hidden'); }
    const inp=document.getElementById('dmInput');
    if(inp) setTimeout(()=>inp.focus(), 60);
  }
  function closeDm(){ openWith=null; UI.close('veilDm'); }
  function sendFromInput(){
    const inp=document.getElementById('dmInput');
    if(!inp||!openWith) return;
    const t=inp.value;
    if(!t.trim()) return;
    inp.value='';
    sendDm(openWith.id, t);
  }
  async function addFromInput(){
    const inp=document.getElementById('friendAdd');
    const res=await addFriendByName(inp?inp.value:'');
    inp.value='';
    const st=document.getElementById('friendStatus');
    if(st){ st.textContent=res.ok?('✅ Friend added!'):('⚠️ '+res.error); st.classList.toggle('err',!res.ok); }
  }

  function render(){
    const wrap=document.getElementById('friendList');
    if(wrap){
      const list=friendsList();
      const online=(window.Multi&&Multi.players)||{};
      wrap.innerHTML=list.length?list.map(fr=>{
        const isOn=online[fr.id]?1:0;
        return '<div class="friend-row">'+
          '<span class="friend-dot '+(isOn?'on':'')+'"></span>'+
          '<span class="friend-name">'+escapeHtml(fr.name)+'<em>Lv'+(fr.lvl||1)+' · 🐟 '+fmt(fr.fish||0)+' · $'+fmt(fr.score||0)+(isOn?' · ● online':'')+'</em></span>'+
          '<span class="friend-acts">'+
          '<button class="btn-ghost btn-sm" onclick="Social.openDm(\''+fr.id+'\',\''+escapeHtml(fr.name).replace(/'/g,'\\\'')+'\')">💬</button>'+
          '<button class="btn-ghost btn-sm" onclick="Social.removeFriend(\''+fr.id+'\')">✕</button>'+
          '</span></div>';
      }).join(''):'<div class="lb-empty">No friends yet — add an angler by name above! 🌊</div>';
    }
    const dmLog=document.getElementById('dmLog');
    if(dmLog&&openWith){
      const t=thread(openWith.id);
      const me=G.save.name||'You';
      dmLog.innerHTML=t.length?t.map(x=>'<div class="dm-msg '+(x.out?'out':'in')+'"><span class="dm-name">'+(x.out?escapeHtml(me):escapeHtml(openWith.name))+'</span><span class="dm-text">'+escapeHtml(x.m)+'</span><span class="dm-time">'+clock(x.at)+'</span></div>').join(''):'<div class="lb-empty">Say hi! 👋</div>';
      dmLog.scrollTop=dmLog.scrollHeight;
      const h=document.getElementById('dmHead');
      if(h) h.textContent='💬 '+openWith.name;
    }
    updateBadge();
  }
  function clock(ts){
    const d=new Date(ts);
    const h=d.getHours(), m=('0'+d.getMinutes()).slice(-2);
    return h+':'+m;
  }

  async function refresh(){
    const b=await getBucket();
    if(b){ cloudF=b.f; cloudD=b.m; render(); }
  }

  function init(){
    loadCache();
    const me=pid();
    (async()=>{ const b=await getBucket(); if(b){ cloudF=b.f; cloudD=b.m; render(); poll(); } })();
    if(!pollTimer){
      pollTimer=setInterval(()=>poll(), POLL_MS);
      started=true;
    }
    const inp=document.getElementById('dmInput');
    if(inp) inp.addEventListener('keydown', e=>{ if(e.key==='Enter') sendFromInput(); });
    const add=document.getElementById('friendAdd');
    if(add) add.addEventListener('keydown', e=>{ if(e.key==='Enter') addFromInput(); });
  }

  function unreadCount(){ return unread; }
  function getOpen(){ return openWith; }
  function stopPolling(){ if(pollTimer){ clearInterval(pollTimer); pollTimer=null; } }

  return { init,refresh,render,poll,friendsList,addFriendByName,removeFriend,sendDm,openFriends,closeFriends,openDm,closeDm,sendFromInput,addFromInput,dismissPopup,unreadCount,getOpen,stopPolling };
})();
window.Social=Social;
