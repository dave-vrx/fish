'use strict';
/* ============================================================
   ANGLER! — MantleDB cloud layer
   Free, no-login cloud storage via MantleDB (keyless JSON store).
   - Pick a name (no password) → your name + progress go on the
     global leaderboard, tracked live like the other IDLE games.
   - Save lives in localStorage; the leaderboard score syncs to the cloud.
   Made by Dave-VR
   ============================================================ */

const Net = (()=>{
  const LB_URL='https://mantledb.sh/v2/fishvr/leaderboard';
  const BNT_URL='https://mantledb.sh/v2/fishvr/bounties';
  const LEVI_URL='https://mantledb.sh/v2/fishvr/leviathan';
  const LEVI_BASE_HP=16, LEVI_HP_PER_HUNTER=14, LEVI_MAX_HUNTERS=8;

  let scores=[];
  let myId='';
  let initDone=false;
  let lastSubmit=0;
  let intervalStarted=false;

  function getMyId(){
    if(!myId){
      let pid=null;
      try{ pid=localStorage.getItem('fishvr_pid'); }catch(e){}
      myId=pid||('p'+Math.random().toString(36).slice(2,10));
      try{ localStorage.setItem('fishvr_pid',myId); }catch(e){}
    }
    return myId;
  }

  function myEntry(){
    const s=G.save;
    const stats=s.stats||{};
    const titles=s.titles&&s.titles.done?Object.keys(s.titles.done).length:0;
    return {
      id:getMyId(),
      name:(s.name||'Angler').slice(0,16),
      coins:Math.floor(s.coins||0),
      lifetime:Math.floor(s.lifetime||0),
      fish:stats.totalCaught||0,
      level:s.level||1,
      xp:s.xp||0,
      discovered:Object.keys(s.index||{}).length,
      totalFish:totalFishCount(),
      titles:titles,
      upd:Date.now()
    };
  }
  function totalFishCount(){
    let n=0; for(const k in FISH_DATA) n+=FISH_DATA[k].length;
    return n;
  }

  async function fetchBoard(){
    try{
      const r=await fetch(LB_URL,{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const data=await r.json();
      scores=(data&&Array.isArray(data.scores))?data.scores:[];
      render();
      return true;
    }catch(e){ render(); return false; }
  }

  function submit(force){
    if(!initDone||!G.save.name) return;
    const now=Date.now();
    if(!force&&now-lastSubmit<15000) return;
    lastSubmit=now;
    const entry=myEntry();
    const arr=scores.filter(s=>s.id!==entry.id);
    arr.push(entry);
    arr.sort((a,b)=>b.lifetime-a.lifetime);
    scores=arr.slice(0,300);
    fetch(LB_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({scores:scores,updated:now})
    }).catch(()=>{});
    render();
  }

  let lastVal=0;
  function throttledSubmit(){
    if(!initDone||!G.save.name) return;
    const v=G.save.lifetime||0;
    const c=G.save.coins||0;
    if(v>lastVal*1.001+5||v<lastVal*0.5){
      lastVal=v; submit(false);
    }
  }
  function bump(){ lastVal=G.save.lifetime||0; submit(true); }
  function onNameChange(){ lastVal=-1; submit(true); }

  async function removeMe(){
    try{
      const id=getMyId();
      const r=await fetch(LB_URL,{cache:'no-store'});
      if(!r.ok) return false;
      const data=await r.json();
      const arr=(data&&Array.isArray(data.scores))?data.scores:[];
      const filtered=arr.filter(s=>s.id!==id);
      if(filtered.length<arr.length){
        const p=await fetch(LB_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scores:filtered,updated:Date.now()})});
        if(!p.ok) return false;
        scores=filtered; render();
      }
      return true;
    }catch(e){ return false; }
  }

  async function clearAll(){
    try{
      const r=await fetch(LB_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scores:[],updated:Date.now()})});
      if(!r.ok) return false;
      scores=[]; render(); return true;
    }catch(e){ return false; }
  }

  function render(){
    const list=document.getElementById('lbList');
    if(!list) return;
    if(!scores.length){
      list.innerHTML='<div class="lb-empty">No fish caught yet — be the first! 🎣</div>';
      const st=document.getElementById('lbStatus');
      if(st) st.textContent='🌐 Be the first on the board!';
      return;
    }
    const me=myEntry();
    let myRank=-1;
    const medals=['🥇','🥈','🥉'];
    let html='';
    scores.slice(0,100).forEach((s,i)=>{
      if(s.id===me.id) myRank=i+1;
      const pct=Math.round((s.discovered||0)/(totalFishCount()||1)*100);
      html+='<div class="lb-row'+(s.id===me.id?' me':'')+'">'+
        '<span class="lb-rank '+(i===0?'g1':i===1?'g2':i===2?'g3':'')+'">'+(i<3?medals[i]:'#'+(i+1))+'</span>'+
        '<span class="lb-name">'+escapeHtml(s.name||'?')+(s.id===me.id?'<span class="me-tag">YOU</span>':'')+'</span>'+
        '<span class="lb-val"><span class="lv">Lv'+(s.level||1)+' · 🐟 '+fmt(s.fish||0)+' · 📖 '+pct+'%</span>'+
        '<div class="pts">$'+fmt(s.lifetime||0)+'</div></span></div>';
    });
    list.innerHTML=html;
    if(myRank<=0) myRank=scores.findIndex(s=>s.id===me.id)+1;
    if(myRank<=0) myRank=scores.length+1;
    const st=document.getElementById('lbStatus');
    if(st) st.textContent='🌐 You are #'+myRank+' of '+scores.length+' · syncs every 20s';
  }

  function refresh(){ fetchBoard(); }
  function getScores(){ return scores.slice(); }

  function init(){
    getMyId();
    initDone=true;
    fetchBoard();
    if(!intervalStarted){
      intervalStarted=true;
      setInterval(()=>throttledSubmit(),20000);
    }
  }

  /* daily bounties — shared, seeded by date, stored in MantleDB */
  async function loadBounties(){
    try{
      const r=await fetch(BNT_URL,{cache:'no-store'});
      if(!r.ok) throw 0;
      const d=await r.json();
      return d;
    }catch(e){ return null; }
  }
  async function saveBounties(obj){
    try{
      await fetch(BNT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
    }catch(e){}
  }

  /* Hourly Baby Leviathan hunt. MantleDB is a simple JSON store, so clients
     continuously refresh the shared health and write their completed catch. */
  function leviWindow(){
    const now=new Date();
    const start=new Date(now);
    start.setUTCMinutes(0,0,0);
    return { key:start.toISOString().slice(0,13), start, end:new Date(start.getTime()+600000), active:now-start<600000 };
  }
  function huntHp(hunters){ return LEVI_BASE_HP+LEVI_HP_PER_HUNTER*Math.max(1,Math.min(LEVI_MAX_HUNTERS,hunters||1)); }
  function freshLevi(w,hunters){
    const n=Math.max(1,Math.min(LEVI_MAX_HUNTERS,hunters||1));
    const hp=huntHp(n);
    return {hour:w.key,hp,maxHp:hp,hunters:n,winner:null,at:Date.now()};
  }
  async function refreshLeviathan(hunters){
    const w=leviWindow();
    if(!w.active){ G.state.levi=null; return null; }
    try{
      const r=await fetch(LEVI_URL,{cache:'no-store'});
      const d=r.ok?await r.json():null;
      G.state.levi=(d&&d.hour===w.key)?d:freshLevi(w,hunters);
    }catch(e){
      if(!G.state.levi||G.state.levi.hour!==w.key) G.state.levi=freshLevi(w,hunters);
    }
    return G.state.levi;
  }
  async function damageLeviathan(hunters){
    const w=leviWindow();
    if(!w.active||!G.save.name) return {ok:false};
    try{
      const r=await fetch(LEVI_URL,{cache:'no-store'});
      const d=r.ok?await r.json():null;
      const event=(d&&d.hour===w.key)?d:freshLevi(w,hunters);
      if(event.hp<=0){ G.state.levi=event; return {ok:false,finished:true}; }
      /* The target only grows when new anglers arrive. It never shrinks,
         so someone leaving cannot make the hunt suddenly unwinnable. */
      const active=Math.max(1,Math.min(LEVI_MAX_HUNTERS,hunters||1));
      const recorded=Math.max(1,event.hunters||1);
      if(active>recorded){
        const extra=huntHp(active)-huntHp(recorded);
        event.hp+=extra; event.maxHp+=extra; event.hunters=active;
      }
      event.hp=Math.max(0,(event.hp||100)-1);
      let won=false;
      if(event.hp===0){ event.winner={id:getMyId(),name:(G.save.name||'Angler').slice(0,16),at:Date.now()}; won=true; }
      event.at=Date.now();
      await fetch(LEVI_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});
      /* Confirm the winner after write, so an overlapping catch normally
         settles on the final shared record rather than paying both clients. */
      let settled=event;
      try{
        const check=await fetch(LEVI_URL,{cache:'no-store'});
        if(check.ok) settled=await check.json();
      }catch(e){}
      G.state.levi=settled;
      won=!!(won&&settled&&settled.hour===w.key&&settled.winner&&settled.winner.id===getMyId());
      return {ok:true,won,event:settled};
    }catch(e){ return {ok:false}; }
  }

  return { init,refresh,submit,bump,throttledSubmit,onNameChange,render,removeMe,clearAll,getScores,
    loadBounties,saveBounties,refreshLeviathan,damageLeviathan };
})();
window.Net=Net;
