import { gameHead, reward } from "./shell.js";
function simon(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Simon", "Repeat the sequence \u2014 reach level 8. Unlock 6 & 8 colours by playing.", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Level: 0 / 8</div>
  <div class="k-pips" id="pips" style="margin-top:8px"></div>
  <div style="margin-top:10px"><span class="k-chip" id="turnChip">\u{1F3AE} Your turn</span></div>
  <div style="margin-top:10px;display:flex;gap:6px"><button class="modeb" data-n="4">4 colours</button> <button class="modeb" data-n="6" id="m6">6 \u{1F512}</button> <button class="modeb" data-n="8" id="m8">8 \u{1F512}</button></div>
  <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button id="go" class="k-press">Start</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="pads" style="display:inline-grid;gap:10px"></div></div>
  </div>
  <style>
    .pad{width:84px;height:84px;border-radius:14px;border:0;opacity:.55;cursor:pointer;transition:opacity .12s,transform .1s,box-shadow .12s;
         box-shadow:inset 0 2px 3px rgba(255,255,255,.35),inset 0 -3px 6px rgba(0,0,0,.18),0 4px 10px -6px rgba(0,0,0,.4)}
    .pad.on{opacity:1;transform:scale(1.07);box-shadow:0 0 0 6px rgba(255,255,255,.22),inset 0 2px 3px rgba(255,255,255,.5),0 6px 16px -6px rgba(0,0,0,.5)}
    .pad:active{transform:scale(.95)}
    .modeb{font-size:12px;padding:4px 8px;border:1px solid var(--line,#cdbfa6);border-radius:8px;background:var(--card,#fff);cursor:pointer}
    .modeb.sel{background:var(--tint,#e7efd6);border-color:var(--clay,#c39a68)}
    .modeb:disabled{opacity:.4;cursor:not-allowed}
    @media (prefers-reduced-motion:reduce){ .pad{transition:none} .pad.on{transform:none} }
  </style>
  <script>
    var COL=['#8bc34a','#e0935b','#6fcf97','#d8a657','#7e9cff','#d77fb3','#5ec8c8','#caa23a'];
    var pads=document.getElementById('pads'),statusEl=document.getElementById('status'),done=document.getElementById('done'),pipsEl=document.getElementById('pips'),turnChip=document.getElementById('turnChip');
    var seq,step,btns=[],goal=8,playing,N=4;
    function lsg(k){try{return localStorage.getItem(k);}catch(e){return null;}}
    function lss(k,v){try{localStorage.setItem(k,v);}catch(e){}}
    var u6=lsg('kiwi.simon.u6')==='1',u8=lsg('kiwi.simon.u8')==='1';
    var m6=document.getElementById('m6'),m8=document.getElementById('m8');
    function refreshLocks(){m6.disabled=!u6;if(u6)m6.textContent='6';m8.disabled=!u8;if(u8)m8.textContent='8';}
    refreshLocks();
    function buildPips(){pipsEl.innerHTML='';for(var i=0;i<goal;i++){var s=document.createElement('span');s.className='k-pip';pipsEl.appendChild(s);}}
    function updPips(lvl){var kids=pipsEl.children;for(var i=0;i<kids.length;i++)kids[i].classList.toggle('k-pip-win',i<lvl);}
    buildPips();
    function setTurn(watch){turnChip.textContent=watch?'\u{1F440} Watch':'\u{1F3AE} Your turn';}
    function buildPads(){pads.innerHTML='';btns=[];pads.style.gridTemplateColumns='repeat('+(N<=4?2:N<=6?3:4)+',84px)';for(var i=0;i<N;i++){(function(i){var b=document.createElement('button');b.className='pad';b.style.background='radial-gradient(circle at 32% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 55%), '+COL[i];b.addEventListener('click',function(){press(i);});pads.appendChild(b);btns.push(b);})(i);}}
    function selMode(n){N=n;[].forEach.call(document.querySelectorAll('.modeb'),function(b){b.classList.toggle('sel',+b.getAttribute('data-n')===n);});buildPads();statusEl.textContent='Level: 0 / '+goal;}
    [].forEach.call(document.querySelectorAll('.modeb'),function(b){b.addEventListener('click',function(){if(b.disabled)return;selMode(+b.getAttribute('data-n'));});});
    // Speed ramps down (faster) as the sequence grows \u2014 floors so it never becomes unfair.
    function onMs(){return Math.max(160, 360 - seq.length*16);}
    function gapMs(){return Math.max(70, 160 - seq.length*7);}
    function flash(i,cb){btns[i].classList.add('on');setTimeout(function(){btns[i].classList.remove('on');if(cb)setTimeout(cb,gapMs());},onMs());}
    function play(){playing=false;setTurn(true);var k=0;(function next(){if(k>=seq.length){playing=true;step=0;setTurn(false);return;}flash(seq[k],function(){k++;next();});})();}
    function start(){seq=[];step=0;done.disabled=true;add();}
    function add(){seq.push(Math.floor(Math.random()*N));statusEl.textContent='Level: '+seq.length+' / '+goal;updPips(seq.length-1);play();}
    function press(i){if(!playing)return;flash(i);if(i!==seq[step]){statusEl.textContent='Wrong! Reached level '+(seq.length-1)+'. Press Start to retry.';playing=false;setTurn(true);return;}step++;if(step===seq.length){playing=false;setTurn(true);if(seq.length>=goal){done.disabled=false;if(N===4&&!u6){u6=true;lss('kiwi.simon.u6','1');refreshLocks();statusEl.textContent='Level '+seq.length+'! 6-colour mode unlocked \u2014 claim or keep going.';}else if(N===6&&!u8){u8=true;lss('kiwi.simon.u8','1');refreshLocks();statusEl.textContent='Level '+seq.length+'! 8-colour mode unlocked \u2014 claim or keep going.';}else{statusEl.textContent='Level '+seq.length+'! Claim, or keep going.';}}setTimeout(add,600);}}
    selMode(4);
    document.getElementById('go').addEventListener('click',start);done.addEventListener('click',kiwiComplete);
  <\/script>
</div>`;
}
export {
  simon
};
