import { gameHead, reward } from "./shell.js";
function aimtrainer(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Aim Trainer", "Click the targets as fast as you can. 20 seconds", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Tap start</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="startb">Start</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="arena" style="position:relative;width:300px;height:260px;background:var(--card);border-radius:12px;overflow:hidden"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),arena=document.getElementById('arena'),startB=document.getElementById('startb');
    var score,left,iv,dot,playing=false,cx=150,cy=130,tx=150,ty=130,slowUntil=0,raf=null;
    arena.style.cursor='none';
    var cross=document.createElement('div');cross.style.cssText='position:absolute;width:18px;height:18px;border:2px solid #2b2e22;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);z-index:5';arena.appendChild(cross);
    arena.addEventListener('mousemove',function(e){var r=arena.getBoundingClientRect();tx=e.clientX-r.left;ty=e.clientY-r.top;});
    function loop(){var slow=Date.now()<slowUntil,k=slow?0.12:1;cx+=(tx-cx)*k;cy+=(ty-cy)*k;cross.style.left=cx+'px';cross.style.top=cy+'px';cross.style.borderColor=slow?'#c0392b':'#2b2e22';raf=requestAnimationFrame(loop);}
    function overDot(){if(!dot)return false;var dl=parseFloat(dot.style.left),dt=parseFloat(dot.style.top),sz=parseFloat(dot.style.width);return cx>=dl&&cx<=dl+sz&&cy>=dt&&cy<=dt+sz;}
    function spawn(){if(dot)dot.remove();dot=document.createElement('div');var sz=30+Math.random()*16;dot.style.cssText='position:absolute;width:'+sz+'px;height:'+sz+'px;border-radius:50%;border:0;background:#d97757;pointer-events:none';dot.style.left=(Math.random()*(300-sz))+'px';dot.style.top=(Math.random()*(260-sz))+'px';arena.appendChild(dot);}
    arena.addEventListener('mousedown',function(){if(!playing)return;if(overDot()){score++;statusEl.textContent='Hits: '+score+' \xB7 '+left+'s';spawn();}else{slowUntil=Date.now()+3000;statusEl.textContent='Missed! Aim slowed for 3s \xB7 '+left+'s';}});
    function start(){score=0;left=20;playing=true;done.disabled=true;slowUntil=0;cx=tx=150;cy=ty=130;spawn();if(raf)cancelAnimationFrame(raf);loop();statusEl.textContent='Hits: 0 \xB7 20s';iv=setInterval(function(){left--;statusEl.textContent='Hits: '+score+' \xB7 '+left+'s';if(left<=0){clearInterval(iv);playing=false;if(dot)dot.remove();if(raf){cancelAnimationFrame(raf);raf=null;}statusEl.textContent='Final: '+score+' hits';done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';}},1000);}
    startB.addEventListener('click',start);
    done.addEventListener('click',function(){kiwiComplete(Math.min(12,Math.round(score/3)),score);});
  <\/script>
</div>`;
}
export {
  aimtrainer
};
