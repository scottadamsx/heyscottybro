import { gameHead, reward } from "./shell.js";
function pig(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Pig (Dice)", "Roll to build points, but a 1 wipes your turn. Hold to bank. First to 50 wins", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">You 0 \xB7 CPU 0</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="roll">Roll</button> <button id="hold">Hold</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" style="text-align:center"><div id="die" style="font-size:64px;min-height:80px">\u2680</div><div class="k-sub" id="turn">Turn: 0</div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),die=document.getElementById('die'),turnEl=document.getElementById('turn');
    var F=['\u2680','\u2681','\u2682','\u2683','\u2684','\u2685'];
    var you=0,cpu=0,turn=0,over=false;
    function upd(){statusEl.textContent='You '+you+' \xB7 CPU '+cpu;turnEl.textContent='Turn: '+turn;}
    function fin(w){over=true;statusEl.textContent=(w?'You reached 50 \u2014 you win!':'CPU wins this one.')+' ('+you+'\u2013'+cpu+')';done.disabled=false;done.textContent='Claim ${reward(usd)}'+(w?' + bonus':'');}
    function cpuTurn(){var t=0;function step(){if(over)return;var d=1+Math.floor(Math.random()*6);die.textContent=F[d-1];if(d===1){turnEl.textContent='CPU rolled 1 \u2014 your go';return;}t+=d;turnEl.textContent='CPU turn: '+t;if(cpu+t>=50){cpu+=t;upd();fin(false);return;}if(t>=20){cpu+=t;upd();turnEl.textContent='CPU holds \u2014 your go';return;}setTimeout(step,500);}setTimeout(step,400);}
    document.getElementById('roll').addEventListener('click',function(){if(over)return;var d=1+Math.floor(Math.random()*6);die.textContent=F[d-1];if(d===1){turn=0;upd();statusEl.textContent='Rolled a 1 \u2014 turn lost. CPU\u2019s go.';cpuTurn();return;}turn+=d;upd();if(you+turn>=50){you+=turn;turn=0;fin(true);}});
    document.getElementById('hold').addEventListener('click',function(){if(over||turn===0)return;you+=turn;turn=0;upd();if(you>=50){fin(true);return;}statusEl.textContent='Banked. CPU\u2019s go.';cpuTurn();});
    done.addEventListener('click',function(){kiwiComplete(you>cpu?4:0,you,you>cpu);});
    upd();
  <\/script>
</div>`;
}
export {
  pig
};
