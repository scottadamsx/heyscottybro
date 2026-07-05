import { gameHead, reward } from "./shell.js";
function reversi(usd) {
  return `<style>
    .rv-board{display:inline-grid;grid-template-columns:repeat(8,36px);grid-template-rows:repeat(8,36px);gap:2px;background:#2f5233;padding:8px;border-radius:10px}
    .rv-cell{width:36px;height:36px;background:#3c6b42;border-radius:3px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative}
    .rv-cell:hover{background:#457a4c}
    .rv-cell.hint::after{content:'';width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.35)}
    .rv-disc{width:28px;height:28px;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.35)}
    .rv-disc.x{background:var(--clay)}
    .rv-disc.o{background:var(--fg)}
    .rv-disc.flip-anim{animation:rvflip .3s ease-in-out}
    @keyframes rvflip{0%{transform:scaleX(1)}50%{transform:scaleX(0)}100%{transform:scaleX(1)}}
    .rv-disc.place-anim{animation:ktilepop .26s cubic-bezier(.2,.9,.3,1.2)}
    @media (prefers-reduced-motion:reduce){ .rv-disc.flip-anim,.rv-disc.place-anim{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Reversi", "Flank the CPU\u2019s discs \u2014 most discs when the board fills wins", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Your move (you are the clay discs)</div>
  <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span class="k-chip" id="youChip">You: 2</span><span class="k-chip" id="cpuChip">CPU: 2</span></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New game</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="rvStage"><div class="rv-board" id="board"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),board=document.getElementById('board'),youChip=document.getElementById('youChip'),cpuChip=document.getElementById('cpuChip'),stage=document.getElementById('rvStage');
    var DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    var CORNERS=[0,7,56,63];
    var XSQ={9:0,14:7,49:56,54:63};
    var grid,cells,over,winner;
    function inb(r,c){return r>=0&&r<8&&c>=0&&c<8;}
    function idx(r,c){return r*8+c;}
    function flipsFor(r,c,color,g){if(g[idx(r,c)])return[];var opp=color==='X'?'O':'X',all=[];
      for(var d=0;d<DIRS.length;d++){var dr=DIRS[d][0],dc=DIRS[d][1],rr=r+dr,cc=c+dc,line=[];
        while(inb(rr,cc)&&g[idx(rr,cc)]===opp){line.push(idx(rr,cc));rr+=dr;cc+=dc;}
        if(line.length&&inb(rr,cc)&&g[idx(rr,cc)]===color)all=all.concat(line);}
      return all;}
    function validMoves(color,g){var out=[];for(var r=0;r<8;r++)for(var c=0;c<8;c++){if(!g[idx(r,c)]&&flipsFor(r,c,color,g).length)out.push(idx(r,c));}return out;}
    function counts(g){var x=0,o=0;for(var i=0;i<64;i++){if(g[i]==='X')x++;else if(g[i]==='O')o++;}return{x:x,o:o};}
    function updChips(){var c=counts(grid);youChip.textContent='You: '+c.x;cpuChip.textContent='CPU: '+c.o;}
    function render(hints){cells.forEach(function(cell,i){var r=Math.floor(i/8),c=i%8;cell.classList.toggle('hint',!!(hints&&hints.indexOf(i)>=0));
      var want=grid[i];var have=cell.dataset.v||'';
      if(want&&!have){var d=document.createElement('div');d.className='rv-disc '+(want==='X'?'x':'o')+' place-anim';cell.innerHTML='';cell.appendChild(d);cell.dataset.v=want;}
      else if(want&&have&&want!==have){var el=cell.querySelector('.rv-disc');if(el){el.classList.remove('flip-anim');void el.offsetWidth;el.classList.add('flip-anim');setTimeout(function(){el.className='rv-disc '+(want==='X'?'x':'o')+' flip-anim';},150);}cell.dataset.v=want;}
      else if(!want&&have){cell.innerHTML='';cell.dataset.v='';}
    });updChips();}
    function applyMove(r,c,color){var f=flipsFor(r,c,color,grid);grid[idx(r,c)]=color;for(var i=0;i<f.length;i++)grid[f[i]]=color;return f.length;}
    function isCorner(i){return CORNERS.indexOf(i)>=0;}
    function cpuTurn(){var moves=validMoves('O',grid);
      if(!moves.length){statusEl.textContent='CPU has no move \u2014 your turn again.';checkTurns();return;}
      var best=null,bestScore=-1e9;
      for(var m=0;m<moves.length;m++){var i=moves[m],r=Math.floor(i/8),c=i%8;var flips=flipsFor(r,c,'O',grid).length;var score=flips;
        if(isCorner(i))score+=25;
        if(XSQ[i]!==undefined&&!grid[XSQ[i]])score-=12;
        if(score>bestScore){bestScore=score;best=i;}}
      var r=Math.floor(best/8),c=best%8;applyMove(r,c,'O');render();statusEl.textContent='CPU played \xB7 your move';checkTurns();}
    function endGame(){over=true;var c=counts(grid);var youWin=c.x>c.o;winner=youWin;
      statusEl.textContent='Game over \u2014 you '+c.x+', CPU '+c.o+(youWin?'. You win!':(c.x===c.o?'. Draw.':'. CPU wins.'));
      if(youWin){done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
      else{stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);}
      render();}
    function checkTurns(){var pm=validMoves('X',grid),om=validMoves('O',grid);
      if(!pm.length&&!om.length){endGame();return;}
      if(!pm.length){statusEl.textContent='No legal move for you \u2014 CPU goes again.';setTimeout(cpuTurn,500);return;}
      render(pm);}
    function click(i){if(over)return;var r=Math.floor(i/8),c=i%8;var f=flipsFor(r,c,'X',grid);if(!f.length)return;
      applyMove(r,c,'X');render();statusEl.textContent='CPU is thinking\u2026';setTimeout(cpuTurn,450);}
    function init(){grid=new Array(64).fill(null);grid[idx(3,3)]='O';grid[idx(3,4)]='X';grid[idx(4,3)]='X';grid[idx(4,4)]='O';
      over=false;winner=false;done.disabled=true;done.classList.remove('k-earn-ready');
      board.innerHTML='';cells=[];for(var i=0;i<64;i++){(function(i){var cell=document.createElement('div');cell.className='rv-cell';cell.dataset.v='';cell.addEventListener('click',function(){click(i);});board.appendChild(cell);cells.push(cell);})(i);}
      statusEl.textContent='Your move (you are the clay discs)';checkTurns();}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){var c=counts(grid);var margin=c.x-c.o;var bonus=winner?(margin>=20?8:6):0;kiwiComplete(bonus,margin,winner);});
    init();
  <\/script>
</div>`;
}
export {
  reversi
};
