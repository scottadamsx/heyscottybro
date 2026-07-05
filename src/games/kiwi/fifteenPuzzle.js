import { gameHead, reward } from "./shell.js";
const PAR = 40;
function fifteen(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Number Slide", "Slide tiles into order (1\u20138). Stuck? You can skip after 30s", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Moves: 0</div>
  <div style="margin-top:10px;display:flex;gap:8px"><span class="k-chip" id="parChip">Par ${PAR}</span></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="reset" class="k-press">Shuffle</button> <button id="skip" class="k-press" disabled>Skip in 30s</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="board" style="position:relative;width:230px;height:230px;background:var(--card);border-radius:10px"></div></div>
  </div>
  <style>
    .ft{position:absolute;width:72px;height:72px;border-radius:9px;background:linear-gradient(160deg,var(--green),var(--green2));
        color:#fff;font-weight:800;font-size:24px;cursor:pointer;border:0;display:flex;align-items:center;justify-content:center;
        box-shadow:0 6px 14px -6px rgba(46,43,37,.45),inset 0 1px 0 rgba(255,255,255,.28);
        transition:transform 120ms ease}
    .ft:active{transform:scale(.97)}
    @media (prefers-reduced-motion:reduce){ .ft{transition:none} }
  </style>
  <script>
    var N=3,TILE=72,GAP=7,board=document.getElementById('board'),statusEl=document.getElementById('status'),done=document.getElementById('done'),skip=document.getElementById('skip'),b,moves,solved=false,tiles=[];
    var PAR=${PAR};
    function pos(i){return {x:(i%N)*(TILE+GAP), y:Math.floor(i/N)*(TILE+GAP)};}
    function buildTiles(){board.innerHTML='';tiles=[];for(var v=1;v<=8;v++){(function(v){var t=document.createElement('button');t.className='ft';t.textContent=v;t.addEventListener('click',function(){tap(v);});board.appendChild(t);tiles[v]=t;})(v);}}
    function init(){b=[1,2,3,4,5,6,7,8,0];moves=0;solved=false;for(var i=0;i<120;i++)rmove();done.disabled=true;statusEl.textContent='Moves: 0';buildTiles();layout();}
    function adj(i){var bl=b.indexOf(0),r=Math.floor(i/N),c=i%N,br=Math.floor(bl/N),bc=bl%N;return Math.abs(r-br)+Math.abs(c-bc)===1;}
    function rmove(){var bl=b.indexOf(0),opts=[];for(var i=0;i<N*N;i++)if(adj(i))opts.push(i);var p=opts[Math.floor(Math.random()*opts.length)];b[bl]=b[p];b[p]=0;}
    function layout(){for(var i=0;i<N*N;i++){var v=b[i];if(!v)continue;var p=pos(i);tiles[v].style.transform='translate('+p.x+'px,'+p.y+'px)';}}
    function tap(v){if(solved)return;var i=b.indexOf(v);if(!adj(i))return;var bl=b.indexOf(0);b[bl]=b[i];b[i]=0;moves++;statusEl.textContent='Moves: '+moves;layout();check();}
    function check(){for(var i=0;i<N*N-1;i++)if(b[i]!==i+1)return;if(b[N*N-1]===0){solved=true;var challenging=moves<=PAR*2;statusEl.textContent='Solved in '+moves+' moves!'+(challenging?' Challenging solve \u2014 bonus!':'');done.disabled=false;done.dataset.bonus=challenging?'6':'4';skip.style.display='none';}}
    document.getElementById('reset').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(Number(done.dataset.bonus||'4'));});
    skip.addEventListener('click',function(){if(!skip.disabled)kiwiComplete(0);});
    var sk=30;var iv=setInterval(function(){sk--;if(sk<=0){clearInterval(iv);if(!solved){skip.disabled=false;skip.textContent='Skip';}}else if(!solved){skip.textContent='Skip in '+sk+'s';}},1000);
    init();
  <\/script>
</div>`;
}
export {
  fifteen
};
