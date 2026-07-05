import { gameHead, reward } from "./shell.js";
function bankroll21(usd) {
  return `<style>
    .bk-chip{background:var(--chip);color:var(--clay-d);font-weight:700;font-size:12.5px;padding:5px 10px;border-radius:999px}
    .bk-betrow{display:flex;align-items:center;gap:10px;margin-top:10px}
    .bk-betval{font-family:var(--display);font-weight:700;font-size:20px;min-width:64px;text-align:center}
    .bk-table{font-size:18px;line-height:2;min-width:260px}
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Bankroll", "Beat the house across 3+ hands \u2014 dealer stands on 17, start with 20 chips", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Dealing\u2026</div>
  <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span class="bk-chip" id="chipsChip">Bank: 20</span><span class="bk-chip" id="handsChip">Hands: 0</span></div>
  <div class="bk-betrow"><span class="k-sub">Bet</span><button id="betdown" class="k-press">\u22125</button><span class="bk-betval" id="betval">5</span><button id="betup" class="k-press">+5</button></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap">
    <button id="hit" class="k-press">Hit</button> <button id="stand" class="k-press">Stand</button> <button id="deal" class="k-press">Deal</button> <button id="newb" class="k-press">New game</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button>
  </div>
  </div>
  <div class="k-right" id="bkStage"><div class="bk-table" id="tbl"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),tbl=document.getElementById('tbl'),stage=document.getElementById('bkStage');
    var chipsChip=document.getElementById('chipsChip'),handsChip=document.getElementById('handsChip'),betval=document.getElementById('betval');
    var hitB=document.getElementById('hit'),standB=document.getElementById('stand'),dealB=document.getElementById('deal'),betupB=document.getElementById('betup'),betdownB=document.getElementById('betdown');
    var START=20,MINBET=5;
    var deck,you,dealer,chips,hands,bet,inHand,busted,over;
    function mk(){deck=[];var s=['\u2660','\u2665','\u2666','\u2663'],r=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
      for(var i=0;i<4;i++)for(var j=0;j<13;j++)deck.push({r:r[j],s:s[i]});
      for(var k=deck.length-1;k>0;k--){var m=Math.floor(Math.random()*(k+1));var t=deck[k];deck[k]=deck[m];deck[m]=t;}}
    function val(h){var t=0,a=0;for(var i=0;i<h.length;i++){var c=h[i].r;if(c==='A'){a++;t+=11;}else if(c==='K'||c==='Q'||c==='J'||c==='10')t+=10;else t+=parseInt(c,10);}
      while(t>21&&a){t-=10;a--;}return t;}
    function cards(h,hide){var o='';for(var i=0;i<h.length;i++)o+=(hide&&i===1)?'[?] ':('['+h[i].r+h[i].s+'] ');return o;}
    function draw(hd){tbl.innerHTML='Dealer: '+cards(dealer,hd)+(hd?'':' = '+val(dealer))+'<br>You: '+cards(you,false)+' = '+val(you)+'<br>Bet: '+bet;}
    function updateChips(){chipsChip.textContent='Bank: '+chips;handsChip.textContent='Hands: '+hands;kScore(chips);}
    function clampBet(){bet=Math.max(MINBET,Math.min(bet,chips));betval.textContent=bet;}
    function checkGate(){if(hands>=3&&chips>START){done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}}
    function endHand(msg){inHand=false;hitB.disabled=true;standB.disabled=true;hands++;updateChips();draw(false);
      statusEl.textContent=msg+' \xB7 Bank '+chips+' after '+hands+' hand'+(hands===1?'':'s');checkGate();
      if(chips<MINBET){over=true;dealB.disabled=true;betupB.disabled=true;betdownB.disabled=true;
        if(!(hands>=3&&chips>START)){statusEl.textContent="Out of chips \u2014 can't cover the "+MINBET+'-chip minimum bet. New game to try again.';}}
      else{dealB.disabled=false;betupB.disabled=false;betdownB.disabled=false;}}
    function resolve(){while(val(dealer)<17)dealer.push(deck.pop());var p=val(you),d=val(dealer);
      if(d>21||p>d){chips+=bet*2;endHand('You win!');}
      else if(p===d){chips+=bet;endHand('Push.');}
      else{endHand('Dealer wins.');}}
    function deal(){if(over||inHand)return;clampBet();if(chips<bet)return;
      mk();chips-=bet;you=[deck.pop(),deck.pop()];dealer=[deck.pop(),deck.pop()];inHand=true;busted=false;
      hitB.disabled=false;standB.disabled=false;dealB.disabled=true;betupB.disabled=true;betdownB.disabled=true;
      draw(true);updateChips();statusEl.textContent='Hit or stand?';
      if(val(you)===21)resolve();}
    hitB.addEventListener('click',function(){if(!inHand)return;you.push(deck.pop());draw(true);
      if(val(you)>21){busted=true;endHand('Bust!');}});
    standB.addEventListener('click',function(){if(!inHand)return;resolve();});
    dealB.addEventListener('click',deal);
    betupB.addEventListener('click',function(){if(inHand)return;bet=Math.min(chips,bet+5);clampBet();});
    betdownB.addEventListener('click',function(){if(inHand)return;bet=Math.max(MINBET,bet-5);clampBet();});
    function init(){chips=START;hands=0;bet=MINBET;inHand=false;over=false;
      done.disabled=true;done.classList.remove('k-earn-ready');
      dealB.disabled=false;betupB.disabled=false;betdownB.disabled=false;hitB.disabled=true;standB.disabled=true;
      updateChips();betval.textContent=bet;tbl.innerHTML='Bank: '+chips+' chips. Deal to start a hand (min bet '+MINBET+').';
      statusEl.textContent='Play 3+ hands and finish above '+START+' chips to unlock Claim';}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){var profit=chips-START;var bonus=profit>=15?9:6;kiwiComplete(bonus,profit,true);});
    init();
  <\/script>
</div>`;
}
export {
  bankroll21
};
