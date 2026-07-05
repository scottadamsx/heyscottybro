import { gameHead, reward } from "./shell.js";
function tictactoe(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Tic-Tac-Toe", "You are X \u2014 beat the computer", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Your move</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb">New game</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="bd" style="display:inline-grid;grid-template-columns:repeat(3,70px);gap:6px"></div></div>
  </div>
  <style>.tt{width:70px;height:70px;border:0;border-radius:10px;background:var(--tile);font-size:34px;font-weight:700;color:var(--fg);cursor:pointer}.tt:hover{background:var(--hover)}</style>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),bd=document.getElementById('bd');
    var b,over,wins=0,games=0;
    var L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    function winner(s){for(var i=0;i<L.length;i++){var l=L[i];if(s[l[0]]&&s[l[0]]===s[l[1]]&&s[l[1]]===s[l[2]])return s[l[0]];}return s.indexOf('')<0?'draw':null;}
    function render(){bd.innerHTML='';for(var i=0;i<9;i++){(function(i){var t=document.createElement('button');t.className='tt';t.textContent=b[i];t.addEventListener('click',function(){move(i);});bd.appendChild(t);})(i);}}
    function find(p){for(var i=0;i<L.length;i++){var l=L[i],c=[b[l[0]],b[l[1]],b[l[2]]];var ct=c.filter(function(x){return x===p;}).length,e=c.indexOf('');if(ct===2&&e>=0)return l[e];}return -1;}
    function ai(){var m=find('O');if(m<0)m=find('X');if(m<0&&!b[4])m=4;if(m<0){var co=[0,2,6,8].filter(function(i){return !b[i];});if(co.length)m=co[Math.floor(Math.random()*co.length)];}if(m<0){var em=[];for(var i=0;i<9;i++)if(!b[i])em.push(i);m=em[Math.floor(Math.random()*em.length)];}b[m]='O';}
    function check(){var w=winner(b);if(w){over=true;games++;if(w==='X')wins++;statusEl.textContent=(w==='X'?'You win!':w==='O'?'Computer wins.':'Draw.')+' \xB7 won '+wins+'/'+games;done.disabled=false;done.textContent='Claim ${reward(usd)}'+(wins>0?' + bonus':'');render();return true;}return false;}
    function move(i){if(over||b[i])return;b[i]='X';if(check())return;ai();render();check();}
    function init(){b=['','','','','','','','',''];over=false;render();statusEl.textContent='Your move \xB7 won '+wins+'/'+games;done.disabled=(wins===0);}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(wins*2,wins,wins>0);});
    init();
  <\/script>
</div>`;
}
export {
  tictactoe
};
