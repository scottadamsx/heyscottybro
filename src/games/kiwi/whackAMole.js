import { gameHead, reward } from "./shell.js";
function whack(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Whack-a-Mole", "Score 12 in 30 seconds", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Score: 0 \xB7 Time: 30</div>
  <div style="margin-top:10px;display:flex;gap:8px"><span class="k-chip" id="comboChip">Combo \xD70</span></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="go" class="k-press">Start</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div style="position:relative"><div id="ring" style="position:absolute;top:-14px;right:-14px;width:44px;height:44px;border-radius:50%;background:conic-gradient(var(--clay) 0deg,var(--line) 0deg);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--fg)"><span id="ringn">30</span></div><div id="grid" style="display:inline-grid;grid-template-columns:repeat(3,76px);gap:10px"></div></div></div>
  </div>
  <style>
    .hole{position:relative;width:76px;height:76px;border-radius:50%;cursor:pointer;border:0;overflow:hidden;
          background:radial-gradient(circle at 50% 62%, #6b4a30 0%, #4d3722 55%, #3a2a19 100%)}
    .hole::after{content:'';position:absolute;inset:5px;border-radius:50%;background:var(--card);box-shadow:inset 0 3px 6px rgba(0,0,0,.28)}
    .mole{position:absolute;left:50%;bottom:4px;transform:translate(-50%,90%);font-size:34px;line-height:1;transition:transform .18s cubic-bezier(.3,1.4,.4,1),opacity .15s;opacity:0;z-index:2}
    .hole.up .mole{transform:translate(-50%,0);opacity:1}
    .hole.miss{animation:kholemiss .3s ease-out}
    @keyframes kholemiss{0%,100%{filter:none}40%{filter:brightness(.7) saturate(1.4)}}
    @media (prefers-reduced-motion:reduce){ .mole{transition:none} .hole.miss{animation:none} }
  </style>
  <script>
    var grid=document.getElementById('grid'),statusEl=document.getElementById('status'),done=document.getElementById('done'),holes=[],moles=[],score,time,goal=12,combo=0,active,t1,t2,ring=document.getElementById('ring'),ringn=document.getElementById('ringn');
    var ROUND=30;
    for(var i=0;i<9;i++){(function(i){
      var b=document.createElement('button');b.className='hole';
      var m=document.createElement('span');m.className='mole';m.textContent='\u{1F439}';b.appendChild(m);
      b.addEventListener('click',function(){
        if(b.classList.contains('up')){b.classList.remove('up');score++;combo++;updCombo();upd();}
        else{combo=0;updCombo();b.classList.remove('miss');void b.offsetWidth;b.classList.add('miss');}
      });
      grid.appendChild(b);holes.push(b);
    })(i);}
    function updCombo(){document.getElementById('comboChip').textContent='Combo \xD7'+combo;}
    function updRing(){var pct=Math.max(0,time)/ROUND;ring.style.background='conic-gradient(var(--clay) '+(pct*360)+'deg, var(--line) 0deg)';ringn.textContent=Math.max(0,time);}
    function upd(){statusEl.textContent='Score: '+score+' \xB7 Time: '+time;if(score>=goal){end(true);}}
    function pop(){holes.forEach(function(h){h.classList.remove('up');});var n=Math.floor(Math.random()*9);holes[n].classList.add('up');}
    function start(){score=0;time=ROUND;combo=0;updCombo();done.disabled=true;upd();updRing();pop();t1=setInterval(pop,800);t2=setInterval(function(){time--;upd();updRing();if(time<=0)end(score>=goal);},1000);}
    function end(win){clearInterval(t1);clearInterval(t2);holes.forEach(function(h){h.classList.remove('up');});if(win){statusEl.textContent='Got '+score+'! Claim your reward.';done.disabled=false;}else{statusEl.textContent='Time! Score '+score+'. Press Start to retry.';}}
    document.getElementById('go').addEventListener('click',start);done.addEventListener('click',kiwiComplete);
  <\/script>
</div>`;
}
export {
  whack
};
