import { gameHead, reward } from "./shell.js";
function higherlower(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Higher or Lower", "Will the next card be higher or lower? Build a streak, cash out anytime", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Streak: 0 \xB7 best 0</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="hi">Higher</button> <button id="lo">Lower</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="card" style="font-size:46px;font-weight:700">?</div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),cardEl=document.getElementById('card');
    var RH=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],cur=Math.floor(Math.random()*13),streak=0,best=0,alive=true;
    function show(){cardEl.textContent=RH[cur];}
    function guess(hi){if(!alive)return;var nx=Math.floor(Math.random()*13);var ok=hi?(nx>=cur):(nx<=cur);cur=nx;show();if(ok){streak++;if(streak>best)best=streak;statusEl.textContent='Streak: '+streak+' \xB7 best '+best;done.disabled=false;done.textContent='Cash out ${reward(usd)} + bonus';}else{alive=false;statusEl.textContent='Missed at '+streak+'. Best '+best+'.';done.disabled=false;done.textContent='Claim ${reward(usd)}'+(best>0?' + bonus':'');}}
    document.getElementById('hi').addEventListener('click',function(){guess(true);});
    document.getElementById('lo').addEventListener('click',function(){guess(false);});
    done.addEventListener('click',function(){kiwiComplete(Math.min(15,best),best);});
    show();statusEl.textContent='Streak: 0 \xB7 best 0';
  <\/script>
</div>`;
}
export {
  higherlower
};
