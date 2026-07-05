import { gameHead, reward } from "./shell.js";
function videopoker(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Video Poker", "Start with 15 chips. Each deal costs 1 \u2014 hold cards, draw once, get paid for the hand", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Chips: 15</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="draw">Deal</button> <button id="done" disabled>Cash out ${reward(usd)}</button></div>
  <div class="k-sub" style="margin-top:10px;font-size:11px;max-width:280px">Jacks+ 1 \xB7 Two pair 2 \xB7 Trips 3 \xB7 Straight 4 \xB7 Flush 6 \xB7 Full house 9 \xB7 Quads 25 \xB7 Straight flush 50</div>
  </div>
  <div class="k-right"><div id="hand" style="display:flex;gap:8px"></div></div>
  </div>
  <style>.pc{width:58px;height:84px;border-radius:10px;background:#fff;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;cursor:pointer;color:#1b1a17;position:relative}.pc.red{color:#c0392b}.pc.held{outline:3px solid var(--clay);outline-offset:2px}.pc .h{position:absolute;bottom:3px;font-size:9px;letter-spacing:.08em;color:var(--clay)}</style>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),handEl=document.getElementById('hand'),drawB=document.getElementById('draw');
    var deck,hand,held,phase,chips=15;
    function mk(){deck=[];var s=['\u2660','\u2665','\u2666','\u2663'],r=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];for(var i=0;i<4;i++)for(var j=0;j<13;j++)deck.push({r:r[j],s:s[i],v:j+2});for(var k=deck.length-1;k>0;k--){var m=Math.floor(Math.random()*(k+1));var t=deck[k];deck[k]=deck[m];deck[m]=t;}}
    function render(){handEl.innerHTML='';for(var i=0;i<5;i++){(function(i){var c=hand[i];var d=document.createElement('div');d.className='pc'+((c.s==='\u2665'||c.s==='\u2666')?' red':'')+(held[i]?' held':'');d.innerHTML=c.r+c.s+(held[i]?'<span class="h">HOLD</span>':'');d.addEventListener('click',function(){if(phase!=='hold')return;held[i]=!held[i];render();});handEl.appendChild(d);})(i);}}
    function rank(){var rs=hand.map(function(c){return c.v;}).sort(function(a,b){return a-b;});var ss=hand.map(function(c){return c.s;});var fl=ss.every(function(x){return x===ss[0];});var stt=rs.every(function(v,i){return i===0||v===rs[i-1]+1;});var cnt={};rs.forEach(function(v){cnt[v]=(cnt[v]||0)+1;});var c=Object.keys(cnt).map(function(k){return cnt[k];}).sort(function(a,b){return b-a;});
      if(stt&&fl)return['Straight flush',50];if(c[0]===4)return['Four of a kind',25];if(c[0]===3&&c[1]===2)return['Full house',9];if(fl)return['Flush',6];if(stt)return['Straight',4];if(c[0]===3)return['Three of a kind',3];if(c[0]===2&&c[1]===2)return['Two pair',2];
      if(c[0]===2){for(var k in cnt)if(cnt[k]===2&&Number(k)>=11)return['Jacks or better',1];return['Low pair',0];}return['Nothing',0];}
    function deal(){if(chips<1){statusEl.textContent='Out of chips \u2014 cash out!';return;}chips--;mk();hand=[];held=[false,false,false,false,false];for(var i=0;i<5;i++)hand.push(deck.pop());phase='hold';render();statusEl.textContent='Chips: '+chips+' \xB7 tap cards to HOLD, then Draw';drawB.textContent='Draw';}
    function drawCards(){for(var i=0;i<5;i++)if(!held[i])hand[i]=deck.pop();phase='paid';render();var r=rank();chips+=r[1];statusEl.textContent=r[0]+' \u2192 +'+r[1]+' chips \xB7 total '+chips;drawB.textContent='Deal';done.disabled=false;done.textContent='Cash out ${reward(usd)}'+(chips>15?' + bonus':'');}
    drawB.addEventListener('click',function(){if(phase==='hold')drawCards();else deal();});
    done.addEventListener('click',function(){kiwiComplete(Math.max(0,Math.round((chips-15)/2)),chips);});
    deal();
  <\/script>
</div>`;
}
export {
  videopoker
};
