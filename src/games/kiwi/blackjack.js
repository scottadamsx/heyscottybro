import { gameHead, reward } from "./shell.js";
function blackjack(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Blackjack", "Hit or stand \u2014 beat the dealer without busting. Play as many hands as you like", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Dealing\u2026</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="hit">Hit</button> <button id="stand">Stand</button> <button id="deal">New hand</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="tbl" style="font-size:18px;line-height:2"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),tbl=document.getElementById('tbl');
    var hitB=document.getElementById('hit'),standB=document.getElementById('stand'),dealB=document.getElementById('deal');
    var deck,you,dealer,over,wins=0,hands=0;
    function mk(){deck=[];var s=['\u2660','\u2665','\u2666','\u2663'],r=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];for(var i=0;i<4;i++)for(var j=0;j<13;j++)deck.push({r:r[j],s:s[i]});for(var k=deck.length-1;k>0;k--){var m=Math.floor(Math.random()*(k+1));var t=deck[k];deck[k]=deck[m];deck[m]=t;}}
    function val(h){var t=0,a=0;for(var i=0;i<h.length;i++){var c=h[i].r;if(c==='A'){a++;t+=11;}else if(c==='K'||c==='Q'||c==='J'||c==='10')t+=10;else t+=parseInt(c,10);}while(t>21&&a){t-=10;a--;}return t;}
    function cards(h,hide){var o='';for(var i=0;i<h.length;i++){o+=(hide&&i===1)?'[?] ':('['+h[i].r+h[i].s+'] ');}return o;}
    function draw(hd){tbl.innerHTML='Dealer: '+cards(dealer,hd)+(hd?'':' = '+val(dealer))+'<br>You: '+cards(you,false)+' = '+val(you);}
    function end(msg,win){over=true;hitB.disabled=true;standB.disabled=true;hands++;if(win)wins++;draw(false);statusEl.textContent=msg+' \xB7 won '+wins+'/'+hands;done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';}
    function stand(){while(val(dealer)<17)dealer.push(deck.pop());var p=val(you),d=val(dealer);if(d>21||p>d)end('You win!',true);else if(p===d)end('Push.',false);else end('Dealer wins.',false);}
    function deal(){mk();you=[deck.pop(),deck.pop()];dealer=[deck.pop(),deck.pop()];over=false;done.disabled=true;hitB.disabled=false;standB.disabled=false;draw(true);statusEl.textContent='Hit or stand? \xB7 won '+wins+'/'+hands;if(val(you)===21)stand();}
    hitB.addEventListener('click',function(){if(over)return;you.push(deck.pop());draw(true);if(val(you)>21)end('Bust!',false);});
    standB.addEventListener('click',function(){if(over)return;stand();});
    dealB.addEventListener('click',deal);
    done.addEventListener('click',function(){kiwiComplete(wins*3,wins,wins>0);});
    deal();
  <\/script>
</div>`;
}
export {
  blackjack
};
