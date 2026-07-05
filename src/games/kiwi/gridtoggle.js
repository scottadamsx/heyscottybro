import { gameHead, reward } from "./shell.js";
function gridtoggle(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Grid Toggle", "Tap a tile to flip it and its neighbours \u2014 solve within 25 moves", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Lights on: 0 \xB7 moves 0 / 25</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New board</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="gtStage"><div id="bd" style="display:inline-grid;grid-template-columns:repeat(5,46px);gap:5px"></div></div>
  </div>
  <style>
    .gt{width:46px;height:46px;border:0;border-radius:8px;cursor:pointer;background:var(--tile);transition:transform .12s ease,box-shadow .12s ease}
    .gt:hover{filter:brightness(1.04)}
    .gt.on{background:#8bc34a;box-shadow:0 0 12px rgba(139,195,74,.6)}
    .gt.flip{animation:kgtflip .22s ease-out}
    @keyframes kgtflip{0%{transform:scale(.86) rotate(-4deg)}60%{transform:scale(1.06) rotate(2deg)}100%{transform:scale(1) rotate(0)}}
    @media (prefers-reduced-motion:reduce){ .gt.flip{animation:none} }
  </style>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),bd=document.getElementById('bd'),stage=document.getElementById('gtStage');
    var N=5,PAR=25,WALK=18,s,moves,solved=false,withinPar=false;
    function idx(r,c){return r*N+c;}
    function flip(r,c){[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var nr=r+d[0],nc=c+d[1];if(nr>=0&&nr<N&&nc>=0&&nc<N)s[idx(nr,nc)]^=1;});}
    function render(){bd.innerHTML='';for(var r=0;r<N;r++)for(var c=0;c<N;c++){(function(r,c){var b=document.createElement('button');b.className='gt'+(s[idx(r,c)]?' on':'');b.addEventListener('click',function(){tap(r,c);});bd.appendChild(b);})(r,c);}
      var on=s.filter(function(v){return v;}).length;statusEl.textContent='Lights on: '+on+' \xB7 moves '+moves+' / '+PAR;
      if(on===0&&moves>0){solved=true;withinPar=moves<=PAR;
        if(withinPar){statusEl.textContent='Solved in '+moves+' moves \u2014 inside the gate! Claim below.';done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
        else{statusEl.textContent='Solved in '+moves+' moves \u2014 over the 25-move gate. New board to try again.';}
      }}
    function tap(r,c){if(solved)return;moves++;flip(r,c);render();var b=bd.children[idx(r,c)];if(b){b.classList.remove('flip');void b.offsetWidth;b.classList.add('flip');}}
    function init(){s=[];for(var i=0;i<N*N;i++)s.push(0);
      // Random walk of WALK taps from the solved state guarantees a \u2264WALK-move solution exists.
      for(var k=0;k<WALK;k++)flip(Math.floor(Math.random()*N),Math.floor(Math.random()*N));
      solved=false;withinPar=false;moves=0;done.disabled=true;done.classList.remove('k-earn-ready');render();}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(withinPar?6:0,moves,withinPar);});
    init();
  <\/script>
</div>`;
}
export {
  gridtoggle
};
