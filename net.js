'use strict';
/* ============================================================
   FISH! — MantleDB cloud layer
   Free, no-login cloud storage via MantleDB (keyless JSON store).
   - Pick a name (no password) → your name + progress go on the
     global leaderboard, tracked live like the other IDLE games.
   - Save lives in localStorage; the leaderboard score syncs to the cloud.
   Made by Dave-VR
   ============================================================ */

const Net = (()=>{
  const LB_URL='https://mantledb.sh/v2/fishvr/leaderboard';
  const BNT_URL='https://mantledb.sh/v2/fishvr/bounties';

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

  return { init,refresh,submit,bump,throttledSubmit,onNameChange,render,removeMe,clearAll,getScores,
    loadBounties,saveBounties };
})();
window.Net=Net;
