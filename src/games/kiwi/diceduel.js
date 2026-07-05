import { gameHead, reward } from "./shell.js";
function diceduel(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Dice Duel", "Roll three dice vs the CPU \u2014 higher total wins the round. Best of 5", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">You 0 \u2014 0 CPU</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="roll">Roll</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" style="text-align:center"><div id="you" style="font-size:38px">\u2680\u2680\u2680</div><div class="k-sub">vs</div><div id="cpu" style="font-size:38px">\u2680\u2680\u2680</div><div class="k-sub" id="rd" style="margin-top:6px"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),youEl=document.getElementById('you'),cpuEl=document.getElementById('cpu'),rd=document.getElementById('rd');
    var F=['\u2680','\u2681','\u2682','\u2683','\u2684','\u2685'];
    var yw=0,cw=0,round=0,MAX=5,over=false;
    function roll3(){var a=[],s=0;for(var i=0;i<3;i++){var d=1+Math.floor(Math.random()*6);a.push(F[d-1]);s+=d;}return{f:a.join(''),s:s};}
    document.getElementById('roll').addEventListener('click',function(){if(over)return;round++;var y=roll3(),c=roll3();youEl.textContent=y.f;cpuEl.textContent=c.f;var res=y.s>c.s?'You win':y.s<c.s?'CPU wins':'Tie';if(y.s>c.s)yw++;else if(y.s<c.s)cw++;rd.textContent='Round '+round+': '+y.s+' vs '+c.s+' \u2014 '+res;statusEl.textContent='You '+yw+' \u2014 '+cw+' CPU';if(round>=MAX){over=true;var w=yw>cw;statusEl.textContent=(w?'You win the duel! ':'You lost. ')+'('+yw+'\u2013'+cw+')';done.disabled=false;done.textContent='Claim ${reward(usd)}'+(w?' + bonus':'');}});
    done.addEventListener('click',function(){kiwiComplete(yw>cw?3:0,yw);});
    statusEl.textContent='You 0 \u2014 0 CPU';
  <\/script>
</div>`;
}
export {
  diceduel
};
