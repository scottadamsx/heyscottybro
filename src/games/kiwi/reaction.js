import { gameHead, reward } from "./shell.js";
function reaction(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Reaction Test", "Click the instant it turns green \u2014 five rounds", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Click the pad to start</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="pad" style="width:280px;height:180px;border-radius:16px;background:#b23b3b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;cursor:pointer;text-align:center;padding:0 20px;user-select:none">Click to start</div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),pad=document.getElementById('pad');
    var state='idle',t0,round=0,ROUNDS=5,times=[],to=null,lastChange=0;
    function setPad(bg,txt){pad.style.background=bg;pad.textContent=txt;}
    function mark(s){state=s;lastChange=Date.now();}
    function clearTimer(){if(to){clearTimeout(to);to=null;}}
    function nextRound(){clearTimer();mark('wait');setPad('#b23b3b','Wait for green\u2026');to=setTimeout(function(){to=null;mark('go');t0=Date.now();setPad('#3a9c4a','CLICK!');},1200+Math.random()*1800);}
    function finish(){clearTimer();mark('done');var avg=Math.round(times.reduce(function(a,b){return a+b;},0)/times.length);statusEl.textContent='Average '+avg+'ms over '+ROUNDS+' rounds';setPad('#3a6ea5','Avg '+avg+'ms');done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';pad.dataset.avg=avg;}
    pad.addEventListener('click',function(){
      if(Date.now()-lastChange<120)return;
      if(state==='idle'){round=0;times=[];nextRound();return;}
      if(state==='wait'){clearTimer();setPad('#b23b3b','Too soon! Click to retry');mark('idle');return;}
      if(state==='go'){var ms=Date.now()-t0;times.push(ms);round++;if(round>=ROUNDS){finish();}else{mark('between');setPad('#caa23a','+'+ms+'ms \xB7 click for next');statusEl.textContent='Round '+round+': '+ms+'ms';}return;}
      if(state==='between'){nextRound();return;}
    });
    done.addEventListener('click',function(){var avg=Number(pad.dataset.avg||'500');kiwiComplete(Math.max(0,Math.round((450-avg)/30)),avg);});
  <\/script>
</div>`;
}
export {
  reaction
};
