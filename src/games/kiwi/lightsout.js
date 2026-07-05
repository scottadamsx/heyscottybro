import { gameHead, reward } from "./shell.js";
function lightsout(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Lights Out", "Tap a tile to flip it and its neighbours \u2014 turn them all off", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Lights on: 0 \xB7 moves 0</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb">New</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="bd" style="display:inline-grid;grid-template-columns:repeat(5,46px);gap:5px"></div></div>
  </div>
  <style>.lo{width:46px;height:46px;border:0;border-radius:8px;cursor:pointer;background:var(--tile)}.lo.on{background:#8bc34a;box-shadow:0 0 12px rgba(139,195,74,.6)}</style>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),bd=document.getElementById('bd');
    var N=5,s,moves,solved=false;
    function idx(r,c){return r*N+c;}
    function flip(r,c){[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var nr=r+d[0],nc=c+d[1];if(nr>=0&&nr<N&&nc>=0&&nc<N)s[idx(nr,nc)]^=1;});}
    function render(){bd.innerHTML='';for(var r=0;r<N;r++)for(var c=0;c<N;c++){(function(r,c){var b=document.createElement('button');b.className='lo'+(s[idx(r,c)]?' on':'');b.addEventListener('click',function(){tap(r,c);});bd.appendChild(b);})(r,c);}var on=s.filter(function(x){return x;}).length;statusEl.textContent='Lights on: '+on+' \xB7 moves '+moves;if(on===0&&moves>0){solved=true;statusEl.textContent='All out in '+moves+' moves!';done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';}}
    function tap(r,c){if(solved)return;moves++;flip(r,c);render();}
    function init(){s=[];for(var i=0;i<N*N;i++)s.push(0);solved=false;done.disabled=true;for(var k=0;k<8;k++)flip(Math.floor(Math.random()*N),Math.floor(Math.random()*N));moves=0;render();}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(solved?6:0,moves);});
    init();
  <\/script>
</div>`;
}
export {
  lightsout
};
