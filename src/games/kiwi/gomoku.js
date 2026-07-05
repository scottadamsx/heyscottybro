import { gameHead, reward } from "./shell.js";
function gomoku(usd) {
  return `<style>
    .gk-board{display:inline-grid;grid-template-columns:repeat(12,26px);grid-template-rows:repeat(12,26px);background:#D9B382;padding:8px;border-radius:8px}
    .gk-cell{width:26px;height:26px;position:relative;cursor:pointer;border:1px solid rgba(46,43,37,.14)}
    .gk-cell:hover{background:rgba(255,255,255,.18)}
    .gk-stone{position:absolute;inset:2px;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.4)}
    .gk-stone.player{background:var(--clay)}
    .gk-stone.cpu{background:#2E2B25}
    .gk-stone.place-anim{animation:ktilepop .22s cubic-bezier(.2,.9,.3,1.2)}
    .gk-cell.win .gk-stone{box-shadow:0 0 0 2px var(--gold),0 2px 4px rgba(0,0,0,.4)}
    @media (prefers-reduced-motion:reduce){ .gk-stone.place-anim{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Gomoku", "Five in a row on the 12x12 board vs the CPU", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Your move (you are the clay stones)</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New game</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="gkStage"><div class="gk-board" id="board"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),board=document.getElementById('board'),stage=document.getElementById('gkStage');
    var N=12,DIRS=[[0,1],[1,0],[1,1],[1,-1]];
    var grid,cells,over,winner,thinking;
    function idx(r,c){return r*N+c;}
    function inb(r,c){return r>=0&&r<N&&c>=0&&c<N;}
    function runInfo(g,r,c,color,dr,dc){var count=1;
      var fr=r+dr,fc=c+dc;while(inb(fr,fc)&&g[idx(fr,fc)]===color){count++;fr+=dr;fc+=dc;}
      var openF=inb(fr,fc)&&g[idx(fr,fc)]===0;
      var br=r-dr,bc=c-dc;while(inb(br,bc)&&g[idx(br,bc)]===color){count++;br-=dr;bc-=dc;}
      var openB=inb(br,bc)&&g[idx(br,bc)]===0;
      return{count:count,openEnds:(openF?1:0)+(openB?1:0)};}
    function scoreFor(count,openEnds){if(count>=5)return 100000;
      if(count===4)return openEnds>=1?10000:0;
      if(count===3)return openEnds===2?5000:(openEnds===1?400:0);
      if(count===2)return openEnds===2?150:(openEnds===1?30:0);
      if(count===1)return openEnds===2?8:0;return 0;}
    function evalPoint(g,r,c,color){var total=0;for(var d=0;d<DIRS.length;d++){var ri=runInfo(g,r,c,color,DIRS[d][0],DIRS[d][1]);total+=scoreFor(ri.count,ri.openEnds);}return total;}
    function candidates(g){var set={},any=false;
      for(var i=0;i<N*N;i++){if(g[i]!==0){any=true;var r=Math.floor(i/N),c=i%N;
        for(var dr=-2;dr<=2;dr++)for(var dc=-2;dc<=2;dc++){var nr=r+dr,nc=c+dc;if(inb(nr,nc)&&g[idx(nr,nc)]===0)set[idx(nr,nc)]=true;}}}
      if(!any)return[idx(Math.floor(N/2),Math.floor(N/2))];
      return Object.keys(set).map(Number);}
    function cpuMove(g){var cands=candidates(g);var winMoves=[],blockMoves=[],best=-Infinity,bestCell=null;
      for(var i=0;i<cands.length;i++){var cell=cands[i],r=Math.floor(cell/N),c=cell%N;
        var off=evalPoint(g,r,c,2),def=evalPoint(g,r,c,1);
        if(off>=100000)winMoves.push(cell);if(def>=100000)blockMoves.push(cell);
        var total=off+def*0.85;if(total>best){best=total;bestCell=cell;}}
      if(winMoves.length>0)return winMoves[0];
      if(blockMoves.length>0)return blockMoves[0];
      return bestCell;}
    function checkWin(g,color,r,c){for(var d=0;d<DIRS.length;d++){var ri=runInfo(g,r,c,color,DIRS[d][0],DIRS[d][1]);if(ri.count>=5)return DIRS[d];}return null;}
    function winLineCells(g,color,r,c,dir){var dr=dir[0],dc=dir[1];var cellsList=[{r:r,c:c}];
      var fr=r+dr,fc=c+dc;while(inb(fr,fc)&&g[idx(fr,fc)]===color){cellsList.push({r:fr,c:fc});fr+=dr;fc+=dc;}
      var br=r-dr,bc=c-dc;while(inb(br,bc)&&g[idx(br,bc)]===color){cellsList.push({r:br,c:bc});br-=dr;bc-=dc;}
      return cellsList.map(function(p){return idx(p.r,p.c);});}
    function stoneEl(color){var d=document.createElement('div');d.className='gk-stone place-anim '+(color===1?'player':'cpu');return d;}
    function render(winCells){cells.forEach(function(cell,i){cell.classList.toggle('win',!!(winCells&&winCells.indexOf(i)>=0));
      cell.innerHTML='';var v=grid[i];if(v)cell.appendChild(stoneEl(v));});}
    function finish(youWin,winCells){over=true;winner=youWin;
      statusEl.textContent=youWin?'Five in a row \u2014 you win!':(winCells?'CPU got five in a row.':'Board full \u2014 draw.');
      render(winCells);
      if(youWin){done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
      else{stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);}}
    function cpuTurn(){thinking=true;statusEl.textContent='CPU is thinking\u2026';
      setTimeout(function(){var cell=cpuMove(grid);if(cell===null||cell===undefined){thinking=false;finish(false,null);return;}
        var r=Math.floor(cell/N),c=cell%N;grid[cell]=2;
        var dir=checkWin(grid,2,r,c);
        if(dir){thinking=false;finish(false,winLineCells(grid,2,r,c,dir));return;}
        if(grid.indexOf(0)<0){thinking=false;finish(false,null);return;}
        thinking=false;render();statusEl.textContent='Your move';},380);}
    function click(i){if(over||thinking||grid[i]!==0)return;var r=Math.floor(i/N),c=i%N;grid[i]=1;
      var dir=checkWin(grid,1,r,c);
      if(dir){finish(true,winLineCells(grid,1,r,c,dir));return;}
      if(grid.indexOf(0)<0){render();finish(false,null);return;}
      render();cpuTurn();}
    function init(){grid=new Array(N*N).fill(0);over=false;winner=false;thinking=false;
      done.disabled=true;done.classList.remove('k-earn-ready');
      board.innerHTML='';cells=[];
      for(var i=0;i<N*N;i++){(function(i){var cell=document.createElement('div');cell.className='gk-cell';cell.addEventListener('click',function(){click(i);});board.appendChild(cell);cells.push(cell);})(i);}
      statusEl.textContent='Your move (you are the clay stones)';}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(winner?4:0,grid.filter(function(v){return v!==0;}).length,winner);});
    init();
  <\/script>
</div>`;
}
export {
  gomoku
};
