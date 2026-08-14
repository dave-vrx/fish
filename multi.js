'use strict';
/* ============================================================
   FISH! — Multiplayer & Harbor Chat (MantleDB polling)
   - Presence: every angler's boat position/heading syncs ~1.2s,
     smoothed client-side so everyone sails together in real time.
   - Chat: global harbor chat; the last message shows as a bubble
     above each angler's nameplate.
   - No server needed — works on GitHub Pages via the free
     MantleDB cloud store.
   ============================================================ */

const Multi = (()=>{
  const PRES_URL='https://mantledb.sh/v2/fishvr/presence';
  const CHAT_URL='https://mantledb.sh/v2/fishvr/chat';
  const COLORS=['#ff5d6c','#ffd166','#46e0a0','#3ee0ff','#c58cff','#ff9de8','#ff8c00','#ff6b9d','#b6ff5e','#7fe7ff'];
  const PRES_INT=1200, CHAT_INT=1400, STALE=22000, BUBBLE_MS=7000;

  const players={};            // id -> remote angler
  let myId='', myColorVal='';
  let chatLog=[];
  let lastSend=0, unread=0, open=false, started=false, online=0, ready=false, sessionHeard=false;
  let myBubble={text:null, at:0};

  function pid(){
    if(!myId){
      let p=null;
      try{ p=localStorage.getItem('fishvr_pid'); }catch(e){}
      myId = p || ('p'+Math.random().toString(36).slice(2,10));
      try{ localStorage.setItem('fishvr_pid', myId); }catch(e){}
    }
    return myId;
  }
  function colorOf(id){
    let h=0;
    for(let i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))>>>0;
    return COLORS[h%COLORS.length];
  }
  function myColor(){ if(!myColorVal) myColorVal=colorOf(pid()); return myColorVal; }

  /* ---------------- presence ---------------- */
  async function sendPos(){
    if(!G.save.name || !started) return;
    const now=Date.now();
    try{
      let arr=[];
      try{
        const r=await fetch(PRES_URL,{cache:'no-store'});
        if(r.ok){ const d=await r.json(); if(d&&Array.isArray(d.players)) arr=d.players; }
      }catch(e){}
      arr=arr.filter(p=>p&&p.id&&p.id!==pid()&&(now-(p.at||0))<STALE).slice(0,48);
      arr.push({ id:pid(), name:(G.save.name||'Angler').slice(0,16), color:myColor(),
        lvl:G.save.level||1, x:Math.round(G.boat.x), y:Math.round(G.boat.y),
        head:Math.round(G.boat.head*100)/100, boat:save.boat, title:(activeTitle()||''), beta:!!(save.badges&&save.badges.betaTester), at:now });
      await fetch(PRES_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({players:arr,updated:now})});
    }catch(e){}
  }

  async function fetchPlayers(){
    const now=Date.now();
    try{
      const r=await fetch(PRES_URL,{cache:'no-store'});
      if(!r.ok) return;
      const d=await r.json();
      const arr=(d&&Array.isArray(d.players))?d.players:[];
      for(const p of arr){
        if(!p||!p.id||p.id===pid()) continue;
        if(now-(p.at||0)>STALE) continue;
        let pl=players[p.id];
        if(!pl){
          pl={ id:p.id, name:p.name||'Angler', color:p.color||colorOf(p.id), lvl:p.lvl||1, boat:p.boat||'surf',
            title:p.title||'', beta:!!p.beta, x:+(p.x||0), y:+(p.y||0), head:+(p.head||0),
            tx:+(p.x||0), ty:+(p.y||0), th:+(p.head||0),
            chat:null, chatAt:0, at:now };
          players[p.id]=pl;
        }
        pl.tx=+(p.x||pl.tx); pl.ty=+(p.y||pl.ty); pl.th=+(p.head||pl.th);
        pl.name=p.name||pl.name; pl.lvl=p.lvl||pl.lvl; pl.boat=p.boat||pl.boat;
        pl.title=p.title||pl.title; pl.beta=!!p.beta; pl.color=p.color||pl.color; pl.at=now;
      }
      for(const id in players){ if(now-players[id].at>STALE+5000) delete players[id]; }
      online=Object.keys(players).length;
      statusText();
      if(online>0 && !sessionHeard && G.save.name){
        sessionHeard=true;
        toast('👋 '+online+' angler'+(online>1?'s':'')+' sailing near you!','gold');
      }
    }catch(e){}
  }

  /* ---------------- chat ---------------- */
  async function fetchChat(){
    try{
      const r=await fetch(CHAT_URL,{cache:'no-store'});
      if(!r.ok) return;
      ready=true; statusText();
      const d=await r.json();
      const arr=(d&&Array.isArray(d.messages))?d.messages:[];
      const seen={}; chatLog.forEach(m=>seen[m.id]=1);
      const now=Date.now();
      for(const m of arr){
        if(!m||!m.id||seen[m.id]) continue;
        if(now-(m.at||0)>90000) continue;
        seen[m.id]=1;
        pushChat(m);
        if(!open) unread++;
      }
      if(chatLog.length>100) chatLog=chatLog.slice(-100);
      renderLog(); badge();
    }catch(e){}
  }

  function sendChat(text){
    text=String(text||'').replace(/\s+/g,' ').trim().slice(0,120);
    if(!text) return;
    if(!G.save.name){ toast('Set your name first!','bad'); return; }
    const now=Date.now();
    if(now-lastSend<2000){ toast('A little slower, angler…','bad'); return; }
    lastSend=now;
    const msg={ id:pid()+':'+now+':'+Math.floor(Math.random()*1e6),
      name:(G.save.name||'Angler').slice(0,16), color:myColor(),
      lvl:G.save.level||1, text, at:now };
    (async()=>{
      try{
        let arr=[];
        try{
          const r=await fetch(CHAT_URL,{cache:'no-store'});
          if(r.ok){ const d=await r.json(); if(d&&Array.isArray(d.messages)) arr=d.messages; }
        }catch(e){}
        arr=arr.filter(m=>m&&m.id&&m.id!==msg.id).slice(-59);
        arr.push(msg);
        await fetch(CHAT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:arr,updated:now})});
      }catch(e){}
    })();
    pushChat(msg);
  }

  function pushChat(m){
    chatLog.push(m);
    if(chatLog.length>100) chatLog.shift();
    renderLog();
    const at=Date.now();
    const who=(m.id||'').split(':')[0];
    if(who===pid()){ myBubble={text:m.text, at}; }
    else{
      const pl=players[who];
      if(pl){ pl.chat=m.text; pl.chatAt=at; }
    }
  }

  /* ---------------- UI ---------------- */
  function renderLog(){
    const el=byId('chatLog'); if(!el) return;
    el.innerHTML=chatLog.map(m=>{
      const mine=(m.id||'').split(':')[0]===pid();
      return '<div class="chat-row'+(mine?' mine':'')+'">'+
        '<span class="chat-name" style="color:'+escapeHtml(m.color||'#fff')+'">'+escapeHtml(m.name||'?')+'</span> '+
        '<span class="chat-text">'+escapeHtml(m.text)+'</span></div>';
    }).join('');
    el.scrollTop=el.scrollHeight;
  }
  function statusText(){
    const st=byId('chatStatus'); if(!st) return;
    st.textContent=ready ? ('🟢 '+online+' angler'+(online===1?'':'s')+' online') : '🌐 connecting…';
    const o=byId('chatOnline'); if(!o) return;
    o.textContent=ready?online:0;
    o.classList.toggle('hidden', !ready);
    o.classList.toggle('zero', ready && online===0);
  }
  function badge(){
    const b=byId('chatUnread'); if(!b) return;
    b.textContent=unread>9?'9+':unread;
    b.classList.toggle('hidden', unread===0);
  }
  function toggle(force){
    open = force!==undefined ? !!force : !open;
    const pnl=byId('chatPanel');
    if(!pnl) return;
    pnl.classList.toggle('hidden', !open);
    if(open){
      unread=0; badge();
      renderLog(); statusText();
      const inp=byId('chatMsg');
      if(inp) setTimeout(()=>inp.focus(),60);
    }else{
      const inp=byId('chatMsg'); if(inp) inp.blur();
    }
  }

  /* ---------------- per-frame ---------------- */
  function tick(dt){
    if(!started) return;
    for(const id in players){
      const p=players[id];
      const dx=p.tx-p.x, dy=p.ty-p.y;
      const dist=Math.hypot(dx,dy);
      if(dist > 1){
        const catchSpeed=Math.max(140, dist*2.2);
        const move=Math.min(dist, catchSpeed*dt);
        p.x+=(dx/dist)*move;
        p.y+=(dy/dist)*move;
      }
      let dh=p.th-p.head;
      while(dh>Math.PI) dh-=Math.PI*2;
      while(dh<-Math.PI) dh+=Math.PI*2;
      p.head+=dh*Math.min(1, dt*10);
    }
    const now=Date.now();
    if(myBubble.text && now-myBubble.at>BUBBLE_MS) myBubble={text:null,at:0};
    for(const id in players){
      const p=players[id];
      if(p.chat && now-p.chatAt>BUBBLE_MS) p.chat=null;
    }
  }

  /* ---------------- canvas ---------------- */
  function roundRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function drawRemoteBoat(p){
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.head - Math.PI/2);
    ctx.fillStyle='rgba(0,10,20,.18)';
    ctx.beginPath(); ctx.ellipse(2,3,14,9,0,0,Math.PI*2); ctx.fill();
    drawBoatSprite(ctx, p.boat, 0.85);
    ctx.fillStyle=p.color||'#fff';
    ctx.beginPath(); ctx.moveTo(-14,-5); ctx.lineTo(-11,0); ctx.lineTo(-14,5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawTag(sx,sy,name,lvl,color,chat,title,beta){
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(chat){
      const maxW=200;
      ctx.font='600 11px system-ui,sans-serif';
      const words=String(chat).split(/\s+/);
      const lines=[]; let line='';
      const breakWord=w=>{
        if(ctx.measureText(w).width<=maxW) return [w];
        const out=[]; let cur='';
        for(const ch2 of w){
          if(cur && ctx.measureText(cur+ch2).width>maxW){ out.push(cur); cur=ch2; }
          else cur+=ch2;
        }
        if(cur) out.push(cur);
        return out;
      };
      words.forEach(w=>{
        breakWord(w).forEach((chunk,ci)=>{
          const t=line?line+' '+chunk:chunk;
          if(line && ctx.measureText(t).width>maxW){ lines.push(line); line=chunk; }
          else line=t;
        });
      });
      if(line) lines.push(line);
      const lh=13;
      const cw=Math.max(40, Math.min(210, Math.max(...lines.map(l=>ctx.measureText(l).width))+16));
      const ch=lines.length*lh+12;
      const cx=sx, cy=sy-96;
      ctx.fillStyle='rgba(6,20,34,.85)';
      roundRect(cx-cw/2,cy-ch,cw,ch,9); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-5,cy+ch-1); ctx.lineTo(cx+5,cy+ch-1); ctx.lineTo(cx,cy+ch+6); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#eaf6ff';
      const padTop=(ch-lines.length*lh)/2;
      lines.forEach((l,i)=>ctx.fillText(l, cx, cy-ch+padTop+lh/2+i*lh));
    }
    if(title){
      ctx.font='700 7.5px system-ui,sans-serif';
      const tw=ctx.measureText(title).width+13;
      const tx=sx-tw/2, ty=sy-85;
      ctx.fillStyle='rgba(12,8,0,.92)';
      roundRect(tx,ty,tw,13,6.5); ctx.fill();
      ctx.strokeStyle='#ffd166'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#ffd166';
      ctx.fillText(title, sx, ty+6.5);
    }
    const w=Math.max(34, String(name).length*6.5+18);
    const x=sx-w/2, y=sy-66;
    ctx.fillStyle='rgba(6,20,34,.85)';
    roundRect(x,y,w,20,10); ctx.fill();
    ctx.strokeStyle=color||'#fff'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#eaf6ff'; ctx.font='700 10.5px system-ui,sans-serif';
    ctx.fillText(String(name).slice(0,16), sx, y+8);
    ctx.fillStyle=color||'#fff'; ctx.font='800 8.5px system-ui,sans-serif';
    ctx.fillText('Lv'+(lvl||1), sx, y+15.5);
    if(beta){
      ctx.fillStyle='#ffd166'; ctx.strokeStyle='#fff0a0'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(x+w-2,y+2,6,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#4b2a00'; ctx.font='900 8px system-ui,sans-serif'; ctx.fillText('✦',x+w-2,y+2.3);
    }
    ctx.restore();
  }

  function draw(){
    if(!started) return;
    const z=G.cam.zoom;
    const halfX=W/(2*z), halfY=H/(2*z);
    ctx.save();
    ctx.scale(z,z);
    ctx.translate(-G.cam.x+halfX, -G.cam.y+halfY);
    for(const id in players){
      const p=players[id];
      if(p.x<G.cam.x-halfX-40||p.x>G.cam.x+halfX+40||p.y<G.cam.y-halfY-40||p.y>G.cam.y+halfY+40) continue;
      drawRemoteBoat(p);
    }
    ctx.restore();
    const now=Date.now();
    for(const id in players){
      const p=players[id];
      const sx=(p.x-G.cam.x)*z+W/2, sy=(p.y-G.cam.y)*z+H/2;
      if(sx<-90||sx>W+90||sy<-160||sy>H+70) continue;
      drawTag(sx,sy,p.name,p.lvl,p.color, (now-p.chatAt<BUBBLE_MS)?p.chat:null, p.title, p.beta);
    }
    if(G.save.name){
      const mx=(G.boat.x-G.cam.x)*z+W/2, my=(G.boat.y-G.cam.y)*z+H/2;
      if(mx>-90&&mx<W+90&&my>-160&&my<H+70){
        drawTag(mx,my,G.save.name,G.save.level,myColor(), (now-myBubble.at<BUBBLE_MS)?myBubble.text:null, activeTitle(), !!(G.save.badges&&G.save.badges.betaTester));
      }
    }
  }

  /* ---------------- start ---------------- */
  function start(){
    if(started) return;
    started=true;
    pid(); myColor();
    const pulse=()=>{ sendPos(); fetchPlayers(); fetchChat(); };
    pulse();
    setInterval(pulse, PRES_INT);
    setInterval(fetchChat, CHAT_INT);
    const send=byId('chatSend');
    if(send) send.addEventListener('click', ()=>{ const i=byId('chatMsg'); sendChat(i?i.value:''); if(i) i.value=''; });
    const inp=byId('chatMsg');
    if(inp) inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ sendChat(inp.value); inp.value=''; } });
    const closeBtn=byId('chatClose');
    if(closeBtn) closeBtn.addEventListener('click', ()=>toggle(false));
  }
  function init(){ start(); }

  return { init, start, toggle, send:sendChat, tick, draw,
    get online(){ return online; }, get players(){ return players; }, get open(){ return open; } };
})();
window.Multi=Multi;
