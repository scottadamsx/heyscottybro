import { gameHead, reward } from "./shell.js";
function stroop(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Color Match", "Tap the COLOUR the word is printed in \u2014 not what it says. 30 seconds", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Tap start</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="startb">Start</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" style="text-align:center"><div id="word" style="font-size:48px;font-weight:800;min-height:60px"></div><div id="btns" style="display:flex;gap:8px;justify-content:center;margin-top:14px"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),wordEl=document.getElementById('word'),btns=document.getElementById('btns');
    var COLS=[['Red','#c0392b'],['Green','#2f855a'],['Blue','#2b6cb0'],['Orange','#e07b3c']];
    var ink,score,left,iv,playing=false;
    function next(){var wi=Math.floor(Math.random()*4);ink=Math.floor(Math.random()*4);wordEl.textContent=COLS[wi][0].toUpperCase();wordEl.style.color=COLS[ink][1];}
    function render(){btns.innerHTML='';COLS.forEach(function(c,i){var b=document.createElement('button');b.textContent=c[0];b.addEventListener('click',function(){pick(i);});btns.appendChild(b);});}
    function pick(i){if(!playing)return;if(i===ink)score++;else score=Math.max(0,score-1);statusEl.textContent='Score: '+score+' \xB7 '+left+'s';next();}
    function start(){score=0;left=30;playing=true;done.disabled=true;render();next();statusEl.textContent='Score: 0 \xB7 30s';iv=setInterval(function(){left--;statusEl.textContent='Score: '+score+' \xB7 '+left+'s';if(left<=0){clearInterval(iv);playing=false;wordEl.textContent='Time!';wordEl.style.color='var(--fg)';statusEl.textContent='Final score: '+score;done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';}},1000);}
    document.getElementById('startb').addEventListener('click',start);
    done.addEventListener('click',function(){kiwiComplete(Math.min(12,Math.round(score/2)),score);});
  <\/script>
</div>`;
}
export {
  stroop
};
