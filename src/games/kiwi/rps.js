import { gameHead, reward } from "./shell.js";
function rps(usd) {
  return `<style>
    .rps-arena{display:flex;flex-direction:column;align-items:center;gap:14px;width:100%}
    .rps-score{display:flex;align-items:baseline;gap:10px;font-family:var(--display);font-size:15px;color:var(--fg);border-radius:14px;padding:4px 10px}
    .rps-score b{font-size:26px;font-variant-numeric:tabular-nums}
    .rps-hands{display:flex;align-items:center;justify-content:center;gap:26px}
    .rps-hand{font-size:58px;line-height:1}
    .rps-vslabel{font-family:var(--display);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
    .rps-result{font-family:var(--display);font-size:16px;min-height:22px;font-weight:600;color:var(--muted)}
    .rps-result.win{color:var(--green2)}
    .rps-result.lose{color:var(--clay-d)}
    .rps-result.draw{color:var(--muted)}
    @media (prefers-reduced-motion:reduce){ .rps-hand{animation:none!important} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Rock Paper Scissors", "Best of 5 against the computer", usd)}
  <div class="k-pips" id="pips" style="margin-top:10px"></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="r" class="k-press">\u270A Rock</button> <button id="p" class="k-press">\u270B Paper</button> <button id="sc" class="k-press">\u270C Scissors</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div class="rps-arena">
    <div class="rps-score" id="statusScore"><span>You <b id="youScore">0</b></span><span class="rps-vslabel">vs</span><span>CPU <b id="cpuScore">0</b></span></div>
    <div class="rps-hands"><div class="rps-hand" id="yourHand">\u270A</div><div class="rps-vslabel">VS</div><div class="rps-hand" id="cpuHand">\u2754</div></div>
    <div class="rps-result" id="rd">Pick a hand to begin</div>
  </div></div>
  </div>
  <script>
    var done=document.getElementById('done'),youScoreEl=document.getElementById('youScore'),cpuScoreEl=document.getElementById('cpuScore'),yourHand=document.getElementById('yourHand'),cpuHand=document.getElementById('cpuHand'),rd=document.getElementById('rd'),pipsEl=document.getElementById('pips');
    var btnR=document.getElementById('r'),btnP=document.getElementById('p'),btnSc=document.getElementById('sc');
    var EM=['\u270A','\u270B','\u270C'],NAMES=['Rock','Paper','Scissors'],you=0,cpu=0,over=false,animating=false,roundIdx=0,MAXP=5;
    function buildPips(){pipsEl.innerHTML='';for(var i=0;i<MAXP;i++){var s=document.createElement('span');s.className='k-pip';pipsEl.appendChild(s);}}
    buildPips();
    function setBtns(dis){btnR.disabled=dis;btnP.disabled=dis;btnSc.disabled=dis;}
    function go(m){
      if(over||animating)return;
      animating=true;setBtns(true);
      var c=Math.floor(Math.random()*3);
      yourHand.textContent=EM[m];yourHand.classList.remove('k-shake-soft');void yourHand.offsetWidth;yourHand.classList.add('k-shake-soft');
      cpuHand.textContent='\u2754';cpuHand.classList.add('k-thinking');
      rd.textContent='Rolling\u2026';rd.className='rps-result';
      setTimeout(function(){
        cpuHand.classList.remove('k-thinking');
        cpuHand.textContent=EM[c];cpuHand.classList.remove('k-tilepop');void cpuHand.offsetWidth;cpuHand.classList.add('k-tilepop');
        var res=(m===c)?'draw':((m===(c+1)%3)?'win':'lose');
        if(res==='win'){you++;youScoreEl.textContent=you;kpop(youScoreEl);}
        else if(res==='lose'){cpu++;cpuScoreEl.textContent=cpu;kpop(cpuScoreEl);}
        var label=res==='win'?'You win':res==='lose'?'CPU wins':'Tie';
        rd.textContent=NAMES[m]+' vs '+NAMES[c]+' \u2014 '+label;
        rd.className='rps-result '+res;
        if(pipsEl.children[roundIdx]){pipsEl.children[roundIdx].classList.add(res==='win'?'k-pip-win':res==='lose'?'k-pip-lose':'k-pip-draw');}
        roundIdx++;
        if(you===3||cpu===3){
          over=true;var w=you>cpu;
          rd.textContent=(w?'You win the match! ':'You lost. ')+'('+you+'\u2013'+cpu+')';
          rd.className='rps-result '+(w?'win':'lose');
          done.disabled=false;done.classList.add('k-earn-ready');done.textContent='Claim ${reward(usd)}'+(w?' + bonus':'');
          if(w){document.getElementById('statusScore').classList.add('k-winglow');}
        }
        animating=false;setBtns(over);
      },650);
    }
    btnR.addEventListener('click',function(){go(0);});
    btnP.addEventListener('click',function(){go(1);});
    btnSc.addEventListener('click',function(){go(2);});
    done.addEventListener('click',function(){kiwiComplete(you>cpu?3:0,you,you>cpu);});
  <\/script>
</div>`;
}
export {
  rps
};
